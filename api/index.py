import os
import sys
from pathlib import Path

# Add backend directory to sys.path for Vercel serverless function entrypoint
root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"
sys.path.insert(0, str(backend_dir))

from server import app
