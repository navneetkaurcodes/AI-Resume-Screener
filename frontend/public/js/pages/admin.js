import { api } from '../api.js';
import { h, esc, relTime, toast } from '../ui.js';

function animateNum(el, target, dur = 1200) {
  const start = performance.now();
  function tick(now) {
    const p = Math.min((now - start) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.floor(target * eased).toLocaleString();
    if (p < 1) requestAnimationFrame(tick); else el.textContent = target.toLocaleString();
  }
  requestAnimationFrame(tick);
}

export async function renderAdmin() {
  const view = h(`
    <div>
      <div class="page-head">
        <div>
          <h1 class="page-title">👑 Admin Panel</h1>
          <div class="page-sub">System-wide oversight across all users, jobs, and resumes.</div>
        </div>
      </div>
      <div class="kpi-grid" id="kpis"></div>
      <div class="card">
        <div class="card-head"><h3 class="card-title">All users</h3></div>
        <div id="users-body"><div class="skel" style="height:24px;margin:8px 0"></div></div>
      </div>
    </div>
  `);

  const kpis = view.querySelector('#kpis');
  kpis.innerHTML = Array.from({length:5}).map(() => `<div class="kpi"><div class="skel" style="height:14px;width:60%;margin-bottom:10px"></div><div class="skel" style="height:32px;width:40%"></div></div>`).join('');

  const [dash, users] = await Promise.all([api.dashAdmin(), api.users()]);
  const cards = [
    { lbl: 'Total Users', val: dash.total_users, icon: '👥' },
    { lbl: 'Total Jobs', val: dash.total_jobs, icon: '💼' },
    { lbl: 'Total Resumes', val: dash.total_resumes, icon: '📄' },
    { lbl: 'Avg Score', val: dash.average_score, icon: '📊', pct: true },
    { lbl: 'Highest', val: dash.highest_score, icon: '🏆', pct: true },
  ];
  kpis.innerHTML = cards.map((k) => `
    <div class="kpi"><div class="kpi-icon">${k.icon}</div><div class="kpi-lbl">${k.lbl}</div><div class="kpi-val" data-target="${k.val}" data-pct="${k.pct?1:0}">0${k.pct?'<small style="font-size:.5em;color:var(--ink-mute)">%</small>':''}</div></div>`).join('');
  kpis.querySelectorAll('.kpi-val').forEach((el) => {
    const target = parseInt(el.dataset.target, 10);
    animateNum(el, target);
    if (el.dataset.pct === '1') setTimeout(() => { el.innerHTML = target + '<small style="font-size:.5em;color:var(--ink-mute)">%</small>'; }, 1300);
  });

  const body = view.querySelector('#users-body');
  body.innerHTML = `<table class="table">
    <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Joined</th><th></th></tr></thead>
    <tbody>
    ${users.map((u) => {
      const initials = (u.full_name || u.email).split(/\s+/).map(s=>s[0]).slice(0,2).join('').toUpperCase();
      return `<tr>
        <td><div style="display:flex;align-items:center;gap:10px"><div style="width:34px;height:34px;border-radius:10px;background:var(--grad-cool);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px">${esc(initials)}</div><div style="font-weight:600">${esc(u.full_name || '—')}</div></div></td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:13px">${esc(u.email)}</td>
        <td>${u.role === 'admin' ? '<span class="chip" style="background:rgba(212,175,55,.15);color:#f0c14b;border-color:rgba(212,175,55,.3)">👑 Admin</span>' : '<span class="chip">HR Manager</span>'}</td>
        <td style="color:var(--ink-mute);font-size:12.5px">${relTime(u.created_at)}</td>
        <td style="text-align:right">${u.role !== 'admin' ? `<button class="btn danger sm del-user" data-id="${u.id}" data-name="${esc(u.full_name || u.email)}">Delete</button>` : ''}</td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>`;

  body.querySelectorAll('.del-user').forEach((b) => {
    b.addEventListener('click', async () => {
      if (!confirm(`Delete user "${b.dataset.name}"?`)) return;
      try { await api.deleteUser(b.dataset.id); toast('User deleted', 'ok'); location.reload(); }
      catch (e) { toast(e.message, 'err'); }
    });
  });

  return view;
}
