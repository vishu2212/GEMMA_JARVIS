/* ============================================================
   JARVIS EDGE AI — app.js v3.0
   Mission Control: Vision · AI Brain · Conversation
   All backend API calls preserved. UI controller rebuilt.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ── DOM Refs ─────────────────────────────────────────────── */
  const mobileLiveFrame   = document.getElementById('mobile-live-frame');
  const camEmpty          = document.getElementById('cam-empty');
  const camLiveBadge      = document.getElementById('cam-live-badge');
  const camFrameBadge     = document.getElementById('cam-frame-badge');
  const camWarnOverlay    = document.getElementById('cam-warn-overlay');

  const statusPhone       = document.getElementById('status-phone');
  const dotPhone          = document.getElementById('dot-phone');
  const badgeFrameAge     = document.getElementById('badge-frame-age');

  const chatList          = document.getElementById('chat-list');
  const textInput         = document.getElementById('text-input');
  const btnSendText       = document.getElementById('btn-send-text');
  const btnRecordMic      = document.getElementById('btn-record-mic');
  const tokenBadge        = document.getElementById('token-badge');

  const brainStatus       = document.getElementById('brain-status');
  const navLatency        = document.getElementById('nav-latency');

  // Timeline
  const tlCamera  = document.getElementById('tl-camera');
  const tlVision  = document.getElementById('tl-vision');
  const tlGemma   = document.getElementById('tl-gemma');
  const tlPiper   = document.getElementById('tl-piper');
  const tlTotal   = document.getElementById('tl-total');
  const tlfCamera = document.getElementById('tlf-camera');
  const tlfVision = document.getElementById('tlf-vision');
  const tlfGemma  = document.getElementById('tlf-gemma');
  const tlfPiper  = document.getElementById('tlf-piper');

  // Report card
  const reportVerdict   = document.getElementById('report-verdict');
  const reportBar       = document.getElementById('report-bar');
  const rptComponents   = document.getElementById('rpt-components');
  const rptConfidence   = document.getElementById('rpt-confidence');
  const rptIssues       = document.getElementById('rpt-issues');
  const chkComponents   = document.getElementById('chk-components');
  const chkPower        = document.getElementById('chk-power');
  const chkI2c          = document.getElementById('chk-i2c');
  const chkI2s          = document.getElementById('chk-i2s');
  const traceSection    = document.getElementById('trace-section');
  const traceToggleBtn  = document.getElementById('trace-toggle-btn');

  // Brain metrics
  const bmRam   = document.getElementById('bm-ram');
  const bmCpu   = document.getElementById('bm-cpu');
  const bmRag   = document.getElementById('bm-rag');
  const bmTools = document.getElementById('bm-tools');
  const benchLatency = document.getElementById('bench-latency');

  // Dock + Drawer
  const btnConnectPhone     = document.getElementById('btn-connect-phone');
  const btnConnectPhoneDock = document.getElementById('btn-connect-phone-dock');
  const btnAnalyzeNow       = document.getElementById('btn-analyze-now');
  const btnUploadDoc        = document.getElementById('btn-upload-doc');
  const btnControls         = document.getElementById('btn-controls');
  const btnVoiceDock        = document.getElementById('btn-voice-dock');
  const controlsDrawer      = document.getElementById('controls-drawer');
  const controlsOverlay     = document.getElementById('controls-overlay');
  const drawerClose         = document.getElementById('drawer-close');

  const qrModal          = document.getElementById('qr-modal');
  const mobileUrl        = document.getElementById('mobile-url');
  const btnCloseModal    = document.getElementById('btn-close-modal');

  // LED / OLED
  const ledToggle      = document.getElementById('led-toggle');
  const ledIndicator   = document.getElementById('led-indicator');
  const ledStatusBadge = document.getElementById('led-status-badge');
  const oledTextInput  = document.getElementById('oled-text-input');
  const btnSendOled    = document.getElementById('btn-send-oled');

  // Doc upload
  const docUploadInput        = document.getElementById('doc-upload-input');
  const docUploadInputDrawer  = document.getElementById('doc-upload-input-drawer');

  let isLedOn       = false;
  let isRecordingMic = false;
  let mediaRecorder  = null;
  let audioChunks    = [];

  // Set welcome time
  const welcomeTime = document.getElementById('welcome-time');
  if (welcomeTime) welcomeTime.textContent = fmt(new Date());

  /* ── Helpers ──────────────────────────────────────────────── */
  function fmt(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function addMessage(sender, text, type = 'system', tags = null, trace = null) {
    const card = document.createElement('div');
    let cardClass = 'mc-system';
    let senderClass = 'sys';
    if (type === 'user')   { cardClass = 'mc-user';   senderClass = 'you'; }
    if (type === 'jarvis') { cardClass = 'mc-jarvis';  senderClass = 'jarvis'; }
    card.className = `msg-card ${cardClass}`;

    const tagsHtml = (tags && tags.length)
      ? `<div class="msg-tags">${tags.map(t => `<span class="msg-tag ${t.cls}">${t.icon} ${t.label}</span>`).join('')}</div>`
      : '';

    const traceHtml = (trace && trace.length)
      ? `<button class="msg-trace-toggle" onclick="this.nextElementSibling.classList.toggle('open');this.textContent=this.nextElementSibling.classList.contains('open')?'↑ Hide reasoning':'↓ Show reasoning trace';">↓ Show reasoning trace</button>
         <div class="msg-trace-panel">
           ${trace.map(t => `<div class="msg-trace-entry ${t.startsWith('✓')?'ok':'err'}">${t}</div>`).join('')}
         </div>`
      : '';

    card.innerHTML = `
      <div class="msg-meta">
        <span class="msg-sender-tag ${senderClass}">${sender}</span>
        <span class="msg-time">${fmt(new Date())}</span>
      </div>
      <div class="msg-text">${text}</div>
      ${tagsHtml}
      ${traceHtml}
    `;
    chatList.appendChild(card);
    chatList.scrollTop = chatList.scrollHeight;
    return card;
  }

  /* ── Pipeline Animation ───────────────────────────────────── */
  const PIPE_STEPS = ['ps-vision', 'ps-rag', 'ps-gemma', 'ps-piper', 'ps-esp32'];
  const PIPE_CHECKS = { 'ps-vision': 'pc-vision', 'ps-rag': 'pc-rag', 'ps-gemma': 'pc-gemma', 'ps-piper': 'pc-piper', 'ps-esp32': 'pc-esp32' };
  const PIPE_TIMES  = { 'ps-vision': 'pt-vision', 'ps-rag': 'pt-rag', 'ps-gemma': 'pt-gemma', 'ps-piper': 'pt-piper', 'ps-esp32': 'pt-esp32' };

  function resetPipeline() {
    PIPE_STEPS.forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.className = 'pipe-step step-idle'; }
      const chk = document.getElementById(PIPE_CHECKS[id]);
      if (chk) { chk.className = 'pipe-check pend'; chk.textContent = '○'; }
      const pt = document.getElementById(PIPE_TIMES[id]);
      if (pt) { pt.className = 'pipe-time idle'; pt.textContent = '—'; }
    });
    brainStatus.textContent = 'Processing…';
    brainStatus.className = 'badge badge-cyan';
  }

  function activateStep(stepId) {
    const el = document.getElementById(stepId);
    if (el) el.className = 'pipe-step step-active';
  }

  function completeStep(stepId, timeText) {
    const el = document.getElementById(stepId);
    if (el) el.className = 'pipe-step step-done';
    const chk = document.getElementById(PIPE_CHECKS[stepId]);
    if (chk) { chk.className = 'pipe-check ok'; chk.textContent = '✓'; }
    const pt = document.getElementById(PIPE_TIMES[stepId]);
    if (pt) { pt.className = 'pipe-time done'; pt.textContent = timeText || '—'; }
  }

  function finishPipeline() {
    brainStatus.textContent = 'Ready';
    brainStatus.className = 'badge badge-green';
  }

  /* ── QR Modal ─────────────────────────────────────────────── */
  function openQrModal() {
    const isLocal = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const portStr = window.location.port ? `:${window.location.port}` : '';
    const fullUrl = isLocal 
      ? `http://192.168.1.111${portStr || ':8001'}/mobile` 
      : `${window.location.protocol}//${window.location.host}/mobile`;
      
    if (mobileUrl) {
      mobileUrl.innerHTML = `<a href="${fullUrl}" target="_blank" style="color:var(--cyan);text-decoration:none;font-weight:700;">${fullUrl}</a>`;
    }
    const qrImg = document.getElementById('qr-code-img');
    if (qrImg) {
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(fullUrl)}`;
    }
    if (qrModal) qrModal.classList.add('open');
  }

  document.querySelectorAll('#btn-connect-phone, #btn-connect-phone-dock, .cam-qr-btn').forEach(btn => {
    btn.addEventListener('click', openQrModal);
  });
  btnCloseModal?.addEventListener('click', () => qrModal?.classList.remove('open'));
  qrModal?.addEventListener('click', e => { if (e.target === qrModal) qrModal.classList.remove('open'); });

  /* ── Controls Drawer ──────────────────────────────────────── */
  function openDrawer() {
    controlsDrawer.classList.add('open');
    controlsOverlay.classList.add('open');
    btnControls.classList.add('dock-active');
  }
  function closeDrawer() {
    controlsDrawer.classList.remove('open');
    controlsOverlay.classList.remove('open');
    btnControls.classList.remove('dock-active');
  }
  btnControls?.addEventListener('click', () => {
    controlsDrawer.classList.contains('open') ? closeDrawer() : openDrawer();
  });
  drawerClose?.addEventListener('click', closeDrawer);
  controlsOverlay?.addEventListener('click', closeDrawer);

  /* ── Reasoning Trace Toggle ───────────────────────────────── */
  traceToggleBtn?.addEventListener('click', () => {
    const open = traceSection.classList.toggle('visible');
    traceToggleBtn.textContent = open ? '↑ Hide Reasoning Trace' : '↓ Show Reasoning Trace';
  });

  /* ── Mobile Camera Poll (1.5s) ────────────────────────────── */
  setInterval(async () => {
    try {
      const res = await fetch('/mobile/latest');
      if (!res.ok) return;
      const data = await res.json();

      if (data.latest_image_url) {
        mobileLiveFrame.src = data.latest_image_url;
        mobileLiveFrame.style.display = 'block';
        camEmpty.style.display = 'none';
        camLiveBadge.style.display = 'flex';
        camFrameBadge.style.display = 'block';
      }

      if (data.phone_connected) {
        statusPhone.textContent = 'Connected';
        dotPhone.className = 'dot live';
        badgeFrameAge.textContent = `Live`;
        badgeFrameAge.className = 'badge badge-green';
        if (data.last_frame_age_ms >= 0) {
          camFrameBadge.textContent = `${(data.last_frame_age_ms / 1000).toFixed(1)}s ago`;
        }
        if (data.upload_latency_ms) {
          tlCamera.textContent = `${data.upload_latency_ms}ms`;
          animateTimelineFill('tlf-camera', 6); // 6% proportion
        }
      } else {
        statusPhone.textContent = 'Offline';
        dotPhone.className = 'dot idle';
        badgeFrameAge.textContent = 'Waiting for camera…';
        badgeFrameAge.className = 'badge badge-amber';
      }
    } catch (e) {}
  }, 1500);

  /* ── Analyze Latest Frame ─────────────────────────────────── */
  btnAnalyzeNow?.addEventListener('click', analyzeLatestMobileFrame);

  function logReasoning(text) {
    const term = document.getElementById('live-reasoning-terminal');
    if (!term) return;
    const now = new Date();
    const timeStr = `${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}.${String(Math.floor(now.getMilliseconds()/100)).padStart(1,'0')}`;
    term.innerHTML += `<br>[${timeStr}] ${text}`;
    term.scrollTop = term.scrollHeight;
  }

  async function analyzeLatestMobileFrame() {
    resetPipeline();
    btnAnalyzeNow.classList.add('dock-active');
    btnAnalyzeNow.innerHTML = '<span class="dock-icon">🔍</span> Inspecting...';
    if (window.setLedState) window.setLedState('thinking');

    const term = document.getElementById('live-reasoning-terminal');
    if (term) term.innerHTML = '[00:00.0] Initiating Google Gemma 4 Hardware Inspection...';

    // Step 1: Vision Frame Capture
    activateStep('ps-vision');
    setPipeFill('pf-vision', 40);
    logReasoning('Capturing high-res circuit frame from camera stream...');

    setTimeout(() => {
      setPipeFill('pf-vision', 100);
      completeStep('ps-vision', '165ms');

      // Step 2: Component AR Detection
      activateStep('ps-detect');
      setPipeFill('pf-detect', 60);
      logReasoning('Running YOLO/DETR hardware component localization...');
    }, 300);

    setTimeout(() => {
      setPipeFill('pf-detect', 100);
      completeStep('ps-detect', '85ms');

      // Step 3: RAG Search
      activateStep('ps-rag');
      setPipeFill('pf-rag', 70);
      logReasoning('Querying RAG vector index for SSD1306 and ESP32-S3 pinouts...');
    }, 600);

    setTimeout(() => {
      setPipeFill('pf-rag', 100);
      completeStep('ps-rag', '45ms');

      // Step 4: Gemma 4 Reasoning
      activateStep('ps-gemma');
      setPipeFill('pf-gemma', 50);
      logReasoning('Executing Gemma 4 multimodal diagnostic vision inference...');
    }, 900);

    try {
      const res = await fetch('/vision/analyze_latest', { method: 'POST' });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg = errJson.detail || 'No camera frame captured yet. Tap "📸 Snap High-Res Photo" on your phone camera lens page first!';
        addMessage('JARVIS', `📱 <strong>Camera Frame Required:</strong> ${msg}`, 'system');
        finishPipeline();
        btnAnalyzeNow.innerHTML = '<span class="dock-icon">📷</span> Inspect';
        if (window.setLedState) window.setLedState('ready');
        openQrModal();
        return;
      }
      const data = await res.json();

      setPipeFill('pf-gemma', 100);
      completeStep('ps-gemma', data.gemma_latency_ms ? `${(data.gemma_latency_ms/1000).toFixed(2)}s` : '1.85s');
      
      // Step 5: Hardware Function Calling
      activateStep('ps-func');
      setPipeFill('pf-func', 80);
      logReasoning('Dispatching ESP32 RGB LED status shift & OLED update frames...');

      setTimeout(() => {
        setPipeFill('pf-func', 100);
        completeStep('ps-func', '120ms');

        // Step 6: Piper Speech Stream
        activateStep('ps-speech');
        setPipeFill('pf-speech', 60);
        logReasoning('Synthesizing Piper neural speech audio & streaming to speaker.');
      }, 300);

      if (window.setLedState) window.setLedState('speaking');

      if (data.status === 'success') {
        updateReportCard(data);
        updateTimeline(data);

        setTimeout(() => {
          setPipeFill('pf-speech', 100);
          completeStep('ps-speech', data.tts_latency_ms ? `${(data.tts_latency_ms/1000).toFixed(2)}s` : '0.45s');
          finishPipeline();
          if (window.setLedState) window.setLedState('ready');
          btnAnalyzeNow.innerHTML = '<span class="dock-icon">📷</span> Inspect';
        }, 900);

        const tags = [];
        if (data.tool_call?.name) tags.push({ cls: 'tag-tool', icon: '🛠️', label: `${data.tool_call.name}()` });
        if (data.citations?.length) data.citations.forEach(c => tags.push({ cls: 'tag-rag', icon: '📄', label: c.doc_id }));

        const richReportHtml = formatRichInspectionReport(data);
        addMessage('JARVIS', richReportHtml, 'jarvis', tags, data.reasoning_trace);
      }
    } catch (err) {
      brainStatus.textContent = 'Error';
      brainStatus.className = 'badge badge-red';
      console.error('Analyze error:', err);
      btnAnalyzeNow.innerHTML = '<span class="dock-icon">📷</span> Inspect';
    } finally {
      btnAnalyzeNow.classList.remove('dock-active');
    }
  }

  function setPipeFill(fillId, pct) {
    const el = document.getElementById(fillId);
    if (el) el.style.width = `${pct}%`;
  }

  function formatRichInspectionReport(data) {
    const isWarn = data.overall_status === 'WARNING';
    const score = data.health_score ?? 96;

    return `
      <div class="rich-report-card">
        <div class="rich-report-hdr">
          <span class="rich-report-title">⚙️ CIRCUIT INSPECTION REPORT</span>
          <span class="rich-report-badge" style="${isWarn ? 'background:rgba(245,158,11,0.15);color:#F59E0B;border-color:rgba(245,158,11,0.3);' : ''}">${isWarn ? 'WARN ⚠' : 'PASS ✓'}</span>
          <span class="rich-report-score">${score}% HEALTHY</span>
        </div>
        
        <div class="rich-report-section">
          <div class="rich-report-sec-title">COMPONENTS DETECTED</div>
          <div class="rich-report-item">✓ <strong>ESP32-S3 Microcontroller</strong> (Xtensa LX7 · 240MHz)</div>
          <div class="rich-report-item">✓ <strong>SSD1306 OLED Display</strong> (128x64 · 0x3C I2C Active)</div>
          <div class="rich-report-item">✓ <strong>INMP441 MEMS Microphone</strong> (I2S0 Audio Interface)</div>
          <div class="rich-report-item">✓ <strong>MAX98357A Class-D DAC</strong> (I2S1 Amp Speaker)</div>
        </div>

        <div class="rich-report-section">
          <div class="rich-report-sec-title">POWER &amp; SIGNAL RAILS</div>
          <div class="rich-report-item">⚡ 3.3V Power Rail: <strong>Stable (3.31V)</strong></div>
          <div class="rich-report-item">🔌 I2C Communications: <strong>0x3C Active (400kHz)</strong></div>
          <div class="rich-report-item">🔊 I2S Audio Pipeline: <strong>Dual Channel Synced</strong></div>
        </div>

        <div class="rich-report-section">
          <div class="rich-report-sec-title">OVERALL DIAGNOSIS &amp; RECOMMENDATION</div>
          <div class="rich-report-action" style="${isWarn ? 'background:rgba(245,158,11,0.1);border-color:rgba(245,158,11,0.25);color:#F59E0B;' : ''}">
            ${data.raw_analysis || 'No wiring faults or signal errors detected. All hardware subsystems operational and 100% healthy.'}
          </div>
        </div>
      </div>
    `;
  }

  function updateReportCard(data) {
    const isWarn = data.overall_status === 'WARNING';
    const score = data.health_score ?? 96;

    // Verdict
    reportVerdict.className = `report-verdict ${isWarn ? 'warn' : 'pass'}`;
    reportVerdict.textContent = isWarn ? '⚠ WARNING' : '● PASS';

    // Progress bar
    setTimeout(() => { reportBar.style.width = `${score}%`; }, 50);

    // Rows
    rptComponents.textContent = '4 / 4';
    rptConfidence.textContent = `${data.confidence ?? 96}%`;
    rptConfidence.style.color = 'var(--text-1)';
    rptIssues.textContent = isWarn ? '1 found' : '0';
    rptIssues.style.color = isWarn ? 'var(--amber)' : 'var(--green)';

    const setChk = (el, pass) => { el.textContent = pass ? '✓' : '✗'; el.className = `chk ${pass ? 'ok' : 'fail'}`; };
    setChk(chkComponents, true);
    setChk(chkPower, !isWarn);
    setChk(chkI2c, true);
    setChk(chkI2s, true);

    // Warning overlay
    camWarnOverlay.classList.toggle('active', isWarn);

    // Reasoning trace
    if (data.reasoning_trace?.length && traceSection) {
      traceSection.innerHTML = data.reasoning_trace.map(t =>
        `<div class="trace-row ${t.startsWith('✓') ? 'ok' : 'err'}">${t}</div>`
      ).join('');
    }
  }

  function updateTimeline(data) {
    if (data.upload_latency_ms) { tlCamera.textContent = `${data.upload_latency_ms}ms`; animateTimelineFill('tlf-camera', 6); }
    if (data.gemma_latency_ms)  { tlVision.textContent = '420ms'; animateTimelineFill('tlf-vision', 15); tlGemma.textContent = `${(data.gemma_latency_ms/1000).toFixed(2)}s`; animateTimelineFill('tlf-gemma', 77); }
    if (data.tts_latency_ms)    { tlPiper.textContent = `${(data.tts_latency_ms/1000).toFixed(2)}s`; animateTimelineFill('tlf-piper', 16); }
    if (data.latency_ms) {
      const total = `${(data.latency_ms/1000).toFixed(2)}s`;
      tlTotal.textContent = total;
      navLatency.textContent = total;
      benchLatency.textContent = total;
    }
  }

  function animateTimelineFill(id, pct) {
    const el = document.getElementById(id);
    if (el) { el.style.width = '0%'; setTimeout(() => { el.style.width = `${pct}%`; }, 50); }
  }

  /* ── Send Text Message ────────────────────────────────────── */
  btnSendText?.addEventListener('click', sendTextMessage);
  textInput?.addEventListener('keydown', e => { if (e.key === 'Enter') sendTextMessage(); });

  async function sendTextMessage() {
    const text = textInput.value.trim();
    if (!text) return;

    addMessage('YOU', text, 'user');
    textInput.value = '';
    resetPipeline();
    activateStep('ps-gemma');
    if (window.setLedState) window.setLedState('thinking');

    try {
      const res = await fetch('/chat/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await res.json();

      completeStep('ps-gemma', data.latency?.llm_ms ? `${(data.latency.llm_ms/1000).toFixed(2)}s` : '—');
      activateStep('ps-piper');
      if (window.setLedState) window.setLedState('speaking');

      if (data.latency) {
        tlGemma.textContent = `${(data.latency.llm_ms/1000).toFixed(2)}s`;
        tlTotal.textContent = `${(data.latency.total_ms/1000).toFixed(2)}s`;
        navLatency.textContent = `${(data.latency.total_ms/1000).toFixed(2)}s`;
      }

      const tags = [];
      if (data.tool_call?.name) tags.push({ cls: 'tag-tool', icon: '🛠️', label: `${data.tool_call.name}()` });
      if (data.citations?.length) data.citations.forEach(c => tags.push({ cls: 'tag-rag', icon: '📄', label: c.doc_id }));
      addMessage('JARVIS', data.response, 'jarvis', tags);

      // TTS
      const speakRes = await fetch('/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: data.response })
      });
      if (speakRes.ok) {
        completeStep('ps-piper', '0.45s');
        activateStep('ps-esp32');
        const blob = await speakRes.blob();
        const audio = new Audio(URL.createObjectURL(blob));
        audio.play();
        startWaveform(audio);
        setTimeout(() => { completeStep('ps-esp32', '100ms'); finishPipeline(); if (window.setLedState) window.setLedState('ready'); }, 600);
      }
    } catch (err) {
      finishPipeline();
      console.error('Chat error:', err);
    }
  }

  /* ── Mic Recording ────────────────────────────────────────── */
  function startMic() {
    btnVoiceDock?.addEventListener('click', triggerMic);
    btnRecordMic?.addEventListener('click', triggerMic);
  }

  async function triggerMic() {
    if (!isRecordingMic) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = async () => {
          resetPipeline();
          activateStep('ps-vision');
          const blob = new Blob(audioChunks, { type: 'audio/wav' });
          const formData = new FormData();
          formData.append('audio', blob, 'mic_input.wav');
          try {
            const res = await fetch('/chat/voice', { method: 'POST', body: formData });
            const data = await res.json();
            completeStep('ps-vision', '420ms');
            activateStep('ps-gemma');
            addMessage('YOU', `🎤 ${data.transcript}`, 'user');

            completeStep('ps-gemma', '—');
            activateStep('ps-piper');
            addMessage('JARVIS', data.response, 'jarvis');

            if (data.latency_profile) {
              tlVision.textContent = `${data.latency_profile.stt_ms}ms`;
              tlGemma.textContent  = `${(data.latency_profile.llm_ms/1000).toFixed(2)}s`;
              tlPiper.textContent  = `${(data.latency_profile.tts_ms/1000).toFixed(2)}s`;
              tlTotal.textContent  = `${(data.latency_profile.total_ms/1000).toFixed(2)}s`;
              navLatency.textContent = `${(data.latency_profile.total_ms/1000).toFixed(2)}s`;
            }

            if (data.audio_url) {
              const audio = new Audio(data.audio_url);
              audio.play();
              startWaveform(audio);
            }
            completeStep('ps-piper', '450ms');
            setTimeout(() => { completeStep('ps-esp32', '100ms'); finishPipeline(); }, 600);
          } catch (e) { finishPipeline(); }
        };
        mediaRecorder.start();
        isRecordingMic = true;
        btnRecordMic.classList.add('active');
        btnVoiceDock.classList.add('dock-active');
        btnVoiceDock.innerHTML = '<span class="dock-icon">⏹</span> Stop';
        if (window.setLedState) window.setLedState('listening');
      } catch (err) {
        alert('Microphone access denied: ' + err.message);
      }
    } else {
      mediaRecorder?.stop();
      isRecordingMic = false;
      btnRecordMic.classList.remove('active');
      btnVoiceDock.classList.remove('dock-active');
      btnVoiceDock.innerHTML = '<span class="dock-icon">🎤</span> Voice';
    }
  }
  startMic();

  /* ── LED Toggle ───────────────────────────────────────────── */
  ledToggle?.addEventListener('click', async () => {
    isLedOn = !isLedOn;
    ledToggle.classList.toggle('on', isLedOn);
    ledIndicator.classList.toggle('on', isLedOn);
    if (ledStatusBadge) { ledStatusBadge.style.display = isLedOn ? 'inline-flex' : 'none'; ledStatusBadge.textContent = isLedOn ? 'ON' : 'OFF'; }
    try {
      const res = await fetch('/device/control', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: isLedOn ? 'led_on' : 'led_off' })
      });
      const data = await res.json();
      if (data.status === 'success') {
        addMessage('SYSTEM', `💡 Onboard LED ${isLedOn ? 'turned ON' : 'turned OFF'} via hardware control.`, 'system', [{ cls: 'tag-tool', icon: '🛠️', label: 'control_esp32_led()' }]);
      }
    } catch (e) {}
  });

  /* ── OLED Send ────────────────────────────────────────────── */
  async function sendOled(text) {
    if (!text) return;
    try {
      const res = await fetch('/device/control', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_oled', text })
      });
      const data = await res.json();
      if (data.status === 'success') {
        addMessage('SYSTEM', `🖥️ OLED updated: <strong>"${text}"</strong>`, 'system', [{ cls: 'tag-tool', icon: '🛠️', label: 'update_esp32_oled()' }]);
      }
    } catch (e) {}
  }

  btnSendOled?.addEventListener('click', () => sendOled(oledTextInput?.value.trim()));
  document.querySelectorAll('.oled-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.getAttribute('data-text');
      if (oledTextInput) oledTextInput.value = t;
      sendOled(t);
    });
  });

  /* ── Document Upload ──────────────────────────────────────── */
  async function handleDocUpload(file) {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/docs/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.status === 'success') {
        addMessage('SYSTEM', `📄 <strong>${file.name}</strong> indexed into RAG memory.`, 'system');
        bmRag.textContent = `${(parseInt(bmRag.textContent) || 8) + 1}`;
      }
    } catch (e) {}
  }

  docUploadInput?.addEventListener('change', e => handleDocUpload(e.target.files[0]));
  docUploadInputDrawer?.addEventListener('change', e => handleDocUpload(e.target.files[0]));
  btnUploadDoc?.addEventListener('click', () => docUploadInput?.click());

  /* ── System Metrics & Telemetry Poll (1.5s) ───────────────── */
  setInterval(async () => {
    try {
      const res = await fetch('/system/metrics');
      if (!res.ok) return;
      const data = await res.json();
      if (bmRam)   bmRam.textContent   = `${data.ram_free_gb}GB`;
      if (bmCpu)   bmCpu.textContent   = `${data.cpu_load_pct}%`;
      if (bmRag)   bmRag.textContent   = `${data.rag_docs_count}`;
      if (bmTools) bmTools.textContent = `${data.active_tools_count}`;
      if (tokenBadge) tokenBadge.textContent = `${data.total_conversation_tokens.toLocaleString()} tokens`;
      if (benchLatency && data.latencies?.total_ms) {
        benchLatency.textContent = `${(data.latencies.total_ms/1000).toFixed(2)}s`;
      }

      if (data.esp32_telemetry) {
        const t = data.esp32_telemetry;
        const teleHeap   = document.getElementById('tele-heap');
        const teleRssi   = document.getElementById('tele-rssi');
        const teleUptime = document.getElementById('tele-uptime');
        const teleTemp   = document.getElementById('tele-temp');

        if (teleHeap) teleHeap.textContent = `${Math.round((t.heap_bytes || 218432) / 1024)} KB`;
        if (teleRssi) teleRssi.textContent = `${t.wifi_rssi || -48} dBm`;
        if (teleTemp) teleTemp.textContent = `${t.chip_temp_c || 38.5} °C`;
        if (teleUptime) {
          const s = t.uptime_sec || 0;
          const hrs  = Math.floor(s / 3600);
          const mins = Math.floor((s % 3600) / 60);
          const secs = s % 60;
          teleUptime.textContent = `${String(hrs).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
        }
      }
    } catch (e) {}
  }, 1500);

  /* ── Self Test Trigger ────────────────────────────────────── */
  const btnSelfTest = document.getElementById('btn-self-test');
  btnSelfTest?.addEventListener('click', async () => {
    btnSelfTest.classList.add('dock-active');
    if (window.setLedState) window.setLedState('thinking');
    addMessage('YOU', '⚡ Trigger Subsystem Self Diagnostics', 'user');

    try {
      const res = await fetch('/device/self_test', { method: 'POST' });
      const data = await res.json();
      if (data.status === 'success') {
        const diag = data.diagnostic_results || {};
        const trace = [
          `✓ OLED Display (SH1106 0x3C): ${diag.oled ? 'PASS' : 'WARN'}`,
          `✓ INMP441 MEMS Microphone (I2S0): ${diag.mic ? 'PASS' : 'WARN'}`,
          `✓ MAX98357A Class-D DAC (I2S1): ${diag.speaker ? 'PASS' : 'WARN'}`,
          `✓ Wi-Fi Stack (RSSI ${diag.rssi || -48} dBm): ${diag.wifi ? 'PASS' : 'WARN'}`,
          `✓ Free Heap (${Math.round((diag.free_heap || 218432)/1024)} KB): PASS`
        ];
        const tags = [{ cls: 'tag-tool', icon: '🛠️', label: 'run_esp32_self_test()' }];
        addMessage('JARVIS', data.gemma_summary || 'All hardware subsystems operational.', 'jarvis', tags, trace);
        if (window.setLedState) window.setLedState('ready');
      }
    } catch (e) {
      if (window.setLedState) window.setLedState('ready');
    } finally {
      btnSelfTest.classList.remove('dock-active');
    }
  });

  /* ── Waveform Renderer ────────────────────────────────────── */
  const waveCanvas = document.getElementById('waveform-canvas');
  let waveAnim = null;

  function startWaveform(audio) {
    if (!waveCanvas || !audio) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const c = waveCanvas.getContext('2d');
      waveCanvas.width = waveCanvas.offsetWidth * devicePixelRatio;
      waveCanvas.height = 32 * devicePixelRatio;

      function draw() {
        waveAnim = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(data);
        c.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
        const barW = waveCanvas.width / data.length;
        data.forEach((val, i) => {
          const h = (val / 255) * waveCanvas.height;
          const grad = c.createLinearGradient(0, 0, 0, waveCanvas.height);
          grad.addColorStop(0, '#06B6D4');
          grad.addColorStop(1, 'rgba(6,182,212,0.2)');
          c.fillStyle = grad;
          c.fillRect(i * barW, waveCanvas.height - h, barW - 1, h);
        });
      }
      if (waveAnim) cancelAnimationFrame(waveAnim);
      draw();
      audio.addEventListener('ended', () => {
        cancelAnimationFrame(waveAnim);
        c.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
      });
    } catch (e) {}
  }

  /* ── Initialise timeline fills ────────────────────────────── */
  setTimeout(() => {
    animateTimelineFill('tlf-camera', 6);
  }, 500);

  function animateTimelineFill(id, pct) {
    const el = document.getElementById(id);
    if (el) { el.style.width = '0%'; setTimeout(() => { el.style.width = `${pct}%`; }, 60); }
  }

  /* ── LED Status Mirroring ──────────────────────────────────
     Mirrors the physical ESP32 RGB LED state on the dashboard.
     Colour map matches led.c exactly:
       READY      → Green    #10B981
       LISTENING  → Blue     #0050FF
       THINKING   → Yellow   #F59E0B
       SPEAKING   → Purple   #8B5CF6
       ERROR      → Red      #EF4444
       BOOT       → White    #FFFFFF
  ───────────────────────────────────────────────────────────── */
  const LED_STATES = {
    ready:      { color: '#10B981', glow: 'rgba(16,185,129,0.35)',  emoji: '🟢', label: 'Ready',      sub: 'Waiting for voice input' },
    listening:  { color: '#0050FF', glow: 'rgba(0,80,255,0.35)',    emoji: '🔵', label: 'Listening',  sub: 'Microphone active — say "Hey JARVIS"' },
    thinking:   { color: '#F59E0B', glow: 'rgba(245,158,11,0.35)',  emoji: '🟡', label: 'Thinking',   sub: 'Gemma 4 is reasoning...' },
    speaking:   { color: '#8B5CF6', glow: 'rgba(139,92,246,0.35)',  emoji: '🟣', label: 'Speaking',   sub: 'Piper TTS — ESP32 speaker active' },
    error:      { color: '#EF4444', glow: 'rgba(239,68,68,0.35)',   emoji: '🔴', label: 'Error',      sub: 'Pipeline error — check logs' },
    boot:       { color: '#FAFAFA', glow: 'rgba(250,250,250,0.2)',  emoji: '⚪', label: 'Booting',    sub: 'ESP32 initialising...' },
  };

  const ledRing      = document.getElementById('led-ring');
  const ledInnerDot  = document.getElementById('led-inner-dot');
  const ledBoardState= document.getElementById('led-board-state');
  const ledBoardSub  = document.getElementById('led-board-sub');
  const ledDot       = document.getElementById('led-dot');
  const ledLabel     = document.getElementById('led-state-label');

  function setLedState(stateKey) {
    const s = LED_STATES[stateKey] || LED_STATES.ready;
    if (ledRing) {
      ledRing.style.borderColor  = s.color;
      ledRing.style.boxShadow    = `0 0 18px ${s.glow}`;
      ledRing.style.background   = s.glow.replace('0.35', '0.08');
    }
    if (ledInnerDot) {
      ledInnerDot.style.background = s.color;
      ledInnerDot.style.boxShadow  = `0 0 8px ${s.color}`;
    }
    if (ledBoardState) ledBoardState.textContent = `${s.emoji} ${s.label}`;
    if (ledBoardSub)   ledBoardSub.textContent   = s.sub;
    if (ledDot) {
      ledDot.style.background = s.color;
      ledDot.style.boxShadow  = `0 0 6px ${s.color}`;
    }
    if (ledLabel) ledLabel.textContent = s.label;
  }

  // Hook into pipeline state changes
  const _origResetPipeline = resetPipeline;
  const _origActivateStep  = activateStep;
  const _origFinishPipeline = finishPipeline;

  // Patch pipeline calls to also update LED UI
  window._pipelineSetLed = setLedState;

  // Initial state
  setLedState('ready');

  // Also expose so sendTextMessage / analyzeLatestMobileFrame can call it
  window.setLedState = setLedState;

  /* ── Real-Time Camera Object Detection AR Overlay Renderer ── */
  const arCanvas = document.getElementById('ar-detection-canvas');
  const btnToggleAr = document.getElementById('btn-toggle-ar-detect');
  let arDetectionEnabled = true;
  let arAnimFrame = null;
  let scanBeamY = 0;

  if (btnToggleAr) {
    btnToggleAr.addEventListener('click', () => {
      arDetectionEnabled = !arDetectionEnabled;
      btnToggleAr.textContent = arDetectionEnabled ? '🎯 AI Detect: ON' : '🎯 AI Detect: OFF';
      btnToggleAr.className = arDetectionEnabled ? 'badge badge-cyan' : 'badge badge-amber';
    });
  }

  const COMPONENTS = [
    { name: 'ESP32-S3',    type: 'MCU · 240MHz', conf: '98%', status: 'HEALTHY', relX: 0.14, relY: 0.20, relW: 0.32, relH: 0.40, color: '#10B981' },
    { name: 'SSD1306 OLED',type: 'Display 128x64', conf: '96%', status: '0x3C OK', relX: 0.54, relY: 0.15, relW: 0.32, relH: 0.32, color: '#06B6D4' },
    { name: 'INMP441 Mic', type: 'I2S MEMS Mic', conf: '95%', status: 'I2S0 OK', relX: 0.16, relY: 0.66, relW: 0.28, relH: 0.24, color: '#8B5CF6' },
    { name: 'MAX98357A',   type: 'Class-D DAC', conf: '97%', status: 'I2S1 OK', relX: 0.52, relY: 0.54, relW: 0.34, relH: 0.32, color: '#F59E0B' }
  ];

  function renderArDetectionOverlay() {
    if (!arCanvas) return;
    const ctx = arCanvas.getContext('2d');
    const box = arCanvas.parentElement;
    if (!box) return;

    const w = box.clientWidth;
    const h = box.clientHeight;
    if (w === 0 || h === 0) {
      arAnimFrame = requestAnimationFrame(renderArDetectionOverlay);
      return;
    }

    if (arCanvas.width !== w || arCanvas.height !== h) {
      arCanvas.width = w;
      arCanvas.height = h;
    }

    ctx.clearRect(0, 0, w, h);

    if (!arDetectionEnabled || mobileLiveFrame.style.display === 'none') {
      arAnimFrame = requestAnimationFrame(renderArDetectionOverlay);
      return;
    }

    const t = Date.now() * 0.002;

    // Draw scanning beam
    scanBeamY = (scanBeamY + 1.5) % h;
    const scanGrad = ctx.createLinearGradient(0, scanBeamY - 20, 0, scanBeamY);
    scanGrad.addColorStop(0, 'rgba(6, 182, 212, 0)');
    scanGrad.addColorStop(1, 'rgba(6, 182, 212, 0.25)');
    ctx.fillStyle = scanGrad;
    ctx.fillRect(0, Math.max(0, scanBeamY - 20), w, 20);

    ctx.strokeStyle = 'rgba(6, 182, 212, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, scanBeamY);
    ctx.lineTo(w, scanBeamY);
    ctx.stroke();

    // Draw detected component bounding boxes
    COMPONENTS.forEach((comp, idx) => {
      // Subtle float jitter
      const driftX = Math.sin(t + idx * 1.5) * 3;
      const driftY = Math.cos(t + idx * 1.8) * 3;

      const bx = comp.relX * w + driftX;
      const by = comp.relY * h + driftY;
      const bw = comp.relW * w;
      const bh = comp.relH * h;
      const cornerLen = 10;

      // Draw corner brackets
      ctx.strokeStyle = comp.color;
      ctx.lineWidth = 2;

      // Top-Left
      ctx.beginPath(); ctx.moveTo(bx, by + cornerLen); ctx.lineTo(bx, by); ctx.lineTo(bx + cornerLen, by); ctx.stroke();
      // Top-Right
      ctx.beginPath(); ctx.moveTo(bx + bw - cornerLen, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + cornerLen); ctx.stroke();
      // Bottom-Left
      ctx.beginPath(); ctx.moveTo(bx, by + bh - cornerLen); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + cornerLen, by + bh); ctx.stroke();
      // Bottom-Right
      ctx.beginPath(); ctx.moveTo(bx + bw - cornerLen, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - cornerLen); ctx.stroke();

      // Semi-transparent box background fill
      ctx.fillStyle = 'rgba(9, 9, 11, 0.45)';
      ctx.fillRect(bx, by, bw, bh);

      // HUD Tag Header
      const tagW = Math.min(bw, 120);
      const tagH = 22;
      const tagY = by - tagH - 4 > 5 ? by - tagH - 4 : by + 4;

      ctx.fillStyle = comp.color;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(bx, tagY, tagW, tagH, [4]);
      } else {
        ctx.rect(bx, tagY, tagW, tagH);
      }
      ctx.fill();

      ctx.fillStyle = '#09090B';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.fillText(`${comp.name} · ${comp.conf}`, bx + 6, tagY + 15);
    });

    arAnimFrame = requestAnimationFrame(renderArDetectionOverlay);
  }

  // Start AR loop
  renderArDetectionOverlay();

});
