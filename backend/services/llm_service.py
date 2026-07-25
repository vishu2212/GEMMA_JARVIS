from typing import List, Dict
import os
from google import genai
from config import settings
from utils.logger import logger

class LLMService:
    """Service to handle interactions with Gemma API (Google AI Studio)."""
    
    def __init__(self) -> None:
        self.api_key = settings.GEMMA_API_KEY or os.getenv("GEMMA_API_KEY", "")
        self.model = settings.GEMMA_MODEL
        self.timeout = settings.TIMEOUT_LLM
        
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
            logger.info(f"Initialized LLMService with Google GenAI Gemma API (Model: {self.model})")
        else:
            self.client = None
            logger.warning("LLMService initialized without GEMMA_API_KEY. Please set GEMMA_API_KEY in backend/.env")

    async def get_response(self, messages: List[Dict[str, str]]) -> str:
        """Sends message history to Gemma 4 API (Google AI Studio) and returns response text."""
        if not self.client:
            self.api_key = os.getenv("GEMMA_API_KEY", "")
            if not self.api_key:
                raise RuntimeError("GEMMA_API_KEY is not configured in backend/.env")
            self.client = genai.Client(api_key=self.api_key)

        # Build prompt from conversation messages
        prompt_parts = []
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "system":
                prompt_parts.append(f"System: {content}")
            elif role == "user":
                prompt_parts.append(f"User: {content}")
            elif role == "assistant":
                prompt_parts.append(f"Assistant: {content}")
        
        prompt_parts.append("Assistant: ")
        full_prompt = "\n\n".join(prompt_parts)

        logger.info(f"Sending prompt to Gemma API (Model: {self.model})")
        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=full_prompt
            )
            
            if not response or not response.text:
                logger.error("Empty response received from Gemma API")
                raise RuntimeError("Empty response received from Gemma API")
                
            reply = response.text.strip()
            logger.info("Successfully received response from Gemma API.")
            return reply

        except Exception as e:
            logger.error(f"Error calling Gemma API: {e}", exc_info=True)
            raise RuntimeError(f"Gemma API call failed: {e}")

    async def get_available_models(self) -> List[str]:
        """Queries Google GenAI API and returns available models."""
        logger.info("Querying available models from Google GenAI API")
        try:
            if not self.client:
                return [self.model]
            models = [m.name.replace("models/", "") for m in self.client.models.list()]
            logger.info(f"Retrieved models: {models}")
            return models
        except Exception as e:
            logger.error(f"Failed to fetch models from Gemma API: {e}", exc_info=True)
            return [self.model]
