import { api } from '../api.js';
import { h, esc, fmt, relTime, ring, chips } from '../ui.js';
import { state } from '../main.js';

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

export async function renderDashboard() {
  const view = h(`
    <div>
      <div class="page-head">
        <div>
          <h1 class="page-title">Hi, ${esc((state.user.full_name || state.user.email).split(' ')[0])} 👋</h1>
          <div class="page-sub">Here's what's happening in your hiring pipeline today.</div>
        </div>
        <div class="page-actions">
          <a class="btn ghost" href="#/jobs/new">＋ New Job</a>
          <a class="btn" href="#/resumes">Upload Resumes →</a>
        </div>
      </div>
      <div class="kpi-grid" id="kpis"></div>
      <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:20px" class="dash-two">
        <div class="card">
          <div class="card-head"><h3 class="card-title">Recent job descriptions</h3><a class="btn ghost sm" href="#/jobs">View all →</a></div>
          <div id="recent-jobs"></div>
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">Recent resumes</h3><a class="btn ghost sm" href="#/resumes">View all →</a></div>
          <div id="recent-resumes"></div>
        </div>
      </div>
    </div>
  `);

  const kpis = view.querySelector('#kpis');
  kpis.innerHTML = Array.from({length:5}).map(() => `<div class="kpi"><div class="skel" style="height:14px;width:60%;margin-bottom:12px"></div><div class="skel" style="height:32px;width:40%"></div></div>`).join('');

  const [dash, jobs, resumes] = await Promise.all([
    api.dashHr().catch(() => ({ total_jobs:0,total_resumes:0,total_scored_candidates:0,average_score:0,highest_score:0 })),
    api.jobs().catch(() => []),
    api.resumes().catch(() => []),
  ]);

  const kpiData = [
    { lbl: 'Total Jobs', val: dash.total_jobs, icon: '💼' },
    { lbl: 'Total Resumes', val: dash.total_resumes, icon: '📄' },
    { lbl: 'Scored Candidates', val: dash.total_scored_candidates, icon: '🎯' },
    { lbl: 'Average Score', val: dash.average_score, icon: '📊', pct: true },
    { lbl: 'Highest Score', val: dash.highest_score, icon: '🏆', pct: true },
  ];
  kpis.innerHTML = kpiData.map((k, i) => `
    <div class="kpi">
      <div class="kpi-icon">${k.icon}</div>
      <div class="kpi-lbl">${k.lbl}</div>
      <div class="kpi-val" data-target="${k.val}" data-pct="${k.pct ? 1 : 0}">0${k.pct ? '<small style="font-size:.5em;color:var(--ink-mute)">%</small>' : ''}</div>
    </div>`).join('');
  kpis.querySelectorAll('.kpi-val').forEach((el, i) => {
    const isPct = el.dataset.pct === '1';
    const target = parseInt(el.dataset.target, 10);
    animateNum(el, target);
    if (isPct) setTimeout(() => { el.innerHTML = target + '<small style="font-size:.5em;color:var(--ink-mute)">%</small>'; }, 1300);
  });

  const rj = view.querySelector('#recent-jobs');
  const recent = jobs.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
  if (!recent.length) {
    rj.innerHTML = `<div class="table-empty"><div class="table-empty-emoji">💼</div><h3>No jobs yet</h3><p style="color:var(--ink-mute);margin:6px 0 16px">Create your first job to start screening candidates.</p><a class="btn" href="#/jobs/new">Create Job</a></div>`;
  } else {
    rj.innerHTML = recent.map((j) => `
      <a href="#/jobs/${j.id}" style="display:flex;align-items:center;justify-content:space-between;padding:14px;border-radius:12px;margin-bottom:8px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05);transition:all .2s" onmouseover="this.style.background='rgba(255,255,255,.06)'" onmouseout="this.style.background='rgba(255,255,255,.03)'">
        <div>
          <div style="font-weight:600;font-size:14.5px">${esc(j.title)}</div>
          <div style="color:var(--ink-mute);font-size:12.5px;margin-top:2px">${esc(j.company || 'No company')} · ${relTime(j.created_at)}</div>
        </div>
        <div>${chips((j.required_skills || []).slice(0, 3))}</div>
      </a>`).join('');
  }

  const rr = view.querySelector('#recent-resumes');
  const recentR = resumes.sort((a,b) => new Date(b.uploaded_at) - new Date(a.uploaded_at)).slice(0, 5);
  if (!recentR.length) {
    rr.innerHTML = `<div class="table-empty"><div class="table-empty-emoji">📄</div><h3>No resumes yet</h3><p style="color:var(--ink-mute);margin:6px 0 16px">Upload PDFs to get started.</p><a class="btn" href="#/resumes">Upload Resumes</a></div>`;
  } else {
    rr.innerHTML = recentR.map((r) => `
      <a href="#/resumes/${r.id}" style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:12px;margin-bottom:8px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05);transition:all .2s" onmouseover="this.style.background='rgba(255,255,255,.06)'" onmouseout="this.style.background='rgba(255,255,255,.03)'">
        <div style="width:38px;height:38px;border-radius:10px;background:var(--grad-cool);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0">${esc((r.candidate_name || '?').split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase())}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.candidate_name || 'Unknown')}</div>
          <div style="color:var(--ink-mute);font-size:12px;margin-top:2px">${r.experience_years ?? 0}y · ${relTime(r.uploaded_at)}</div>
        </div>
      </a>`).join('');
  }

  // responsive: stack cards
  const style = document.createElement('style');
  style.textContent = `@media(max-width:960px){.dash-two{grid-template-columns:1fr !important}}`;
  view.appendChild(style);

  return view;
}
