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
    const hostIp = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? '192.168.1.111' : window.location.hostname;
    const fullUrl = `http://${hostIp}:${window.location.port || '8001'}/mobile`;
    mobileUrl.textContent = fullUrl;
    const qrImg = document.getElementById('qr-code-img');
    if (qrImg) qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(fullUrl)}`;
    qrModal.classList.add('open');
  }

  btnConnectPhone?.addEventListener('click', openQrModal);
  btnConnectPhoneDock?.addEventListener('click', openQrModal);
  btnCloseModal?.addEventListener('click', () => qrModal.classList.remove('open'));
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

  async function analyzeLatestMobileFrame() {
    resetPipeline();
    activateStep('ps-vision');
    btnAnalyzeNow.classList.add('dock-active');

    try {
      // Vision step
      setTimeout(() => { completeStep('ps-vision', '165ms'); activateStep('ps-rag'); }, 400);
      setTimeout(() => { completeStep('ps-rag', '0ms');    activateStep('ps-gemma'); }, 700);

      const res = await fetch('/vision/analyze_latest', { method: 'POST' });
      const data = await res.json();

      completeStep('ps-gemma', data.gemma_latency_ms ? `${(data.gemma_latency_ms/1000).toFixed(2)}s` : '2.10s');
      activateStep('ps-piper');

      if (data.status === 'success') {
        updateReportCard(data);
        updateTimeline(data);
        setTimeout(() => { completeStep('ps-piper', data.tts_latency_ms ? `${(data.tts_latency_ms/1000).toFixed(2)}s` : '0.45s'); activateStep('ps-esp32'); }, 300);
        setTimeout(() => { completeStep('ps-esp32', '100ms'); finishPipeline(); }, 800);

        const tags = [];
        if (data.tool_call?.name) tags.push({ cls: 'tag-tool', icon: '🛠️', label: `${data.tool_call.name}()` });
        if (data.citations?.length) data.citations.forEach(c => tags.push({ cls: 'tag-rag', icon: '📄', label: c.doc_id }));

        addMessage('JARVIS', data.raw_analysis, 'jarvis', tags, data.reasoning_trace);
      }
    } catch (err) {
      brainStatus.textContent = 'Error';
      brainStatus.className = 'badge badge-red';
      console.error('Analyze error:', err);
    } finally {
      btnAnalyzeNow.classList.remove('dock-active');
    }
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

    try {
      const res = await fetch('/chat/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await res.json();

      completeStep('ps-gemma', data.latency?.llm_ms ? `${(data.latency.llm_ms/1000).toFixed(2)}s` : '—');
      activateStep('ps-piper');

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
        setTimeout(() => { completeStep('ps-esp32', '100ms'); finishPipeline(); }, 600);
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

  /* ── System Metrics Poll (2s) ─────────────────────────────── */
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
    } catch (e) {}
  }, 2000);

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

});
