import { api } from '../api.js';
import { h, esc, chips, ring, scoreColor } from '../ui.js';

export async function renderCandidate(resumeId, jobId) {
  let combo, resume, job;
  try {
    [combo, resume, job] = await Promise.all([
      api.candidate(resumeId, jobId),
      api.resume(resumeId),
      api.job(jobId),
    ]);
  } catch {
    return h(`<div class="card table-empty"><div class="table-empty-emoji">🔍</div><h3>Not scored yet</h3><p style="color:var(--ink-mute);margin:6px 0 16px">This resume hasn't been scored against that job.</p><a class="btn" href="#/jobs/${jobId}">Back to job</a></div>`);
  }

  const s = combo.score, gap = combo.skill_gap;
  const color = scoreColor(s.final_score);

  const view = h(`
    <div>
      <div class="page-head">
        <div>
          <a href="#/jobs/${jobId}" style="color:var(--ink-mute);font-size:13px">← ${esc(job.title)}</a>
          <h1 class="page-title" style="margin-top:6px">${esc(resume.candidate_name || 'Candidate')}</h1>
          <div class="page-sub">Scored against <b>${esc(job.title)}</b> · ${resume.experience_years ?? 0} years experience</div>
        </div>
      </div>

      <div class="detail-grid">
        <div class="card score-hero">
          <div style="color:var(--ink-mute);font-size:12px;text-transform:uppercase;letter-spacing:.1em;font-weight:600;margin-bottom:16px">Final match score</div>
          ${ring(s.final_score, 'lg')}
          <div style="margin-top:16px;font-size:14px;color:var(--ink-dim)">
            ${s.final_score >= 75 ? '🎉 Strong match — interview this candidate.' : s.final_score >= 50 ? '⚠️ Partial match — worth a look.' : '🚫 Weak match — likely skip.'}
          </div>
          <div style="margin-top:20px;font-size:12.5px;color:var(--ink-mute);font-family:'JetBrains Mono',monospace">Rank #${s.rank || '?'}</div>
        </div>

        <div class="card">
          <h3 class="card-title" style="margin-bottom:20px">Score breakdown</h3>
          <div class="breakdown">
            <div class="bd-row">
              <div class="bd-head"><span>Semantic (TF-IDF) · 50%</span><b>${s.tfidf_score}</b></div>
              <div class="bd-bar"><div class="bd-fill" style="width:${s.tfidf_score}%;background:var(--grad-cool)"></div></div>
            </div>
            <div class="bd-row">
              <div class="bd-head"><span>Skill overlap · 35%</span><b>${s.skill_match_percent}%</b></div>
              <div class="bd-bar"><div class="bd-fill" style="width:${s.skill_match_percent}%;background:var(--grad-lime)"></div></div>
            </div>
            <div class="bd-row">
              <div class="bd-head"><span>Experience fit · 15%</span><b>${resume.experience_years ?? 0}y / ${job.min_experience ?? 0}y</b></div>
              <div class="bd-bar"><div class="bd-fill" style="width:${Math.min(100, Math.round(((resume.experience_years || 0) / (job.min_experience || 1)) * 100))}%;background:var(--grad-warm)"></div></div>
            </div>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px" class="skg-grid">
        <div class="card">
          <div class="card-head"><h3 class="card-title" style="color:#6ee7b7">✓ Matched skills (${gap?.matched_skills?.length || 0})</h3></div>
          ${chips(gap?.matched_skills || [], 'match')}
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title" style="color:#fca5a5">✗ Missing skills (${gap?.missing_skills?.length || 0})</h3></div>
          ${chips(gap?.missing_skills || [], 'miss')}
        </div>
      </div>
    </div>
  `);
  const style = document.createElement('style');
  style.textContent = `@media(max-width:800px){.skg-grid{grid-template-columns:1fr !important}}`;
  view.appendChild(style);
  return view;
}
