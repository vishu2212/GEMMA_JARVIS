import io
import time
import asyncio
import cv2
from PIL import Image
from typing import Optional, Dict
from config import settings
from utils.logger import logger
from services.llm_service import LLMService
from services.tts_service import TTSService

class VisionService:
    """Service to handle live video stream sampling and Gemma 4 circuit inspection."""

    def __init__(self, llm_service: LLMService, tts_service: TTSService) -> None:
        self.llm_service = llm_service
        self.tts_service = tts_service
        self.is_running = False
        self.stream_url: Optional[str] = None
        self.last_diagnosis: str = ""
        self.inspection_task: Optional[asyncio.Task] = None
        self.sample_interval_sec: float = 3.0
        logger.info("Initialized VisionService for live hardware stream inspection.")

    async def start_inspection(self, stream_url: str = "0") -> Dict[str, str]:
        """Starts live stream inspection background loop."""
        if self.is_running:
            return {"status": "already_running", "stream_url": self.stream_url or "0"}

        self.stream_url = stream_url
        self.is_running = True
        self.last_diagnosis = ""
        self.inspection_task = asyncio.create_task(self._inspection_loop())
        logger.info(f"Started live hardware vision inspection loop for stream: {stream_url}")
        return {"status": "started", "stream_url": stream_url}

    async def stop_inspection(self) -> Dict[str, str]:
        """Stops live stream inspection loop."""
        if not self.is_running:
            return {"status": "not_running"}

        self.is_running = False
        if self.inspection_task:
            self.inspection_task.cancel()
            self.inspection_task = None
        logger.info("Stopped live hardware vision inspection loop.")
        return {"status": "stopped"}

    def get_status(self) -> Dict[str, str]:
        """Returns status of the vision inspection loop."""
        return {
            "is_running": self.is_running,
            "stream_url": self.stream_url or "none",
            "last_diagnosis": self.last_diagnosis or "None"
        }

    async def _inspection_loop(self) -> None:
        """Background loop reading stream frames every sample_interval_sec."""
        target_src = 0 if self.stream_url in ("0", "webcam") else self.stream_url
        cap = cv2.VideoCapture(target_src)

        if not cap.isOpened():
            logger.error(f"Failed to open video stream at source: {self.stream_url}")
            self.is_running = False
            return

        logger.info(f"Successfully opened video stream at source: {target_src}")

        try:
            while self.is_running:
                ret, frame = cap.read()
                if not ret or frame is None:
                    logger.warning("Failed to grab frame from video stream. Retrying in 1s...")
                    await asyncio.sleep(1.0)
                    continue

                # Convert OpenCV BGR frame to PIL RGB Image
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pil_image = Image.fromarray(rgb_frame)

                prompt = (
                    "Analyze this breadboard circuit image. "
                    "Identify the components present (ESP32, INMP441, OLED, MAX98357A, sensors). "
                    "Detect any missing wires, disconnected pins, or short circuits. "
                    "If everything is connected properly, say 'All circuit connections look good.' "
                    "If a wire or pin is disconnected or wrong, state 'Warning: [specific issue]'. "
                    "Keep your answer under 50 words."
                )

                try:
                    logger.info("Sampling live frame and analyzing with Gemma 4 Vision...")
                    diagnosis = await self.llm_service.analyze_circuit_image(pil_image, prompt)
                    logger.info(f"Gemma Vision Frame Diagnosis: {diagnosis}")

                    # Check if diagnosis has meaningful state change compared to last diagnosis
                    if self._should_announce(diagnosis):
                        logger.info(f"Significant Vision State Change Detected! Announcing: {diagnosis}")
                        self.last_diagnosis = diagnosis
                        # Synthesize speech output over speaker
                        await self.tts_service.speak(diagnosis)

                except Exception as ex:
                    logger.error(f"Error analyzing live stream frame: {ex}")

                # Sleep sample interval
                await asyncio.sleep(self.sample_interval_sec)

        except asyncio.CancelledError:
            logger.info("Vision inspection loop cancelled.")
        except Exception as e:
            logger.error(f"Unexpected error in vision inspection loop: {e}", exc_info=True)
        finally:
            cap.release()
            self.is_running = False
            logger.info("Released video capture resource.")

    def _should_announce(self, new_diagnosis: str) -> bool:
        """Determines if new diagnosis represents a new state or warning worth announcing aloud."""
        if not self.last_diagnosis:
            return True

        new_lower = new_diagnosis.lower()
        last_lower = self.last_diagnosis.lower()

        # Announce if warning state changes or resolution occurs
        if ("warning" in new_lower or "missing" in new_lower or "disconnect" in new_lower) and not ("warning" in last_lower or "missing" in last_lower or "disconnect" in last_lower):
            return True
        if "good" in new_lower or "restored" in new_lower or "correct" in new_lower:
            if "warning" in last_lower or "missing" in last_lower or "disconnect" in last_lower:
                return True

        return False
