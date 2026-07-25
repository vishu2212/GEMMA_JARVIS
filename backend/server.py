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

@app.get("/camera", response_class=FileResponse)
async def serve_camera():
    camera_file = settings.BASE_DIR / "static" / "camera.html"
    if camera_file.exists():
        return FileResponse(camera_file)
    return {"message": "Mobile Camera Page Not Found"}

@app.get("/mobile", response_class=FileResponse)
async def serve_mobile():
    mobile_file = settings.BASE_DIR / "static" / "mobile.html"
    if mobile_file.exists():
        return FileResponse(mobile_file)
    return {"message": "Mobile Lens Page Not Found"}

def generate_self_signed_cert():
    cert_path = settings.BASE_DIR / "cert.pem"
    key_path = settings.BASE_DIR / "key.pem"
    if cert_path.exists() and key_path.exists():
        return str(cert_path), str(key_path)
    try:
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        import datetime

        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        subject = issuer = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, u"JARVIS Edge AI")])
        cert = x509.CertificateBuilder().subject_name(
            subject
        ).issuer_name(
            issuer
        ).public_key(
            key.public_key()
        ).serial_number(
            x509.random_serial_number()
        ).not_valid_before(
            datetime.datetime.now(datetime.timezone.utc)
        ).not_valid_after(
            datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=365)
        ).sign(key, hashes.SHA256())

        with open(key_path, "wb") as f:
            f.write(key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption()
            ))
        with open(cert_path, "wb") as f:
            f.write(cert.public_bytes(serialization.Encoding.PEM))
        logger.info("Generated self-signed HTTPS SSL certificate for mobile camera stream.")
        return str(cert_path), str(key_path)
    except Exception as e:
        logger.error(f"Failed to generate SSL certificate: {e}")
        return None, None

if __name__ == "__main__":
    cert_file, key_file = generate_self_signed_cert()
    if cert_file and key_file:
        logger.info("Starting HTTPS Server for Live Mobile Camera Streaming...")
        uvicorn.run("server:app", host=settings.HOST, port=settings.PORT, ssl_certfile=cert_file, ssl_keyfile=key_file, reload=False)
    else:
        uvicorn.run("server:app", host=settings.HOST, port=settings.PORT, reload=False)
