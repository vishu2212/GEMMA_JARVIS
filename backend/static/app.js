document.addEventListener('DOMContentLoaded', () => {
  const mobileLiveFrame = document.getElementById('mobile-live-frame');
  const videoOverlay = document.getElementById('video-overlay');
  const thinkingProgress = document.getElementById('thinking-progress');
  const overlayWarning = document.getElementById('overlay-warning');
  
  const btnConnectPhone = document.getElementById('btn-connect-phone');
  const btnAnalyzeNow = document.getElementById('btn-analyze-now');
  const btnToggleLive = document.getElementById('btn-toggle-live');
  
  const qrModal = document.getElementById('qr-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const mobileUrl = document.getElementById('mobile-url');
  
  const statusPhone = document.getElementById('status-phone');
  const dotPhone = document.getElementById('dot-phone');
  const badgeFrameAge = document.getElementById('badge-frame-age');
  
  const diagnosisBox = document.getElementById('diagnosis-box');
  const severityDetail = document.getElementById('severity-detail');
  const fixDetail = document.getElementById('fix-detail');
  
  const textInput = document.getElementById('text-input');
  const btnSendText = document.getElementById('btn-send-text');
  const btnRecordMic = document.getElementById('btn-record-mic');
  const chatMessages = document.getElementById('chat-messages');
  
  const latUpload = document.getElementById('lat-upload');
  const latLlm = document.getElementById('lat-llm');
  const latTts = document.getElementById('lat-tts');
  const latTotal = document.getElementById('lat-total');
  
  const volSlider = document.getElementById('vol-slider');
  const volVal = document.getElementById('vol-val');
  
  let isLiveInspecting = false;
  let liveInspectInterval = null;
  let mediaRecorder = null;
  let audioChunks = [];
  let isRecordingMic = false;

  // 1. QR Modal Handler
  btnConnectPhone.addEventListener('click', () => {
    const hostIp = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? '192.168.1.111' : window.location.hostname;
    const fullUrl = `http://${hostIp}:${window.location.port || '8001'}/mobile`;
    mobileUrl.textContent = fullUrl;
    
    const qrImg = document.getElementById('qr-code-img');
    if (qrImg) {
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(fullUrl)}`;
    }
    qrModal.style.display = 'flex';
  });

  if (btnCloseModal) {
    btnCloseModal.addEventListener('click', () => {
      qrModal.style.display = 'none';
    });
  }

  // 1b. Technical Report Toggle
  const btnToggleTechReport = document.getElementById('btn-toggle-tech-report');
  if (btnToggleTechReport) {
    btnToggleTechReport.addEventListener('click', () => {
      if (diagnosisBox.style.display === 'none' || !diagnosisBox.style.display) {
        diagnosisBox.style.display = 'block';
        btnToggleTechReport.textContent = '▲ Hide Technical Analysis';
      } else {
        diagnosisBox.style.display = 'none';
        btnToggleTechReport.textContent = '▼ View Technical Analysis';
      }
    });
  }

  // 2. Poll /mobile/latest Every 1.5 Seconds for Live Phone Stream
  setInterval(async () => {
    try {
      const res = await fetch('/mobile/latest');
      if (res.ok) {
        const data = await res.json();
        
        // Update live captured image frame on PC monitor
        if (data.latest_image_url) {
          mobileLiveFrame.src = data.latest_image_url;
          mobileLiveFrame.style.display = 'block';
          videoOverlay.style.display = 'none';
        }

        if (data.phone_connected) {
          statusPhone.textContent = 'Connected';
          dotPhone.className = 'dot green';
          
          if (data.last_frame_age_ms >= 0) {
            const ageSec = (data.last_frame_age_ms / 1000).toFixed(1);
            badgeFrameAge.textContent = `Last Frame: ${ageSec}s ago`;
          }
          if (data.upload_latency_ms) {
            latUpload.textContent = `${data.upload_latency_ms} ms`;
          }
        } else {
          statusPhone.textContent = data.last_frame_age_ms > 0 ? 'Standby' : 'Waiting for /mobile...';
          dotPhone.className = data.last_frame_age_ms > 0 ? 'dot green' : 'dot red';
          if (data.last_frame_age_ms >= 0) {
            const ageSec = (data.last_frame_age_ms / 1000).toFixed(1);
            badgeFrameAge.textContent = `Last Frame: ${ageSec}s ago`;
          } else {
            badgeFrameAge.textContent = 'Last Frame: Offline';
          }
        }

        // Update Diagnosis Report if available
        if (data.latest_report && data.latest_report.raw_analysis) {
          diagnosisBox.innerHTML = `<p>${data.latest_report.raw_analysis}</p>`;
          if (data.latest_report.severity) severityDetail.textContent = data.latest_report.severity;
          if (data.latest_report.fix) fixDetail.textContent = data.latest_report.fix;
        }
      }
    } catch (e) {
      // silent poll catch
    }
  }, 1500);

  // 3. Analyze Latest Mobile Frame with Gemma 4 Vision
  btnAnalyzeNow.addEventListener('click', analyzeLatestMobileFrame);

  async function analyzeLatestMobileFrame() {
    thinkingProgress.style.display = 'flex';
    setPipelineStage('pipe-gemma');

    try {
      const res = await fetch('/vision/analyze_latest', { method: 'POST' });
      const data = await res.json();

      thinkingProgress.style.display = 'none';
      setPipelineStage('pipe-esp32');

      if (data.status === 'success') {
        diagnosisBox.innerHTML = `<p>${data.raw_analysis}</p>`;
        addChatMessage('Gemma 4 Mobile Vision', data.raw_analysis, 'bot-msg');

        severityDetail.textContent = data.severity;
        fixDetail.textContent = data.fix;

        const summaryText = document.getElementById('summary-text');
        const badgeHealthScore = document.getElementById('badge-health-score');
        const confidenceTag = document.getElementById('confidence-tag');

        if (data.overall_status === 'WARNING') {
          overlayWarning.style.display = 'flex';
          if (summaryText) summaryText.innerHTML = `✔ 4 Components detected &nbsp;•&nbsp; 🟠 Alert: Disconnection Found &nbsp;•&nbsp; ⚡ Fix: ${data.repair_time}`;
          if (badgeHealthScore) badgeHealthScore.textContent = `Health: ${data.health_score}/100 • 🟠 WARNING`;
          if (confidenceTag) confidenceTag.textContent = `Health: ${data.health_score}/100`;
        } else {
          overlayWarning.style.display = 'none';
          if (summaryText) summaryText.innerHTML = `✔ 4 Components detected &nbsp;•&nbsp; 🟢 Circuit Status: Healthy &nbsp;•&nbsp; ⚡ No repairs required`;
          if (badgeHealthScore) badgeHealthScore.textContent = `Health: ${data.health_score}/100 • 🟢 HEALTHY`;
          if (confidenceTag) confidenceTag.textContent = `Health: ${data.health_score}/100`;
        }

        if (data.upload_latency_ms) latUpload.textContent = `${data.upload_latency_ms} ms`;
        if (data.gemma_latency_ms) latLlm.textContent = `${(data.gemma_latency_ms / 1000).toFixed(2)} s`;
        if (data.tts_latency_ms) latTts.textContent = `${(data.tts_latency_ms / 1000).toFixed(2)} s`;
        if (data.latency_ms) latTotal.textContent = `${(data.latency_ms / 1000).toFixed(2)} s`;
      }
    } catch (err) {
      thinkingProgress.style.display = 'none';
      setPipelineStage('pipe-phone');
      console.error('Analyze error:', err);
    }
  }

  // 4. Live Inspection Mode Toggle
  btnToggleLive.addEventListener('click', () => {
    if (!isLiveInspecting) {
      isLiveInspecting = true;
      btnToggleLive.textContent = '⏹ Stop Live Inspection';
      btnToggleLive.className = 'btn btn-danger';
      analyzeLatestMobileFrame();
      liveInspectInterval = setInterval(analyzeLatestMobileFrame, 4000);
    } else {
      stopLiveInspection();
    }
  });

  function stopLiveInspection() {
    isLiveInspecting = false;
    if (liveInspectInterval) clearInterval(liveInspectInterval);
    btnToggleLive.textContent = '▶ Start Live Inspection';
    btnToggleLive.className = 'btn btn-outline';
  }

  // 5. Send Text Message
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
      addChatMessage('JARVIS', data.response, 'bot-msg', data.citations, data.tool_call);

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

      setTimeout(() => setPipelineStage('pipe-phone'), 3000);
    } catch (err) {
      setPipelineStage('pipe-phone');
      console.error('Chat error:', err);
    }
  }

  // 6. Mic Voice Recording
  btnRecordMic.addEventListener('click', async () => {
    if (!isRecordingMic) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
        mediaRecorder.onstop = async () => {
          setPipelineStage('pipe-fastapi');
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
              latLlm.textContent = (data.latency_profile.llm_ms / 1000).toFixed(2) + 's';
              latTts.textContent = (data.latency_profile.tts_ms / 1000).toFixed(2) + 's';
              latTotal.textContent = (data.latency_profile.total_ms / 1000).toFixed(2) + 's';
            }

            if (data.audio_url) {
              const audio = new Audio(data.audio_url);
              audio.play();
              setPipelineStage('pipe-esp32');
            }

            setTimeout(() => setPipelineStage('pipe-phone'), 3000);
          } catch (err) {
            setPipelineStage('pipe-phone');
            console.error('Voice process error:', err);
          }
        };

        mediaRecorder.start();
        isRecordingMic = true;
        btnRecordMic.textContent = '⏹ Stop';
        btnRecordMic.className = 'btn btn-danger';
        setPipelineStage('pipe-phone');
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

  // 7. Load & Upload RAG Engineering Datasheets
  const docChipsList = document.getElementById('doc-chips-list');
  const docUploadInput = document.getElementById('doc-upload-input');

  async function fetchDocsList() {
    try {
      const res = await fetch('/docs/list');
      if (res.ok) {
        const data = await res.json();
        if (data.documents && docChipsList) {
          docChipsList.innerHTML = data.documents.map(d => `<span class="doc-chip">📄 ${d.doc_id}</span>`).join('');
        }
      }
    } catch (e) {}
  }
  fetchDocsList();

  if (docUploadInput) {
    docUploadInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('/docs/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.status === 'success') {
          fetchDocsList();
          addChatMessage('JARVIS SYSTEM', `Successfully indexed datasheet '${file.name}' into RAG memory.`, 'system-msg');
        }
      } catch (err) {
        console.error('Doc upload error:', err);
      }
    });
  }

  // 8. Quick Tool Button Triggers
  document.querySelectorAll('.btn-tool-trigger').forEach(btn => {
    btn.addEventListener('click', async () => {
      const toolName = btn.getAttribute('data-tool');
      if (!toolName) return;
      try {
        const res = await fetch('/tools/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool_name: toolName })
        });
        const data = await res.json();
        if (data.status === 'success') {
          const summary = JSON.stringify(data.result);
          addChatMessage('SYSTEM', `Executed tool <code>${toolName}()</code>: ${summary}`, 'system-msg', null, { name: toolName, result: data.result });
        }
      } catch (err) {
        console.error('Tool execution error:', err);
      }
    });
  });

  // 9. Persistent Developer Memory Profile Loader
  const memoryChipsGrid = document.getElementById('memory-chips-grid');

  async function fetchUserMemory() {
    try {
      const res = await fetch('/memory');
      if (res.ok) {
        const data = await res.json();
        if (data.memory && memoryChipsGrid) {
          memoryChipsGrid.innerHTML = Object.entries(data.memory)
            .map(([k, v]) => `<span class="mem-chip">${k.replace('_', ' ').toUpperCase()}: <strong>${v}</strong></span>`)
            .join('');
        }
      }
    } catch (e) {}
  }
  fetchUserMemory();

  // Volume Slider
  volSlider.addEventListener('input', (e) => {
    volVal.textContent = e.target.value + '%';
  });

  // Helper Utilities
  function addChatMessage(sender, text, msgClass, citations = null, toolCall = null) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `msg ${msgClass}`;
    let citeHtml = '';
    if (citations && citations.length > 0) {
      citeHtml = citations.map(c => `<br/><span class="citation-tag">📄 Source: ${c.doc_id} (${c.title})</span>`).join(' ');
    }
    let toolHtml = '';
    if (toolCall && toolCall.name) {
      toolHtml = `<br/><span class="tool-call-badge">🛠️ Executed Tool: ${toolCall.name}()</span>`;
    }
    msgDiv.innerHTML = `<div class="msg-sender">${sender}</div><div class="msg-content">${text} ${toolHtml} ${citeHtml}</div>`;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function setPipelineStage(stageId) {
    document.querySelectorAll('.pipe-step').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(stageId);
    if (target) target.classList.add('active');
  }
});
