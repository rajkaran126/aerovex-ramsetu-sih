#!/usr/bin/env python
"""
AERO-TWIN Backend Startup Script

Usage:
    python run_backend.py
"""
import uvicorn
import sys
import os

# Add backend to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info",
        ws_ping_interval=20,
        ws_ping_timeout=30,
    )
