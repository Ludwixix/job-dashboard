"""API boundary package serving as the sole gateway for frontend client communication."""
from __future__ import annotations

from .gateway import ApiGateway
from ..web import DashboardApp, make_handler

__all__ = ["ApiGateway", "DashboardApp", "make_handler"]
