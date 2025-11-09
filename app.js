(function(){
  const canvas = document.getElementById('regCanvas');
  const ctx = canvas.getContext('2d');
  const slopeEl = document.getElementById('slope');
  const interceptEl = document.getElementById('intercept');
  const xpredEl = document.getElementById('xpred');
  const slopeVal = document.getElementById('slopeVal');
  const interceptVal = document.getElementById('interceptVal');
  const ypredVal = document.getElementById('ypredVal');
  const mOut = document.getElementById('mOut');
  const bOut = document.getElementById('bOut');
  const sseVal = document.getElementById('sseVal');
  const autoFitBtn = document.getElementById('autoFit');
  const resetBtn = document.getElementById('resetData');
  const showResidualsEl = document.getElementById('showResiduals');
  const stepText = document.getElementById('stepText');
  const stepButtons = Array.from(document.querySelectorAll('.step'));
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear().toString();

  // World-space (data) coordinates
  const xMin = 0, xMax = 10;
  const yMin = 0, yMax = 10;

  let state = {
    m: parseFloat(slopeEl.value),
    b: parseFloat(interceptEl.value),
    xPred: parseFloat(xpredEl.value),
    points: [],
    step: 0,
  };

  function randn() {
    // Box?Muller transform for normal noise
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  function generateData() {
    const n = 24;
    const trueM = 1.2;
    const trueB = 1.0;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * (xMax - xMin) / n;
      const noise = randn() * 0.6;
      const y = trueM * x + trueB + noise;
      pts.push({ x, y });
    }
    return pts;
  }

  function worldToScreen(x, y) {
    const pad = 40;
    const w = canvas.width - pad * 2;
    const h = canvas.height - pad * 2;
    const sx = pad + (x - xMin) / (xMax - xMin) * w;
    const sy = pad + (1 - (y - yMin) / (yMax - yMin)) * h;
    return [sx, sy];
  }

  function clear() {
    const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grd.addColorStop(0, '#0b1324');
    grd.addColorStop(1, '#0f172a');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawAxes() {
    const pad = 40;
    const w = canvas.width - pad * 2;
    const h = canvas.height - pad * 2;
    ctx.save();
    ctx.translate(pad, pad);
    // grid
    ctx.strokeStyle = '#253152';
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= 10; gx += 1) {
      const x = gx/10 * w;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let gy = 0; gy <= 10; gy += 1) {
      const y = gy/10 * h;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    // frame
    ctx.strokeStyle = '#3d4663';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, w, h);
    // ticks
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    for (let gx = 0; gx <= 10; gx += 2) {
      const x = gx/10 * w;
      ctx.fillText((gx).toString(), x, h + 16);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let gy = 0; gy <= 10; gy += 2) {
      const y = h - gy/10 * h;
      ctx.fillText((gy).toString(), -8, y);
    }
    ctx.restore();
  }

  function drawPoints() {
    ctx.fillStyle = '#60a5fa';
    for (const p of state.points) {
      const [sx, sy] = worldToScreen(p.x, p.y);
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function yOnLine(x) { return state.m * x + state.b; }

  function drawLine() {
    // clip to axes rect
    const pad = 40;
    const w = canvas.width - pad * 2;
    const h = canvas.height - pad * 2;

    const y1 = yOnLine(xMin), y2 = yOnLine(xMax);
    const [x1s, y1s] = worldToScreen(xMin, y1);
    const [x2s, y2s] = worldToScreen(xMax, y2);

    ctx.save();
    ctx.beginPath();
    ctx.rect(pad, pad, w, h);
    ctx.clip();

    const grad = ctx.createLinearGradient(x1s, y1s, x2s, y2s);
    grad.addColorStop(0, '#34d399');
    grad.addColorStop(1, '#22d3ee');

    ctx.strokeStyle = grad;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x1s, y1s); ctx.lineTo(x2s, y2s); ctx.stroke();
    ctx.restore();
  }

  function drawResiduals() {
    if (!showResidualsEl.checked) return;
    ctx.strokeStyle = '#f87171';
    ctx.lineWidth = 1.5;
    for (const p of state.points) {
      const yhat = yOnLine(p.x);
      const [sx, sy] = worldToScreen(p.x, p.y);
      const [_, yhs] = worldToScreen(p.x, yhat);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx, yhs);
      ctx.stroke();
    }
  }

  function drawPredictionMarker() {
    const x = state.xPred;
    const yhat = yOnLine(x);
    const [sx, sy] = worldToScreen(x, yhat);
    ctx.fillStyle = '#fbbf24';
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx, sy, 8, 0, Math.PI*2);
    ctx.stroke();
  }

  function computeSSE() {
    let sse = 0;
    for (const p of state.points) {
      const r = p.y - yOnLine(p.x);
      sse += r * r;
    }
    return sse;
  }

  function updateMetrics() {
    const yhat = yOnLine(state.xPred);
    ypredVal.textContent = yhat.toFixed(2);
    mOut.textContent = state.m.toFixed(2);
    bOut.textContent = state.b.toFixed(2);
    sseVal.textContent = computeSSE().toFixed(2);
    slopeVal.textContent = state.m.toFixed(2);
    interceptVal.textContent = state.b.toFixed(2);
  }

  function render() {
    clear();
    drawAxes();
    drawLine();
    drawResiduals();
    drawPoints();
    drawPredictionMarker();
    updateMetrics();
  }

  function autoFit() {
    // Ordinary Least Squares closed-form for simple linear regression
    const n = state.points.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (const p of state.points) {
      sumX += p.x; sumY += p.y; sumXY += p.x * p.y; sumXX += p.x * p.x;
    }
    const meanX = sumX / n;
    const meanY = sumY / n;
    const covXY = sumXY / n - meanX * meanY;
    const varX = sumXX / n - meanX * meanX;
    const m = varX === 0 ? 0 : (covXY / varX);
    const b = meanY - m * meanX;
    state.m = m; state.b = b;
    slopeEl.value = m.toFixed(2);
    interceptEl.value = b.toFixed(2);
    render();
  }

  function resetData() {
    state.points = generateData();
    render();
  }

  function attachUI() {
    slopeEl.addEventListener('input', () => {
      state.m = parseFloat(slopeEl.value);
      render();
    });
    interceptEl.addEventListener('input', () => {
      state.b = parseFloat(interceptEl.value);
      render();
    });
    xpredEl.addEventListener('input', () => {
      state.xPred = parseFloat(xpredEl.value);
      render();
    });
    showResidualsEl.addEventListener('change', render);
    autoFitBtn.addEventListener('click', autoFit);
    resetBtn.addEventListener('click', resetData);

    stepButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        stepButtons.forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        state.step = parseInt(btn.dataset.step || '0', 10);
        updateStepText();
        render();
      });
    });
  }

  function updateStepText() {
    const steps = [
      {
        t: 'Intuition',
        d: 'Line ka simple matlab: trend ko seedhi line se pakadna. Socho tumhare paas kai points (data) hain. Hum ek aisi line chahte jo in points ke beech ka overall raasta (trend) dikhaye ? bilkul jaise price generally time ke saath badh raha ho. Ye sirf direction batata hai, perfect fit nahi.'
      },
      {
        t: 'Error',
        d: 'Har point aur line ke beech ki vertical distance ko error samjho. Agar point line ke upar hai to positive, niche hai to negative ? par hum squared error use karte hain taaki sab errors positive ho jayein aur big mistakes ko zyada penalty mile. Niche red lines me ye residuals dikh rahe hain.'
      },
      {
        t: 'Fit',
        d: 'Best line ka matlab: aisi m (slope) aur b (intercept) jisse total squared error sabse kam ho. ?Auto-Fit? dabao ? ye tumhe wahi m, b dega jo sabse balanced line banata. Yahi linear regression ka core idea hai.'
      },
      {
        t: 'Predict',
        d: 'Ab naye x par prediction easy: y? = m?x + b. Slider se x badlao, peeli dot tumhe predicted value dikhayegi. Bas! Linear regression = trend + minimum error + simple prediction.'
      },
    ];
    const s = steps[state.step];
    stepText.innerHTML = `<strong>${s.t} (Hinglish):</strong> ${s.d}`;
  }

  // Init
  state.points = generateData();
  attachUI();
  updateStepText();
  render();
})();
