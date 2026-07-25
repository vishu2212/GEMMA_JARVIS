# 🎬 2-Minute Winning Hackathon Video Script — JARVIS Edge AI

**Target Duration**: 1 minute 45 seconds – 2 minutes  
**Core Goal**: Show voice interaction, Gemma 4 hardware reasoning, embedded troubleshooter mode, and live OLED visual states.

---

## ⏱️ Video Timeline & Shot List

| Time | Scene / Shot | Audio / Voiceover | Action on Screen |
| :---: | :--- | :--- | :--- |
| **0:00 - 0:15** | **Hook & Intro** | *"Meet JARVIS Edge AI — a real-time voice assistant and embedded engineering copilot powered by Google's Gemma 4 and an ESP32-S3 microcontroller."* | Show ESP32-S3 breadboard setup with OLED, mic, speaker, and laptop running server logs. |
| **0:15 - 0:35** | **Core Demo 1: Embedded AI Reasoning** | Say: *"Hey Jarvis... What is an ESP32-S3?"* | Camera zooms into OLED showing `Reasoning with Gemma 4...`, followed by clear audio response from speaker. |
| **0:35 - 1:05** | **Core Demo 2: Embedded Debug Mode (WOW Feature)** | Say: *"Hey Jarvis... My ESP32 won't flash."* | Show live server logs & OLED state. Gemma 4 provides step-by-step diagnostic checks (data USB cable, boot pin GPIO 0, drivers). |
| **1:05 - 1:30** | **Core Demo 3: Component & Protocol Explanation** | Say: *"Hey Jarvis... Explain I2S in simple terms."* | Gemma 4 explains digital audio clocks and MAX98357A DAC integration with sub-second voice output. |
| **1:30 - 1:45** | **Architecture & Tech Stack** | *"JARVIS streams 16kHz PCM audio over full-duplex WebSockets to Faster-Whisper, processes queries with Gemma 4, and synthesizes audio with Piper TTS."* | Show Architecture Diagram graphic on screen. |
| **1:45 - 2:00** | **Conclusion & Future Scope** | *"JARVIS bridges the gap between AI reasoning and hardware benchwork. Check out our Kaggle submission and GitHub repo for full setup guides!"* | Display GitHub URL and Kaggle logo. |

---

## 💡 Top Tips for Recording
1. **Clear Mic Placement**: Place your microphone close to the ESP32 speaker so the audio response is crisp in the video.
2. **Show the OLED Screen**: Keep the 128x64 OLED display in frame so judges see `Listening...` $\rightarrow$ `Reasoning with Gemma 4...` $\rightarrow$ `Speaking...`.
3. **Keep Server Console Visible**: Show the terminal running `server.py` in the background to demonstrate real-time latency profile logs (`stt_ms`, `llm_ms`, `tts_ms`, `total_ms`).
