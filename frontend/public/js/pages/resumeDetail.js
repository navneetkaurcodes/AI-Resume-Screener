import { api } from '../api.js';
import { h, esc, chips, toast, relTime, ring } from '../ui.js';

export async function renderResumeDetail(id) {
  let r;
  try { r = await api.resume(id); }
  catch { const el = h(`<div class="card table-empty"><div class="table-empty-emoji">🔍</div><h3>Resume not found</h3><a class="btn" href="#/resumes" style="margin-top:16px">Back to resumes</a></div>`); return el; }

  const jobs = await api.jobs().catch(() => []);
  const initials = (r.candidate_name || '?').split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase();

  const view = h(`
    <div>
      <div class="page-head">
        <div>
          <a href="#/resumes" style="color:var(--ink-mute);font-size:13px">← Resume Library</a>
          <div style="display:flex;align-items:center;gap:16px;margin-top:8px">
            <div style="width:60px;height:60px;border-radius:16px;background:var(--grad-cool);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:22px">${esc(initials)}</div>
            <div>
              <h1 class="page-title" style="margin:0">${esc(r.candidate_name || 'Unknown Candidate')}</h1>
              <div class="page-sub">${esc(r.email || '—')} · ${esc(r.phone || 'No phone')} · Uploaded ${relTime(r.uploaded_at)}</div>
            </div>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px" class="rd-grid">
        <div class="card">
          <h3 class="card-title" style="margin-bottom:14px">Parsed details</h3>
          <div style="display:grid;grid-template-columns:120px 1fr;gap:10px 16px;font-size:14px">
            <div style="color:var(--ink-mute)">Experience</div><div>${r.experience_years ? r.experience_years + ' years' : 'Not specified'}</div>
            <div style="color:var(--ink-mute)">Education</div><div>${r.education ? esc((r.education.degree || '') + (r.education.college ? ' · ' + r.education.college : '')) || '—' : '—'}</div>
            <div style="color:var(--ink-mute)">Job titles</div><div>${(r.job_titles || []).map(t => `<span class="chip">${esc(t)}</span>`).join(' ') || '—'}</div>
            <div style="color:var(--ink-mute)">File</div><div style="font-family:'JetBrains Mono',monospace;font-size:12.5px">${esc(r.pdf_filename)}</div>
          </div>
          <div style="margin-top:16px">
            <div style="color:var(--ink-mute);font-size:12px;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;font-weight:600">Extracted skills</div>
            ${chips(r.extracted_skills)}
          </div>
        </div>

        <div class="card">
          <h3 class="card-title" style="margin-bottom:14px">Score against a job</h3>
          <p style="color:var(--ink-dim);font-size:13.5px;margin:0 0 14px">Pick a job description to score this candidate against.</p>
          <select id="job-picker" style="width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);color:var(--ink);padding:12px;border-radius:12px;outline:0;margin-bottom:12px">
            <option value="">— Select a job —</option>
            ${jobs.map((j) => `<option value="${j.id}">${esc(j.title)}${j.company ? ' · ' + esc(j.company) : ''}</option>`).join('')}
          </select>
          <button class="btn full" id="score-btn" disabled>Score candidate</button>
          <div id="score-result" style="margin-top:16px"></div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <h3 class="card-title">Raw extracted text</h3>
          <button class="collapse-toggle" id="toggle-raw">Show</button>
        </div>
        <div class="raw-viewer" id="raw" style="display:none">${esc(r.raw_text || 'No raw text extracted')}</div>
      </div>
    </div>
  `);

  const style = document.createElement('style');
  style.textContent = `@media(max-width:800px){.rd-grid{grid-template-columns:1fr !important}}`;
  view.appendChild(style);

  const picker = view.querySelector('#job-picker');
  const btn = view.querySelector('#score-btn');
  picker.addEventListener('change', () => { btn.disabled = !picker.value; });
  btn.addEventListener('click', async () => {
    const jid = picker.value;
    if (!jid) return;
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span><span>Scoring…</span>';
    try {
      const res = await api.score(id, jid);
      view.querySelector('#score-result').innerHTML = `
        <div style="padding:16px;border-radius:14px;background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.3);display:flex;align-items:center;gap:16px">
          ${ring(res.final_score)}
          <div style="flex:1">
            <div style="font-weight:600">Match: ${res.final_score}%</div>
            <div style="color:var(--ink-mute);font-size:12.5px;margin-top:2px">${res.matched_skills.length} matched · ${res.missing_skills.length} missing</div>
          </div>
          <a class="btn ghost sm" href="#/candidates/${id}/${jid}">Full detail →</a>
        </div>`;
      toast('Scored!', 'ok');
    } catch (e) { toast(e.message, 'err'); }
    btn.disabled = false; btn.innerHTML = '<span>Score candidate</span>';
  });

  const raw = view.querySelector('#raw');
  const toggle = view.querySelector('#toggle-raw');
  toggle.addEventListener('click', () => {
    const show = raw.style.display === 'none';
    raw.style.display = show ? 'block' : 'none';
    toggle.textContent = show ? 'Hide' : 'Show';
  });

  return view;
}
