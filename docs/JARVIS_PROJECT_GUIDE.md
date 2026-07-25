# JARVIS Smart Voice Companion - Project & Technical Guide

Welcome to the technical guide for your **JARVIS Smart Voice Companion**! This document provides a complete breakdown of the project architecture, frameworks, and drivers used to build it, along with a blueprint of future enhancements to make it fully portable without a laptop or Wi-Fi.

---

## 1. Project Overview & Architectural Design

The JARVIS Voice Assistant is a completely offline, low-latency, general-purpose voice companion designed for smart home, IoT, robotics, and embedded AI tasks.

### System Topology
*   **Hardware Client (Satellite):** ESP32-S3 DevKitC-1 microcontroller equipped with an INMP441 I2S Microphone, a MAX98357A I2S Audio Amplifier & Speaker, and a 128x64 SSD1306 OLED Screen.
*   **AI Backend (Brain):** A local FastAPI Python application hosting local Speech-to-Text (Whisper), **Gemma 4** (`gemma-4-31b-it` via Google AI Studio API) as an embedded engineering copilot, and local Speech Synthesis (Piper TTS).
*   **Communication Pipeline:** Real-time WebSockets over a local Wi-Fi connection, transmitting JSON control frames and binary 16kHz PCM16 audio packets.

---

## 2. Custom Firmware Framework & Drivers

The firmware was compiled using **ESP-IDF v5.5.4** (Espressif IoT Development Framework) in C. It relies on the **FreeRTOS** real-time kernel to manage multitasking and priority queue operations.

### Key Drivers & Protocols Implemented:
1.  **I2S (Inter-IC Sound) Protocol:**
    *   **Audio Capture (RX):** Handles standard digital audio capture from the **INMP441 microphone** at a 16kHz sample rate, 16-bit depth, mono channel configuration.
    *   **Audio Playback (TX):** Sends incoming PCM audio bytes received from the WebSocket directly to the **MAX98357A I2S DAC** to drive the analog speaker.
2.  **I2C (Inter-Integrated Circuit):**
    *   Interfaces with the **SSD1306 OLED Display** to render text-based state notifications ('Connected', 'Ready', 'Listening...', 'Reasoning with Gemma 4...', 'Speaking...').
3.  **GPIO & Button Handlers:**
    *   Monitors the physical **BOOT button (GPIO 0)** using active-low polling to detect when the user presses and holds the button to start/stop audio recording.
4.  **Persistent WebSocket Client:**
    *   Uses Espressif's standard WebSocket client library (`esp_websocket_client`) to establish a persistent TCP pipe. It handles full-duplex communication: streaming raw voice bytes up to the server and downloading speech audio chunks down.

---

## 3. Offline AI Backend Pipeline

The backend is built in **Python 3.13** using **FastAPI**:

1.  **FastAPI WebSockets:** Manages connection states and handles simultaneous string events (`"start"`, `"stop"`, `"listening"`, `"reasoning"`, `"done"`) and binary data streams.
2.  **Faster-Whisper (Speech-to-Text):** Runs locally on CPU/GPU to transcribe captured audio query files.
3.  **Gemma 4 API (Large Language Model):** Powered by Google AI Studio's `gemma-4-31b-it`. The model is injected with a system instruction prompt for embedded systems copilot and hardware troubleshooting.
4.  **Piper TTS (Text-to-Speech):** High-performance neural voice generator (`en_US-lessac-medium.onnx`).
5.  **Digital Volume Scaling:** Intercepts volume requests (e.g. *"set volume to 50%"*). It scales the raw 16-bit PCM signal amplitudes (multiplier `0.1` to `1.2`) and applies digital clipping protection (`np.clip`) before sending audio to the board.

---

## 4. Future Scope: Complete Portability (No Laptop or Wi-Fi)

To make the JARVIS assistant completely portable—a pocket-sized standalone device that requires no laptop, external router, or Wi-Fi—the following upgrades can be implemented:

### A. On-Chip Inference (Voice Command Engine)
*   Instead of sending audio to a server for speech-to-text, you can use the **ESP-Skainet** framework (Espressif's Intelligent Voice Assistant) or **TensorFlow Lite Micro** directly on the ESP32-S3.
*   This allows the chip to recognize local commands (like *"Turn on light"*, *"Mute assistant"*, *"Volume up"*) directly on-chip with zero latency and zero connection requirements.

### B. Hardware Neural Accelerator (Stand-alone AI)
*   For running full conversational AI (LLM and TTS) in a pocket toy, you can attach a co-processor module like a **Raspberry Pi Compute Module 4 (CM4)** or a **Kendryte K210/K510** AI chip inside the enclosure.
*   This enables running highly quantized small-scale LLMs (such as a 1B parameter model) and local TTS directly inside the physical unit.

### C. Access Point (AP) Hotspot Mode
*   Configure the ESP32-S3 firmware to act as a **Wi-Fi Access Point**. The board will broadcast its own Wi-Fi SSID (e.g. *"Jarvis-Companion"*).
*   Your smartphone can connect to this network and host the backend server using an Android/iOS Python runner app (like Termux or Pyto). This eliminates the need for a laptop or external Wi-Fi router entirely.

### D. SPI MicroSD Card Integration
*   Attach a MicroSD card reader to the ESP32-S3 via SPI.
*   Instead of generating TTS speech dynamically, you can pre-render thousands of common assistant voice replies as `.wav` files and store them on the SD card. The ESP32 can play them back directly from the card based on quick logic triggers, bypassing TTS generation entirely.

### E. Battery Power Management
*   Add a **3.7V Lithium-Polymer (LiPo)** battery inside the enclosure.
*   Connect a **TP4056** USB-C charging board and a **5V step-up boost converter** to supply clean power directly to the ESP32-S3 development board, making it completely cordless and portable.
