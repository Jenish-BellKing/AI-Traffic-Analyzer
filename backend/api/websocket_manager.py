"""
WebSocket connection manager for broadcasting real-time traffic data
to all connected browser clients.
"""

import asyncio
import json
import logging
from typing import Dict, Set

from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Thread-safe WebSocket manager supporting multiple concurrent clients."""

    def __init__(self):
        self._active: Dict[str, WebSocket] = {}   # client_id → socket
        self._lock = asyncio.Lock()

    async def connect(self, client_id: str, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            self._active[client_id] = ws
        logger.info(f"WebSocket connected: {client_id} (total={len(self._active)})")

    async def disconnect(self, client_id: str):
        async with self._lock:
            self._active.pop(client_id, None)
        logger.info(f"WebSocket disconnected: {client_id} (total={len(self._active)})")

    async def send_to(self, client_id: str, data: dict):
        async with self._lock:
            ws = self._active.get(client_id)
        if ws:
            try:
                await ws.send_text(json.dumps(data))
            except Exception as exc:
                logger.warning(f"Failed sending to {client_id}: {exc}")

    async def broadcast(self, data: dict):
        """Send data to all connected clients."""
        text = json.dumps(data)
        dead = []
        async with self._lock:
            clients = list(self._active.items())

        for cid, ws in clients:
            try:
                await ws.send_text(text)
            except Exception:
                dead.append(cid)

        # Clean up dead connections
        if dead:
            async with self._lock:
                for cid in dead:
                    self._active.pop(cid, None)

    @property
    def count(self) -> int:
        return len(self._active)


# Singleton instance used throughout the app
manager = ConnectionManager()
