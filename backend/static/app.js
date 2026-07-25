document.addEventListener('DOMContentLoaded', () => {
  const cameraFeed = document.getElementById('camera-feed');
  const frameCanvas = document.getElementById('frame-canvas');
  const videoOverlay = document.getElementById('video-overlay');
  const scanLine = document.getElementById('scan-line');
  
  const btnToggleCamera = document.getElementById('btn-toggle-camera');
  const btnInspectNow = document.getElementById('btn-inspect-now');
  const btnAutoStream = document.getElementById('btn-auto-stream');
  
  const diagnosisBox = document.getElementById('diagnosis-box');
  const textInput = document.getElementById('text-input');
  const btnSendText = document.getElementById('btn-send-text');
  const btnRecordMic = document.getElementById('btn-record-mic');
  const chatMessages = document.getElementById('chat-messages');
  
  const latStt = document.getElementById('lat-stt');
  const latLlm = document.getElementById('lat-llm');
  const latTts = document.getElementById('lat-tts');
  const latTotal = document.getElementById('lat-total');
  
  const volSlider = document.getElementById('vol-slider');
  const volVal = document.getElementById('vol-val');
  
  let mediaStream = null;
  let isCameraActive = false;
  let autoInspectInterval = null;
  let isAutoInspect = false;
  let mediaRecorder = null;
  let audioChunks = [];
  let isRecordingMic = false;

  // 1. Camera Toggle (WebCam / Phone Browser)
  btnToggleCamera.addEventListener('click', async () => {
    if (!isCameraActive) {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
        cameraFeed.srcObject = mediaStream;
        videoOverlay.style.display = 'none';
        isCameraActive = true;
        btnToggleCamera.textContent = '🛑 Stop Camera';
        btnToggleCamera.className = 'btn btn-danger';
        btnInspectNow.disabled = false;
        btnAutoStream.disabled = false;
      } catch (err) {
        alert('Could not access camera: ' + err.message);
      }
    } else {
      stopCamera();
    }
  });

  function stopCamera() {
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
    }
    cameraFeed.srcObject = null;
    videoOverlay.style.display = 'flex';
    isCameraActive = false;
    btnToggleCamera.textContent = '📹 Start Phone / Web Camera';
    btnToggleCamera.className = 'btn btn-primary';
    btnInspectNow.disabled = true;
    btnAutoStream.disabled = true;
    stopAutoInspect();
  }

  // 2. Capture & Analyze Frame with Gemma 4 Vision
  btnInspectNow.addEventListener('click', analyzeCurrentFrame);

  async function analyzeCurrentFrame() {
    if (!isCameraActive) return;
    
    scanLine.style.display = 'block';
    setStage('stage-reasoning');

    // Draw video frame to hidden canvas
    const ctx = frameCanvas.getContext('2d');
    frameCanvas.width = cameraFeed.videoWidth || 640;
    frameCanvas.height = cameraFeed.videoHeight || 480;
    ctx.drawImage(cameraFeed, 0, 0, frameCanvas.width, frameCanvas.height);

    // Convert canvas to Blob
    frameCanvas.toBlob(async (blob) => {
      const formData = new FormData();
      formData.append('file', blob, 'circuit_snapshot.jpg');
      formData.append('prompt', 'Analyze this breadboard circuit image. Identify components and detect any missing connections or hardware errors.');

      try {
        const res = await fetch('/vision/analyze', {
          method: 'POST',
          body: formData
        });

        const data = await res.json();
        scanLine.style.display = 'none';
        setStage('stage-idle');

        if (data.status === 'success') {
          diagnosisBox.innerHTML = `<p>${data.analysis}</p>`;
          addChatMessage('JARVIS Vision AI', data.analysis, 'bot-msg');

          if (data.audio_url) {
            const audio = new Audio(data.audio_url);
            audio.play();
          }
        } else {
          diagnosisBox.innerHTML = `<p class="placeholder-text">Analysis failed. Please try again.</p>`;
        }
      } catch (err) {
        scanLine.style.display = 'none';
        setStage('stage-idle');
        console.error('Vision analysis error:', err);
      }
    }, 'image/jpeg', 0.85);
  }

  // 3. Auto-Inspect Toggle (Every 3 seconds)
  btnAutoStream.addEventListener('click', () => {
    if (!isAutoInspect) {
      isAutoInspect = true;
      btnAutoStream.textContent = '⏹️ Stop Auto-Inspect';
      btnAutoStream.className = 'btn btn-danger';
      analyzeCurrentFrame();
      autoInspectInterval = setInterval(analyzeCurrentFrame, 4000);
    } else {
      stopAutoInspect();
    }
  });

  function stopAutoInspect() {
    isAutoInspect = false;
    if (autoInspectInterval) clearInterval(autoInspectInterval);
    btnAutoStream.textContent = '🔄 Auto-Inspect (3s)';
    btnAutoStream.className = 'btn btn-outline';
  }

  // 4. Send Text Prompt
  btnSendText.addEventListener('click', sendTextMessage);
  textInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendTextMessage();
  });

  async function sendTextMessage() {
    const text = textInput.value.trim();
    if (!text) return;

    addChatMessage('YOU', text, 'user-msg');
    textInput.value = '';
    setStage('stage-reasoning');

    try {
      const res = await fetch('/chat/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text })
      });

      const data = await res.json();
      setStage('stage-speaking');
      addChatMessage('JARVIS', data.response, 'bot-msg');

      if (data.latency) {
        latLlm.textContent = (data.latency.llm_ms / 1000).toFixed(2) + 's';
        latTotal.textContent = (data.latency.total_ms / 1000).toFixed(2) + 's';
      }

      // Request TTS audio and play
      const speakRes = await fetch('/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: data.response })
      });

      if (speakRes.ok) {
        const audioBlob = await speakRes.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.play();
      }

      setTimeout(() => setStage('stage-idle'), 2000);
    } catch (err) {
      setStage('stage-idle');
      console.error('Chat error:', err);
    }
  }

  // 5. Mic Voice Recording
  btnRecordMic.addEventListener('click', async () => {
    if (!isRecordingMic) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
        mediaRecorder.onstop = async () => {
          setStage('stage-transcribing');
          const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
          const formData = new FormData();
          formData.append('audio', audioBlob, 'mic_input.wav');

          try {
            const transRes = await fetch('/chat/voice', { method: 'POST', body: formData });
            const data = await transRes.json();
            setStage('stage-speaking');

            addChatMessage('YOU (Voice)', data.transcript, 'user-msg');
            addChatMessage('JARVIS', data.response, 'bot-msg');

            if (data.latency_profile) {
              latStt.textContent = (data.latency_profile.stt_ms / 1000).toFixed(2) + 's';
              latLlm.textContent = (data.latency_profile.llm_ms / 1000).toFixed(2) + 's';
              latTts.textContent = (data.latency_profile.tts_ms / 1000).toFixed(2) + 's';
              latTotal.textContent = (data.latency_profile.total_ms / 1000).toFixed(2) + 's';
            }

            if (data.audio_url) {
              const audio = new Audio(data.audio_url);
              audio.play();
            }

            setTimeout(() => setStage('stage-idle'), 2000);
          } catch (err) {
            setStage('stage-idle');
            console.error('Voice process error:', err);
          }
        };

        mediaRecorder.start();
        isRecordingMic = true;
        btnRecordMic.textContent = '⏹️ Stop Recording';
        btnRecordMic.className = 'btn btn-danger';
        setStage('stage-listening');
      } catch (err) {
        alert('Could not access microphone: ' + err.message);
      }
    } else {
      if (mediaRecorder) mediaRecorder.stop();
      isRecordingMic = false;
      btnRecordMic.textContent = '🎤 Mic';
      btnRecordMic.className = 'btn btn-primary';
    }
  });

  // 6. Volume Slider
  volSlider.addEventListener('input', (e) => {
    volVal.textContent = e.target.value + '%';
  });

  // Helper Utilities
  function addChatMessage(sender, text, msgClass) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `msg ${msgClass}`;
    msgDiv.innerHTML = `<div class="msg-sender">${sender}</div><div class="msg-content">${text}</div>`;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function setStage(stageId) {
    document.querySelectorAll('.stage-step').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(stageId);
    if (target) target.classList.add('active');
  }
});
