"""
Structured logging module for the job dashboard.
"""
from __future__ import annotations

import json
import logging
import sys
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any


class LogLevel(Enum):
    """Log levels."""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


@dataclass
class LogEntry:
    """A structured log entry."""
    timestamp: str
    level: LogLevel
    message: str
    module: str
    function: str
    lineno: int
    exc_info: str | None = None
    extra: dict[str, Any] = None
    
    def __post_init__(self):
        if self.extra is None:
            self.extra = {}
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "timestamp": self.timestamp,
            "level": self.level.value,
            "message": self.message,
            "module": self.module,
            "function": self.function,
            "lineno": self.lineno,
            "exc_info": self.exc_info,
            "extra": self.extra
        }
    
    def to_json(self) -> str:
        """Convert to JSON string."""
        return json.dumps(self.to_dict(), ensure_ascii=False)


class StructuredLogger:
    """
    Structured logger that writes JSON logs.
    """
    
    def __init__(self, name: str, log_dir: Path | None = None, level: LogLevel = LogLevel.INFO):
        """
        Initialize the structured logger.
        
        Args:
            name: Logger name
            log_dir: Directory for log files
            level: Log level
        """
        self.name = name
        self.log_dir = log_dir
        self.level = level
        
        # Create log directory if specified
        if self.log_dir:
            self.log_dir.mkdir(parents=True, exist_ok=True)
            self.log_file = self.log_dir / f"{name}.jsonl"
        else:
            self.log_file = None
        
        # Set up Python logger for backward compatibility
        self.py_logger = logging.getLogger(name)
        self.py_logger.setLevel(getattr(logging, level.value))
        
        # Add console handler if no handlers exist
        if not self.py_logger.handlers:
            console_handler = logging.StreamHandler(sys.stdout)
            console_handler.setLevel(getattr(logging, level.value))
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            console_handler.setFormatter(formatter)
            self.py_logger.addHandler(console_handler)
    
    def _write_log_entry(self, entry: LogEntry):
        """Write a log entry to file."""
        if self.log_file:
            try:
                with open(self.log_file, "a", encoding="utf-8") as f:
                    f.write(entry.to_json() + "\n")
            except Exception:
                # Fall back to Python logger if file write fails
                self.py_logger.error(f"Failed to write log entry: {entry.message}")
    
    def _create_log_entry(self, level: LogLevel, msg: str, extra: dict[str, Any] | None = None) -> LogEntry:
        """Create a log entry."""
        # Get caller information
        import inspect
        frame = inspect.currentframe().f_back.f_back  # Skip two frames (logger method + helper)
        
        return LogEntry(
            timestamp=datetime.now().isoformat(),
            level=level,
            message=str(msg),
            module=frame.f_globals.get('__name__', 'unknown'),
            function=frame.f_code.co_name,
            lineno=frame.f_lineno,
            extra=extra or {}
        )
    
    def debug(self, msg: str, extra: dict[str, Any] | None = None):
        """Log debug message."""
        if self.level.value <= LogLevel.DEBUG.value:
            entry = self._create_log_entry(LogLevel.DEBUG, msg, extra)
            self._write_log_entry(entry)
            self.py_logger.debug(msg, extra=extra)
    
    def info(self, msg: str, extra: dict[str, Any] | None = None):
        """Log info message."""
        if self.level.value <= LogLevel.INFO.value:
            entry = self._create_log_entry(LogLevel.INFO, msg, extra)
            self._write_log_entry(entry)
            self.py_logger.info(msg, extra=extra)
    
    def warning(self, msg: str, extra: dict[str, Any] | None = None):
        """Log warning message."""
        if self.level.value <= LogLevel.WARNING.value:
            entry = self._create_log_entry(LogLevel.WARNING, msg, extra)
            self._write_log_entry(entry)
            self.py_logger.warning(msg, extra=extra)
    
    def error(self, msg: str, extra: dict[str, Any] | None = None, exc_info: bool = False):
        """Log error message."""
        if self.level.value <= LogLevel.ERROR.value:
            entry = self._create_log_entry(LogLevel.ERROR, msg, extra)
            if exc_info:
                import traceback
                entry.exc_info = traceback.format_exc()
            self._write_log_entry(entry)
            self.py_logger.error(msg, extra=extra, exc_info=exc_info)
    
    def critical(self, msg: str, extra: dict[str, Any] | None = None):
        """Log critical message."""
        if self.level.value <= LogLevel.CRITICAL.value:
            entry = self._create_log_entry(LogLevel.CRITICAL, msg, extra)
            self._write_log_entry(entry)
            self.py_logger.critical(msg, extra=extra)
    
    def log_metric(self, name: str, value: Any, tags: dict[str, str] | None = None):
        """Log a metric."""
        extra = {
            "metric": name,
            "value": value,
            "tags": tags or {}
        }
        self.info(f"Metric: {name} = {value}", extra=extra)
    
    def log_performance(self, operation: str, duration_seconds: float, **kwargs):
        """Log performance metrics."""
        extra = {
            "operation": operation,
            "duration_seconds": duration_seconds,
            **kwargs
        }
        self.info(f"Performance: {operation} took {duration_seconds:.3f}s", extra=extra)
    
    def log_api_call(self, endpoint: str, method: str, status_code: int | None = None, duration_seconds: float | None = None):
        """Log API call."""
        extra = {
            "api_endpoint": endpoint,
            "api_method": method,
            "status_code": status_code,
            "duration_seconds": duration_seconds
        }
        self.info(f"API: {method} {endpoint}", extra=extra)


# Global logger instances
_loggers: dict[str, StructuredLogger] = {}


def get_logger(name: str = "job_dashboard", log_dir: Path | None = None, level: str | LogLevel = LogLevel.INFO) -> StructuredLogger:
    """
    Get a structured logger instance.
    
    Args:
        name: Logger name
        log_dir: Directory for log files
        level: Log level (string or LogLevel enum)
    
    Returns:
        StructuredLogger instance
    """
    if name not in _loggers:
        if isinstance(level, str):
            level = LogLevel(level.upper())
        
        _loggers[name] = StructuredLogger(name, log_dir, level)
    
    return _loggers[name]


def setup_logging(log_dir: Path | None = None, level: str | LogLevel = LogLevel.INFO):
    """
    Set up logging for the application.
    
    Args:
        log_dir: Directory for log files
        level: Log level (string or LogLevel enum)
    """
    # Configure root logger
    root_logger = get_logger("job_dashboard", log_dir, level)
    
    # Configure module-specific loggers
    get_logger("job_dashboard.cache", log_dir, level)
    get_logger("job_dashboard.llm", log_dir, level)
    get_logger("job_dashboard.sources", log_dir, level)
    get_logger("job_dashboard.scoring", log_dir, level)
    get_logger("job_dashboard.web", log_dir, level)
    
    return root_logger