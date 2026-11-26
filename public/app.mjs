import {SIZE, applyGenerated, initial, raster, validateScene} from './scene.mjs';

const $ = id => document.getElementById(id);
const screen = $('canvas');
const grid = $('grid');
const form = $('form');
const input = $('prompt');
const submit = $('submit');
const historyToggle = $('history-toggle');
const historyPanel = $('history-panel');
const status = $('status');
screen.width = screen.height = SIZE;
$('canvas-width').textContent = screen.width + ' pixels';
$('canvas-height').textContent = screen.height + ' pixels';

let entries = [{scene: initial(), label: 'Starting canvas'}];
let canvasId = crypto.randomUUID();

// Open artwork already saved by the previous studio. New history stays in this page.
try {
  const saved = JSON.parse(localStorage.getItem('pixelplot.studio.v1'));
  if (saved && Array.isArray(saved.history) && saved.history.length > 0 && saved.history.length <= 20) {
    entries = saved.history.map(entry => ({
      scene: validateScene(entry.scene),
      label: String(entry.label).slice(0, 1200),
    }));
  }
} catch { /* An unavailable or outdated snapshot can be skipped. */ }

let current = entries.at(-1).scene;
let busy = false;
let queued = null;
let frame = 0;
let pending = null;

function draw(canvas, scene) {
  const {pixels} = raster(scene);
  canvas.getContext('2d').putImageData(new ImageData(pixels, SIZE, SIZE), 0, 0);
}

function paint(scene, immediate = false) {
  pending = scene;
  function render() {
    frame = 0;
    draw(screen, pending);
    screen.setAttribute('aria-label', pending.title + ', pixel drawing');
  }
  if (immediate) {
    cancelAnimationFrame(frame);
    render();
  } else if (!frame) {
    frame = requestAnimationFrame(render);
  }
}

// Align each line to the nearest display pixel, including at fractional canvas scales.
function drawGrid() {
  const rect = screen.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.round(rect.width * dpr);
  const height = Math.round(rect.height * dpr);
  grid.width = Math.round((rect.width + 6) * dpr);
  grid.height = Math.round((rect.height + 6) * dpr);
  const ctx = grid.getContext('2d');
  const stroke = Math.max(1, Math.round(dpr * 0.5));
  for (let i = 0; i <= SIZE; i++) {
    const x = Math.round(i * width / SIZE);
    const y = Math.round(i * height / SIZE);
    const major = i % 16 === 0;
    ctx.fillStyle = major ? 'rgba(86,86,86,.31)' : 'rgba(105,105,105,.24)';
    ctx.fillRect(x, 0, stroke, height);
    ctx.fillRect(0, y, width, stroke);
    if (i % 4 === 0) {
      const tick = Math.round((major ? 6 : 3) * dpr);
      ctx.fillStyle = major ? '#a7a8a5' : '#d2d3d0';
      ctx.fillRect(x, height, stroke, tick);
      ctx.fillRect(width, y, tick, stroke);
    }
  }
}
new ResizeObserver(drawGrid).observe(screen);
window.addEventListener('resize', drawGrid);

const thumbnails = new WeakMap();
function thumbnail(scene) {
  if (!thumbnails.has(scene)) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    draw(canvas, scene);
    thumbnails.set(scene, canvas.toDataURL());
  }
  return thumbnails.get(scene);
}

function renderHistory() {
  if (historyPanel.hidden) return;
  const list = entries.toReversed().map(({scene, label}) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    const img = document.createElement('img');
    img.src = thumbnail(scene);
    img.alt = '';
    button.type = 'button';
    button.disabled = busy || scene === current;
    if (scene === current) button.setAttribute('aria-current', 'true');
    button.append(img, document.createTextNode(label));
    button.addEventListener('click', () => {
      if (busy) return;
      current = scene;
      canvasId = crypto.randomUUID();
      paint(current, true);
      setError('');
      setHistory(false);
      input.focus({preventScroll: true});
    });
    item.append(button);
    return item;
  });
  $('entries').replaceChildren(...list);
}

function setHistory(open) {
  historyPanel.hidden = !open;
  historyToggle.setAttribute('aria-expanded', String(open));
  if (open) renderHistory();
}
historyToggle.addEventListener('click', () => setHistory(historyPanel.hidden));
document.addEventListener('pointerdown', event => {
  if (!historyPanel.hidden && !historyToggle.parentElement.contains(event.target)) setHistory(false);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !historyPanel.hidden) {
    setHistory(false);
    historyToggle.focus({preventScroll: true});
  }
});

function setError(message) {
  $('error').textContent = message;
  $('error').hidden = !message;
}
function refreshControls() {
  form.toggleAttribute('data-busy', busy);
  screen.setAttribute('aria-busy', String(busy));
  input.readOnly = queued !== null;
  input.placeholder = queued ? 'Edit queued…' : busy ? 'Describe the next edit…' : 'Describe a scene…';
  submit.disabled = queued !== null;
  const action = busy ? 'Queue next edit' : 'Draw scene';
  submit.setAttribute('aria-label', action);
  submit.title = action + ' (Enter)';
  renderHistory();
}
input.addEventListener('input', () => setError(''));
input.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
    event.preventDefault();
    if (!queued) form.requestSubmit();
  }
});
form.addEventListener('submit', event => {
  event.preventDefault();
  const prompt = input.value.trim();
  if (!prompt || queued) return;
  input.value = '';
  setHistory(false);
  setError('');
  if (busy) {
    queued = prompt;
    status.textContent = 'Follow-up queued.';
    refreshControls();
  } else {
    runEdit(prompt);
  }
});

async function runEdit(prompt) {
  busy = true;
  refreshControls();
  status.textContent = 'Drawing.';
  let committed = false;
  let partial = current;
  let startingScene = false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 70000);
  try {
    const response = await fetch('/api/edit', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      signal: controller.signal,
      body: JSON.stringify({canvas: canvasId, prompt, scene: current}),
    });
    if (!response.ok) throw Error((await response.json()).error || 'Drawing request failed.');
    let buffer = '';
    for await (const chunk of response.body.pipeThrough(new TextDecoderStream())) {
      buffer += chunk;
      let cut;
      while ((cut = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, cut);
        buffer = buffer.slice(cut + 1);
        if (!line) continue;
        const event = JSON.parse(line);
        if (event.type === 'error') throw Error(event.message);
        if (event.type === 'restart') {
          partial = current;
          startingScene = false;
          paint(current, true);
        }
        if (event.type === 'draw') {
          partial = applyGenerated(partial, event.line);
          const [op, id] = event.line.split(' ');
          if (op === 'scene' || op === 'base') { startingScene = true; continue; }
          if (op === 'title') continue;
          if (startingScene && ['rect', 'gradient'].includes(op) && /^(background|bg|backdrop|sky)(\.|$)/.test(id)) continue;
          startingScene = false;
          paint(partial);
        }
        if (event.type === 'done') {
          current = validateScene(event.scene);
          paint(current, true);
          entries = [...entries, {scene: current, label: prompt}].slice(-20);
          committed = true;
          status.textContent = 'Drawing complete.';
        }
      }
    }
    if (!committed) throw Error('Connection interrupted. Try again.');
  } catch (error) {
    if (!committed) {
      paint(current, true);
      if (!input.value) input.value = queued || prompt;
      const reason = error.name === 'AbortError' ? 'Drawing timed out. Try again.' : error.message;
      setError(reason + (queued ? ' Resubmit the follow-up to apply it.' : ''));
      status.textContent = '';
    }
  } finally {
    clearTimeout(timeout);
    const next = queued;
    queued = null;
    busy = false;
    if (committed && next) runEdit(next);
    else refreshControls();
  }
}

paint(current, true);
refreshControls();
if (matchMedia('(hover: hover) and (pointer: fine)').matches) input.focus({preventScroll: true});
