document.addEventListener('DOMContentLoaded', () => {
  const cameraFeed = document.getElementById('camera-feed');
  const frameCanvas = document.getElementById('frame-canvas');
  const videoOverlay = document.getElementById('video-overlay');
  const thinkingProgress = document.getElementById('thinking-progress');
  const overlayWarning = document.getElementById('overlay-warning');
  
  const btnToggleCamera = document.getElementById('btn-toggle-camera');
  const btnConnectMobile = document.getElementById('btn-connect-mobile');
  const btnInspectNow = document.getElementById('btn-inspect-now');
  const btnAutoStream = document.getElementById('btn-auto-stream');
  
  const qrModal = document.getElementById('qr-modal');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const mobileUrl = document.getElementById('mobile-url');
  
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

  // Auto-Start WebCam on page load
  startWebcam();

  async function startWebcam() {
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
    } catch (err) {
      console.log('Auto camera prompt dismissed or unavailable:', err);
    }
  }

  btnToggleCamera.addEventListener('click', async () => {
    if (!isCameraActive) {
      await startWebcam();
    } else {
      stopCamera();
    }
  });

  function stopCamera() {
    if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
    cameraFeed.srcObject = null;
    videoOverlay.style.display = 'flex';
    isCameraActive = false;
    btnToggleCamera.textContent = '📹 Start Web Camera';
    btnToggleCamera.className = 'btn btn-primary';
    stopAutoInspect();
  }

  // QR Modal toggle
  btnConnectMobile.addEventListener('click', () => {
    mobileUrl.textContent = window.location.origin + '/camera';
    qrModal.style.display = 'flex';
  });

  const closeModalBtn = document.getElementById('btn-close-modal');
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      qrModal.style.display = 'none';
    });
  }

  // Analyze Frame with Gemma 4 Vision
  btnInspectNow.addEventListener('click', analyzeCurrentFrame);

  async function analyzeCurrentFrame() {
    if (!isCameraActive) {
      alert('Please start the Web Camera or connect Mobile Camera first.');
      return;
    }
    
    thinkingProgress.style.display = 'flex';
    setPipelineStage('pipe-reasoning');

    const ctx = frameCanvas.getContext('2d');
    frameCanvas.width = cameraFeed.videoWidth || 640;
    frameCanvas.height = cameraFeed.videoHeight || 480;
    ctx.drawImage(cameraFeed, 0, 0, frameCanvas.width, frameCanvas.height);

    frameCanvas.toBlob(async (blob) => {
      const formData = new FormData();
      formData.append('file', blob, 'circuit_snapshot.jpg');
      formData.append('prompt', 'Analyze this breadboard circuit image. Identify components and detect any missing wires or hardware errors.');

      try {
        const res = await fetch('/vision/analyze', {
          method: 'POST',
          body: formData
        });

        const data = await res.json();
        thinkingProgress.style.display = 'none';
        setPipelineStage('pipe-esp32');

        if (data.status === 'success') {
          diagnosisBox.innerHTML = `<p>${data.analysis}</p>`;
          addChatMessage('JARVIS Vision AI', data.analysis, 'bot-msg');

          if (data.analysis.toLowerCase().includes('missing') || data.analysis.toLowerCase().includes('disconnect') || data.analysis.toLowerCase().includes('warning')) {
            overlayWarning.style.display = 'flex';
            document.getElementById('wire-detail').textContent = '⚠ Warning Detected';
          } else {
            overlayWarning.style.display = 'none';
            document.getElementById('wire-detail').textContent = 'All Connections Good';
          }

          if (data.audio_url) {
            const audio = new Audio(data.audio_url);
            audio.play();
          }
        }
      } catch (err) {
        thinkingProgress.style.display = 'none';
        setPipelineStage('pipe-voice');
        console.error('Vision analysis error:', err);
      }
    }, 'image/jpeg', 0.85);
  }

  // Auto-Inspect Toggle
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

  // Text Prompt
  btnSendText.addEventListener('click', sendTextMessage);
  textInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendTextMessage();
  });

  async function sendTextMessage() {
    const text = textInput.value.trim();
    if (!text) return;

    addChatMessage('YOU', text, 'user-msg');
    textInput.value = '';
    setPipelineStage('pipe-gemma');

    try {
      const res = await fetch('/chat/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text })
      });

      const data = await res.json();
      setPipelineStage('pipe-tts');
      addChatMessage('JARVIS', data.response, 'bot-msg');

      if (data.latency) {
        latLlm.textContent = (data.latency.llm_ms / 1000).toFixed(2) + 's';
        latTotal.textContent = (data.latency.total_ms / 1000).toFixed(2) + 's';
      }

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
        setPipelineStage('pipe-esp32');
      }

      setTimeout(() => setPipelineStage('pipe-voice'), 3000);
    } catch (err) {
      setPipelineStage('pipe-voice');
      console.error('Chat error:', err);
    }
  }

  // Voice Mic Recording
  btnRecordMic.addEventListener('click', async () => {
    if (!isRecordingMic) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
        mediaRecorder.onstop = async () => {
          setPipelineStage('pipe-stt');
          const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
          const formData = new FormData();
          formData.append('audio', audioBlob, 'mic_input.wav');

          try {
            const transRes = await fetch('/chat/voice', { method: 'POST', body: formData });
            const data = await transRes.json();
            setPipelineStage('pipe-reasoning');

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
              setPipelineStage('pipe-esp32');
            }

            setTimeout(() => setPipelineStage('pipe-voice'), 3000);
          } catch (err) {
            setPipelineStage('pipe-voice');
            console.error('Voice process error:', err);
          }
        };

        mediaRecorder.start();
        isRecordingMic = true;
        btnRecordMic.textContent = '⏹️ Stop';
        btnRecordMic.className = 'btn btn-danger';
        setPipelineStage('pipe-voice');
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

  // Volume Slider
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

  function setPipelineStage(stageId) {
    document.querySelectorAll('.pipe-step').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(stageId);
    if (target) target.classList.add('active');
  }
});
