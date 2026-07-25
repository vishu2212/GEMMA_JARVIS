import json
import re
from pathlib import Path
from typing import Dict, Any, Optional
from config import settings
from utils.logger import logger

class MemoryService:
    """Persistent Memory & Personalization Engine for JARVIS.
    Persists user hardware profile and preferences across sessions.
    """

    def __init__(self, memory_file: Optional[Path] = None) -> None:
        self.memory_file = memory_file or (settings.BASE_DIR / "data" / "user_memory.json")
        self.memory_file.parent.mkdir(parents=True, exist_ok=True)
        self.memory: Dict[str, Any] = {}
        self.load_memory()

    def load_memory(self) -> Dict[str, Any]:
        """Loads user memory from JSON file or initializes defaults."""
        if self.memory_file.exists():
            try:
                with open(self.memory_file, "r", encoding="utf-8") as f:
                    self.memory = json.load(f)
            except Exception as e:
                logger.error(f"Error loading user_memory.json: {e}")
                self._load_defaults()
        else:
            self._load_defaults()
        return self.memory

    def save_memory(self) -> None:
        """Saves current memory to JSON file."""
        try:
            with open(self.memory_file, "w", encoding="utf-8") as f:
                json.dump(self.memory, f, indent=2)
            logger.info("Saved updated user memory profile.")
        except Exception as e:
            logger.error(f"Error saving user_memory.json: {e}")

    def update_key(self, key: str, value: Any) -> Dict[str, Any]:
        """Updates or adds a key-value memory item."""
        self.memory[key] = value
        self.save_memory()
        return self.memory

    def get_memory_prompt(self) -> str:
        """Formats long-term memory for Gemma 4 system prompt injection."""
        if not self.memory:
            return ""

        profile_lines = [f"- {k.replace('_', ' ').title()}: {v}" for k, v in self.memory.items()]
        formatted = (
            "PERSISTENT DEVELOPER PROFILE & HARDWARE PREFERENCES (Long-Term Memory):\n"
            + "\n".join(profile_lines)
            + "\nINSTRUCTIONS: Adapt all technical guidance, pinouts, and code examples specifically to this user hardware setup and preferences."
        )
        return formatted

    def auto_extract_preferences(self, user_text: str) -> bool:
        """Extracts hardware profile or preferences automatically from user messages."""
        text_lower = user_text.lower()
        updated = False

        # Extract board type
        if "my board is" in text_lower or "i am using" in text_lower or "using board" in text_lower:
            match = re.search(r'(?:board is|using|using board)\s+([a-zA-Z0-9\-\_]+)', user_text, re.IGNORECASE)
            if match:
                board_name = match.group(1).upper()
                self.memory["board"] = board_name
                updated = True

        # Extract mic type
        if "my mic is" in text_lower or "microphone is" in text_lower:
            match = re.search(r'(?:mic is|microphone is)\s+([a-zA-Z0-9\-\_]+)', user_text, re.IGNORECASE)
            if match:
                self.memory["microphone"] = match.group(1).upper()
                updated = True

        if updated:
            self.save_memory()
        return updated

    def _load_defaults(self) -> None:
        self.memory = {
            "board": "ESP32-S3 DevKitC-1",
            "microphone": "INMP441 MEMS (I2S)",
            "speaker_dac": "MAX98357A Class-D (I2S)",
            "oled_display": "SSD1306 128x64 (I2C 0x3C)",
            "code_preference": "C / ESP-IDF v5",
            "speech_voice": "Piper Neural Lessac"
        }
        self.save_memory()
