import { api } from '../api.js';
import { h, esc, chips, ring, toast, relTime, scoreColor } from '../ui.js';
import { state } from '../main.js';

export async function renderJobDetail(jobId) {
  let job;
  try { job = await api.job(jobId); }
  catch { const el = h(`<div class="card table-empty"><div class="table-empty-emoji">🔍</div><h3>Job not found</h3><p style="color:var(--ink-mute)">It may have been deleted or you don't have access.</p><a class="btn" href="#/jobs" style="margin-top:16px">Back to jobs</a></div>`); return el; }

  const isAdmin = state.user.role === 'admin';
  const view = h(`
    <div>
      <div class="page-head">
        <div>
          <a href="#/jobs" style="color:var(--ink-mute);font-size:13px;text-decoration:none">← Job Descriptions</a>
          <h1 class="page-title" style="margin-top:6px">${esc(job.title)}</h1>
          <div class="page-sub">${esc(job.company || 'No company')} · Created ${relTime(job.created_at)}</div>
        </div>
        <div class="page-actions">
          <a class="btn ghost" href="#/jobs/${job.id}/edit">✎ Edit</a>
          ${isAdmin ? `<button class="btn danger" id="del-btn">Delete</button>` : ''}
        </div>
      </div>

      <div class="card">
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px" class="jd-grid">
          <div>
            <div style="color:var(--ink-mute);font-size:12px;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;font-weight:600">Description</div>
            <div style="line-height:1.6;color:var(--ink-dim);white-space:pre-wrap">${esc(job.description)}</div>
          </div>
          <div>
            <div style="color:var(--ink-mute);font-size:12px;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;font-weight:600">Required skills</div>
            ${chips(job.required_skills)}
            ${job.preferred_skills?.length ? `<div style="color:var(--ink-mute);font-size:12px;text-transform:uppercase;letter-spacing:.1em;margin:14px 0 8px;font-weight:600">Preferred</div>${chips(job.preferred_skills)}` : ''}
            <div style="color:var(--ink-mute);font-size:12px;text-transform:uppercase;letter-spacing:.1em;margin:14px 0 8px;font-weight:600">Min experience</div>
            <div style="font-family:'JetBrains Mono',monospace">${job.min_experience ? job.min_experience + ' years' : 'Not specified'}</div>
          </div>
        </div>
      </div>

      <div class="tabs">
        <div class="tab active" data-tab="ranking">🏆 Ranking</div>
        <div class="tab" data-tab="score">🎯 Score candidates</div>
      </div>
      <div id="tab-body"></div>
    </div>
  `);

  const style = document.createElement('style');
  style.textContent = `@media(max-width:800px){.jd-grid{grid-template-columns:1fr !important}}`;
  view.appendChild(style);

  const tabBody = view.querySelector('#tab-body');
  const tabs = view.querySelectorAll('.tab');
  tabs.forEach((t) => t.addEventListener('click', () => {
    tabs.forEach((x) => x.classList.remove('active'));
    t.classList.add('active');
    render(t.dataset.tab);
  }));

  if (isAdmin) {
    view.querySelector('#del-btn').addEventListener('click', async () => {
      if (!confirm(`Delete "${job.title}"? This cannot be undone.`)) return;
      try { await api.deleteJob(jobId); toast('Job deleted', 'ok'); location.hash = '#/jobs'; }
      catch (e) { toast(e.message, 'err'); }
    });
  }

  async function render(tab) {
    tabBody.innerHTML = `<div class="card"><div class="skel" style="height:24px;margin:8px 0;width:60%"></div><div class="skel" style="height:24px;margin:8px 0;width:80%"></div></div>`;
    if (tab === 'ranking') return renderRanking();
    if (tab === 'score') return renderScoreTab();
  }

  async function renderRanking() {
    const [ranks, resumes] = await Promise.all([api.ranking(jobId), api.resumes()]);
    if (!ranks.length) {
      tabBody.innerHTML = `<div class="card table-empty"><div class="table-empty-emoji">🎯</div><h3>No scored candidates yet</h3><p style="color:var(--ink-mute);margin:6px 0 16px">Score candidates against this job to see them ranked here.</p><button class="btn" id="go-score">Go to scoring →</button></div>`;
      tabBody.querySelector('#go-score').addEventListener('click', () => { tabs[1].click(); });
      return;
    }
    const byId = new Map(resumes.map((r) => [r.id, r]));
    tabBody.innerHTML = `<div class="card" style="padding:0;overflow:hidden">
      <table class="table">
        <thead><tr><th style="width:60px">#</th><th>Candidate</th><th>TF-IDF</th><th>Skills</th><th>Final</th><th></th></tr></thead>
        <tbody>
        ${ranks.map((r) => {
          const cand = byId.get(r.resume_id);
          const name = cand?.candidate_name || `Resume #${r.resume_id}`;
          const initials = name.split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase();
          return `<tr style="cursor:pointer" data-rid="${r.resume_id}">
            <td><div style="font-family:'JetBrains Mono',monospace;font-weight:700;color:${r.rank===1?'#34d399':r.rank<=3?'#f0c14b':'var(--ink-dim)'}">${r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : '#' + r.rank}</div></td>
            <td><div style="display:flex;align-items:center;gap:10px"><div style="width:34px;height:34px;border-radius:10px;background:var(--grad-cool);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px">${esc(initials)}</div><div><div style="font-weight:600;font-size:14px">${esc(name)}</div><div style="color:var(--ink-mute);font-size:12px">${cand?.experience_years ?? 0}y · ${esc(cand?.email || '')}</div></div></div></td>
            <td><div style="font-family:'JetBrains Mono',monospace;font-size:13px">${r.tfidf_score}</div></td>
            <td><div style="font-family:'JetBrains Mono',monospace;font-size:13px">${r.skill_match_percent}%</div></td>
            <td>${ring(r.final_score)}</td>
            <td style="text-align:right"><a class="btn ghost sm" href="#/candidates/${r.resume_id}/${jobId}">Details →</a></td>
          </tr>`;
        }).join('')}
        </tbody>
      </table>
    </div>`;
    tabBody.querySelectorAll('tr[data-rid]').forEach((tr) => {
      tr.addEventListener('click', (e) => { if (!(e.target instanceof HTMLAnchorElement)) location.hash = `#/candidates/${tr.dataset.rid}/${jobId}`; });
    });
  }

  async function renderScoreTab() {
    const resumes = await api.resumes();
    if (!resumes.length) {
      tabBody.innerHTML = `<div class="card table-empty"><div class="table-empty-emoji">📄</div><h3>No resumes uploaded</h3><p style="color:var(--ink-mute);margin:6px 0 16px">Upload some resumes first, then come back here to score them.</p><a class="btn" href="#/resumes">Upload resumes →</a></div>`;
      return;
    }
    tabBody.innerHTML = `
      <div class="card">
        <div class="card-head">
          <div><h3 class="card-title">Score candidates against this job</h3><div style="color:var(--ink-mute);font-size:13px;margin-top:4px">${resumes.length} resume${resumes.length===1?'':'s'} available.</div></div>
          <button class="btn" id="score-all">⚡ Score all</button>
        </div>
        <table class="table">
          <thead><tr><th>Candidate</th><th>Experience</th><th>Skills</th><th></th></tr></thead>
          <tbody id="score-body">
            ${resumes.map((r) => `<tr data-rid="${r.id}">
              <td><div style="font-weight:600">${esc(r.candidate_name || 'Unknown')}</div><div style="color:var(--ink-mute);font-size:12px">${esc(r.email || '')}</div></td>
              <td>${r.experience_years ?? 0}y</td>
              <td>${chips((r.extracted_skills || []).slice(0, 4))}</td>
              <td style="text-align:right"><button class="btn sm score-btn" data-rid="${r.id}">Score</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    tabBody.querySelectorAll('.score-btn').forEach((b) => {
      b.addEventListener('click', async () => {
        const rid = b.dataset.rid;
        b.disabled = true; b.innerHTML = '<span class="spinner"></span>';
        try {
          const res = await api.score(rid, jobId);
          toast(`Scored: ${res.final_score} — ${res.matched_skills.length} skills matched`, 'ok');
          const tr = b.closest('tr');
          const cls = scoreColor(res.final_score);
          b.outerHTML = `<a class="btn ghost sm" href="#/candidates/${rid}/${jobId}">View (${res.final_score}) →</a>`;
        } catch (e) { toast(e.message, 'err'); b.disabled = false; b.innerHTML = 'Score'; }
      });
    });
    tabBody.querySelector('#score-all').addEventListener('click', async () => {
      const btn = tabBody.querySelector('#score-all');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span><span>Scoring…</span>';
      let ok = 0;
      for (const r of resumes) {
        try { await api.score(r.id, jobId); ok++; } catch {}
      }
      toast(`Scored ${ok} candidate${ok===1?'':'s'} 🎉`, 'ok');
      tabs[0].click();
    });
  }

  render('ranking');
  return view;
}
