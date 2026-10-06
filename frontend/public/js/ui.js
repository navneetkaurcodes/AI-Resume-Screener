// small helpers: DOM, toast, escape

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
export function esc(s) {
  if (s == null) return '';
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
export function fmt(n) { return (n ?? 0).toLocaleString(); }
export function relTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 86400 * 30) return Math.floor(diff / 86400) + 'd ago';
  return d.toLocaleDateString();
}
export function scoreColor(v) {
  if (v == null) return '';
  if (v >= 75) return 'green';
  if (v >= 50) return 'amber';
  return 'red';
}
export function ring(value, cls = '') {
  const v = Math.max(0, Math.min(100, value ?? 0));
  const color = scoreColor(v);
  return `
    <div class="score-ring ${color} ${cls}">
      <svg viewBox="0 0 36 36">
        <path class="bg" d="M18 2.1a15.9 15.9 0 1 1 0 31.8 15.9 15.9 0 0 1 0-31.8"/>
        <path class="fg" stroke-dasharray="${v}, 100" d="M18 2.1a15.9 15.9 0 1 1 0 31.8 15.9 15.9 0 0 1 0-31.8"/>
      </svg>
      <span>${v}</span>
    </div>`;
}
export function chips(items, cls = '') {
  if (!items || !items.length) return `<span style="color:var(--ink-mute);font-size:13px">—</span>`;
  return `<div class="chips">${items.map((s) => `<span class="chip ${cls}">${esc(s)}</span>`).join('')}</div>`;
}

let toastId = 0;
export function toast(msg, type = 'info') {
  const host = document.getElementById('toast-host');
  const icons = { ok: '✅', err: '⚠️', info: '💡' };
  const el = h(`<div class="toast ${type}"><span class="toast-icon">${icons[type] || '💡'}</span><div>${esc(msg)}</div></div>`);
  el.dataset.id = ++toastId;
  host.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 350);
  }, 3800);
}

export function confetti() {
  const colors = ['#d4af37','#3b82f6','#60a5fa','#34d399','#f0c14b'];
  const c = document.createElement('div');
  c.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9998;overflow:hidden';
  document.body.appendChild(c);
  for (let i = 0; i < 70; i++) {
    const s = document.createElement('span');
    const sz = 6 + Math.random() * 8;
    s.style.cssText = `position:absolute;top:-20px;left:${Math.random()*100}%;width:${sz}px;height:${sz*0.4}px;background:${colors[Math.floor(Math.random()*colors.length)]};transform:rotate(${Math.random()*360}deg);opacity:${.7+Math.random()*.3};border-radius:2px;animation:confall ${1.6+Math.random()*1.6}s cubic-bezier(.3,.7,.3,1) forwards;animation-delay:${Math.random()*.3}s;`;
    c.appendChild(s);
  }
  setTimeout(() => c.remove(), 3800);
}
// inject confetti keyframes once
const s = document.createElement('style');
s.textContent = `@keyframes confall{0%{transform:translateY(0) rotate(0)}100%{transform:translateY(110vh) rotate(720deg);opacity:0}}`;
document.head.appendChild(s);

// Modal helper
export function openModal(contentEl, opts = {}) {
  const back = h(`<div class="modal-back"></div>`);
  const modal = h(`<div class="modal ${opts.large ? 'modal-lg' : ''}" style="position:relative"></div>`);
  const close = h(`<button class="close-x" aria-label="Close">×</button>`);
  modal.appendChild(close);
  modal.appendChild(contentEl);
  back.appendChild(modal);
  document.body.appendChild(back);
  const closeFn = () => back.remove();
  close.addEventListener('click', closeFn);
  back.addEventListener('click', (e) => { if (e.target === back) closeFn(); });
  return closeFn;
}

// Chip input
export function chipInput(container, initial = [], suggestions = []) {
  const state = { tags: [...initial] };
  function render() {
    container.innerHTML = '';
    const wrap = h(`<div class="chip-input"></div>`);
    state.tags.forEach((t, i) => {
      const chip = h(`<span class="chip-tag">${esc(t)}<button type="button" data-i="${i}">×</button></span>`);
      chip.querySelector('button').addEventListener('click', () => {
        state.tags.splice(i, 1); render();
      });
      wrap.appendChild(chip);
    });
    const input = h(`<input placeholder="Type a skill and press Enter…" />`);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const v = input.value.trim();
        if (v && !state.tags.includes(v)) { state.tags.push(v); render(); }
      } else if (e.key === 'Backspace' && !input.value && state.tags.length) {
        state.tags.pop(); render();
      }
    });
    wrap.appendChild(input);
    container.appendChild(wrap);
    if (suggestions.length) {
      const s = h(`<div class="chip-suggest"></div>`);
      suggestions.filter((x) => !state.tags.includes(x)).slice(0, 10).forEach((sk) => {
        const b = h(`<span class="chip-sug">+ ${esc(sk)}</span>`);
        b.addEventListener('click', () => { state.tags.push(sk); render(); });
        s.appendChild(b);
      });
      container.appendChild(s);
    }
    setTimeout(() => input.focus(), 30);
  }
  render();
  return state;
}

export function skeleton(rows = 3) {
  return `<div class="card">${Array.from({length:rows}).map(() => `<div class="skel" style="height:18px;margin:10px 0;width:${60+Math.random()*40}%"></div>`).join('')}</div>`;
}
