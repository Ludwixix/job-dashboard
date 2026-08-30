"""
Database connection pooling for SQLite.
"""
from __future__ import annotations

import atexit
import sqlite3
import threading
import time
from collections import deque
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from .logging import get_logger

logger = get_logger("job_dashboard.db_pool")


class ConnectionPool:
    """
    Simple connection pool for SQLite databases.
    
    Note: SQLite doesn't truly benefit from connection pooling in the same way
    as client-server databases, but this helps manage connection lifecycle
    and provides better error handling.
    """
    
    def __init__(self, db_path: str | Path, max_connections: int = 10, timeout: float = 30.0):
        """
        Initialize the connection pool.
        
        Args:
            db_path: Path to SQLite database file
            max_connections: Maximum number of connections in pool
            timeout: Connection timeout in seconds
        """
        self.db_path = str(db_path)
        self.max_connections = max_connections
        self.timeout = timeout
        
        # Thread-safe connection pool
        self._pool = deque()
        self._lock = threading.Lock()
        self._active_connections = 0
        self._waiting_threads = 0
        
        # Statistics
        self._stats = {
            "connections_created": 0,
            "connections_reused": 0,
            "connections_closed": 0,
            "wait_time_total": 0.0,
            "max_wait_time": 0.0,
        }
        
        # Register cleanup
        atexit.register(self.cleanup)
        
        logger.info(f"Connection pool initialized for {self.db_path}")
    
    def _create_connection(self) -> sqlite3.Connection:
        """Create a new SQLite connection."""
        try:
            conn = sqlite3.connect(self.db_path, check_same_thread=False, timeout=self.timeout)
            conn.row_factory = sqlite3.Row
            self._stats["connections_created"] += 1
            logger.debug(f"Created new connection to {self.db_path}")
            return conn
        except sqlite3.Error as e:
            logger.error(f"Failed to create connection to {self.db_path}: {e!s}")
            raise
    
    def get_connection(self) -> sqlite3.Connection:
        """
        Get a connection from the pool.
        
        Returns:
            SQLite connection
        
        Raises:
            sqlite3.Error: If connection cannot be established
            TimeoutError: If connection cannot be obtained within timeout
        """
        start_time = time.time()
        
        with self._lock:
            # Try to get connection from pool
            if self._pool:
                conn = self._pool.popleft()
                self._active_connections += 1
                self._stats["connections_reused"] += 1
                
                wait_time = time.time() - start_time
                self._stats["wait_time_total"] += wait_time
                self._stats["max_wait_time"] = max(self._stats["max_wait_time"], wait_time)
                
                logger.debug(f"Reused connection to {self.db_path} (wait: {wait_time:.3f}s)")
                return conn
            
            # Check if we can create new connection
            if self._active_connections < self.max_connections:
                conn = self._create_connection()
                self._active_connections += 1
                
                wait_time = time.time() - start_time
                self._stats["wait_time_total"] += wait_time
                self._stats["max_wait_time"] = max(self._stats["max_wait_time"], wait_time)
                
                logger.debug(f"Created new connection to {self.db_path} (wait: {wait_time:.3f}s)")
                return conn
            
            # Pool is full, need to wait
            self._waiting_threads += 1
        
        # Wait for connection to become available (outside lock)
        try:
            # Simple polling wait (could be improved with condition variables)
            wait_start = time.time()
            while time.time() - wait_start < self.timeout:
                with self._lock:
                    if self._pool:
                        conn = self._pool.popleft()
                        self._active_connections += 1
                        self._waiting_threads -= 1
                        self._stats["connections_reused"] += 1
                        
                        total_wait = time.time() - start_time
                        self._stats["wait_time_total"] += total_wait
                        self._stats["max_wait_time"] = max(self._stats["max_wait_time"], total_wait)
                        
                        logger.debug(f"Got connection after wait {total_wait:.3f}s")
                        return conn
                
                time.sleep(0.1)
            
            # Timeout reached
            with self._lock:
                self._waiting_threads -= 1
            
            raise TimeoutError(f"Could not obtain connection within {self.timeout} seconds")
        
        except Exception:
            with self._lock:
                self._waiting_threads -= 1
            raise
    
    def return_connection(self, conn: sqlite3.Connection):
        """
        Return a connection to the pool.
        
        Args:
            conn: SQLite connection to return
        """
        with self._lock:
            # Check if connection is still valid
            try:
                conn.execute("SELECT 1").fetchone()
                self._pool.append(conn)
                self._active_connections -= 1
                logger.debug("Returned connection to pool")
            except sqlite3.Error:
                # Connection is broken, close it
                try:
                    conn.close()
                except:
                    pass
                self._stats["connections_closed"] += 1
                self._active_connections -= 1
                logger.warning("Closed broken connection")
    
    @contextmanager
    def connection(self):
        """
        Context manager for getting a connection.
        
        Usage:
            with pool.connection() as conn:
                cursor = conn.execute("SELECT * FROM table")
                ...
        """
        conn = None
        try:
            conn = self.get_connection()
            yield conn
        finally:
            if conn:
                self.return_connection(conn)
    
    def execute(self, query: str, params: tuple = ()) -> list[dict[str, Any]]:
        """
        Execute a query and return results.
        
        Args:
            query: SQL query
            params: Query parameters
        
        Returns:
            List of dictionaries with results
        """
        with self.connection() as conn:
            cursor = conn.execute(query, params)
            results = []
            for row in cursor.fetchall():
                results.append(dict(row))
            return results
    
    def execute_many(self, query: str, params_list: list[tuple]) -> None:
        """
        Execute a query with multiple parameter sets.
        
        Args:
            query: SQL query
            params_list: List of parameter tuples
        """
        with self.connection() as conn:
            conn.executemany(query, params_list)
            conn.commit()
    
    def get_stats(self) -> dict[str, Any]:
        """Get connection pool statistics."""
        with self._lock:
            return {
                "pool_size": len(self._pool),
                "active_connections": self._active_connections,
                "max_connections": self.max_connections,
                "waiting_threads": self._waiting_threads,
                **self._stats,
                "avg_wait_time": self._stats["wait_time_total"] / max(1, self._stats["connections_created"] + self._stats["connections_reused"])
            }
    
    def cleanup(self):
        """Clean up all connections in the pool."""
        with self._lock:
            logger.info(f"Cleaning up connection pool for {self.db_path}")
            while self._pool:
                conn = self._pool.popleft()
                try:
                    conn.close()
                except:
                    pass
                self._stats["connections_closed"] += 1
            
            self._active_connections = 0
            logger.info(f"Connection pool cleaned up: {self.get_stats()}")
    
    def __del__(self):
        """Destructor to ensure cleanup."""
        self.cleanup()


# Global connection pools
_connection_pools: dict[str, ConnectionPool] = {}


def get_connection_pool(db_path: str | Path, max_connections: int = 10, timeout: float = 30.0) -> ConnectionPool:
    """
    Get a connection pool for a database.
    
    Args:
        db_path: Path to SQLite database file
        max_connections: Maximum number of connections in pool
        timeout: Connection timeout in seconds
    
    Returns:
        ConnectionPool instance
    """
    db_path_str = str(db_path)
    
    if db_path_str not in _connection_pools:
        _connection_pools[db_path_str] = ConnectionPool(db_path_str, max_connections, timeout)
    
    return _connection_pools[db_path_str]


@contextmanager
def get_db_connection(db_path: str | Path):
    """
    Get a database connection from a pool.
    
    Args:
        db_path: Path to SQLite database file
    
    Yields:
        SQLite connection
    """
    pool = get_connection_pool(db_path)
    with pool.connection() as conn:
        yield conn