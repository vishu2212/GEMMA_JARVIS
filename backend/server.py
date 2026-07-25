import asyncio
from contextlib import asynccontextmanager
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from config import settings
from routes import health, chat
from utils.logger import logger
from utils.audio_utils import cleanup_expired_audio_files

async def periodic_audio_cleanup():
    """Runs a background loop to prune old audio files from cache every 5 minutes."""
    logger.info("Background temp audio cleanup loop started.")
    while True:
        try:
            await asyncio.sleep(300)
            cleanup_expired_audio_files(str(settings.TEMP_AUDIO_DIR), max_age_seconds=300)
        except asyncio.CancelledError:
            logger.info("Background temp audio cleanup loop cancelled.")
            break
        except Exception as e:
            logger.error(f"Error in periodic cleanup task: {e}", exc_info=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing JARVIS Backend Application Lifespan...")
    logger.info(f"Target Settings: HOST={settings.HOST}, PORT={settings.PORT}")
    
    cleanup_expired_audio_files(str(settings.TEMP_AUDIO_DIR), max_age_seconds=0)
    cleanup_task = asyncio.create_task(periodic_audio_cleanup())
    
    yield
    
    logger.info("Shutting down JARVIS Backend Application Lifespan...")
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title="JARVIS Edge AI Copilot Backend",
    description="Embedded Systems AI Copilot service pipeline for ESP32-S3 (JARVIS)",
    version="1.0.0",
    lifespan=lifespan
)

app.mount("/temp", StaticFiles(directory=str(settings.TEMP_DIR)), name="temp")

static_dir = settings.BASE_DIR / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(chat.router)

@app.get("/", response_class=FileResponse)
async def serve_index():
    index_file = settings.BASE_DIR / "static" / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"message": "JARVIS Edge AI Backend API Running"}

if __name__ == "__main__":
    uvicorn.run("server:app", host=settings.HOST, port=settings.PORT, reload=False)
