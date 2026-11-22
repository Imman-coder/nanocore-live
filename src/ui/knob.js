// Rotary knob UI. Each knob drives a hidden range input so the existing
// editor change/input handlers (including SysEx writes) keep working.
let dragging = null;

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const angleFor = (value, max) => -135 + (clamp(value, 0, max) / max) * 270;

export function renderKnob({ id, value, max = 127, label, display, data = '', extra = '' }) {
  return `<div class="knob-wrap" data-param-block-wrap>
    <div class="knob" data-knob="${id}" role="slider" tabindex="0"
      aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${value}" aria-label="${label}">
      <div class="knob-dial" style="--angle:${angleFor(value, max)}deg"><i class="knob-pointer"></i></div>
    </div>
    <div class="knob-meta"><label>${label}</label><span class="value">${display}</span></div>
    <input id="${id}" class="knob-input" type="range" min="0" max="${max}" value="${value}" ${data} ${extra}>
  </div>`;
}

export function renderStepKnob({ id, step, labels, label, data = '' }) {
  const max = labels.length - 1;
  return `<div class="knob-wrap stomp-knob-wrap">
    <div class="knob" data-knob="${id}" role="slider" tabindex="0"
      aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${step}" aria-label="${label}">
      <div class="knob-dial" style="--angle:${angleFor(step, max)}deg"><i class="knob-pointer"></i></div>
    </div>
    <div class="knob-meta"><label>${label}</label><span class="value">${labels[step]}</span></div>
    <input id="${id}" class="knob-input" type="range" min="0" max="${max}" value="${step}" data-stomp-knob data-step-label="${labels.join('|')}" ${data}>
  </div>`;
}

function update(id, value, eventName) {
  const input = document.getElementById(id);
  if (!input) return;
  input.value = String(Math.round(value));
  input.dispatchEvent(new Event(eventName, { bubbles: true }));
  const knob = document.querySelector(`[data-knob="${id}"]`);
  const dial = knob?.querySelector('.knob-dial');
  if (dial) dial.style.setProperty('--angle', `${angleFor(Number(input.value), Number(input.max))}deg`);
  knob?.setAttribute('aria-valuenow', input.value);
  const display = knob?.parentElement?.querySelector('.knob-meta .value');
  if (display && input.dataset.stepLabel) {
    display.textContent = input.dataset.stepLabel.split('|')[Number(input.value)] ?? input.value;
  }
}

document.addEventListener('pointerdown', (event) => {
  const knob = event.target.closest('[data-knob]');
  if (!knob) return;
  const input = document.getElementById(knob.dataset.knob);
  if (!input) return;
  event.preventDefault();
  dragging = { id: knob.dataset.knob, startY: event.clientY, startValue: Number(input.value), max: Number(input.max) };
  try { knob.setPointerCapture?.(event.pointerId); } catch { /* synthetic pointer */ }
});

document.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  // Stepped knobs need a slower drag so each detent is easy to hit.
  const divisor = dragging.max <= 10 ? 14 : 4;
  const delta = (dragging.startY - event.clientY) / divisor;
  update(dragging.id, clamp(dragging.startValue + delta, 0, dragging.max), 'input');
});

document.addEventListener('pointerup', () => {
  if (!dragging) return;
  update(dragging.id, Number(document.getElementById(dragging.id)?.value ?? 0), 'change');
  dragging = null;
});

document.addEventListener('keydown', (event) => {
  const knob = event.target.closest?.('[data-knob]');
  if (!knob || !['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(event.key)) return;
  event.preventDefault();
  const input = document.getElementById(knob.dataset.knob);
  const direction = event.key === 'ArrowUp' || event.key === 'ArrowRight' ? 1 : -1;
  update(knob.dataset.knob, Number(input.value) + direction, 'input');
});
