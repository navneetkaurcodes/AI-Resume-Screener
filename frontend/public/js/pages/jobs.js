import { api } from '../api.js';
import { h, esc, relTime, chips, toast } from '../ui.js';

export async function renderJobs() {
  const view = h(`
    <div>
      <div class="page-head">
        <div>
          <h1 class="page-title">Job Descriptions</h1>
          <div class="page-sub">Create and manage the roles you're hiring for.</div>
        </div>
        <div class="page-actions">
          <a class="btn" href="#/jobs/new">＋ New Job</a>
        </div>
      </div>
      <div id="jobs-body"></div>
    </div>
  `);
  const body = view.querySelector('#jobs-body');
  body.innerHTML = `<div class="grid-cards">${Array.from({length:3}).map(() => `<div class="card"><div class="skel" style="height:20px;width:70%;margin-bottom:8px"></div><div class="skel" style="height:14px;width:50%"></div></div>`).join('')}</div>`;

  const jobs = await api.jobs();
  if (!jobs.length) {
    body.innerHTML = `<div class="card table-empty"><div class="table-empty-emoji">💼</div><h3>No job descriptions yet</h3><p style="color:var(--ink-mute);margin:6px 0 16px">Post your first role and start screening candidates in seconds.</p><a class="btn" href="#/jobs/new">Create your first job</a></div>`;
    return view;
  }

  body.innerHTML = `<div class="grid-cards">${jobs.map((j) => `
    <div class="job-card" data-id="${j.id}">
      <h3 class="job-title">${esc(j.title)}</h3>
      <div class="job-company">${esc(j.company || 'No company specified')}</div>
      ${chips((j.required_skills || []).slice(0, 5))}
      <div class="job-meta">
        <span>📅 ${relTime(j.created_at)}</span>
        ${j.min_experience ? `<span>⏳ ${j.min_experience}+ years</span>` : ''}
      </div>
    </div>`).join('')}</div>`;

  body.querySelectorAll('.job-card').forEach((c) => {
    c.addEventListener('mousemove', (e) => {
      const r = c.getBoundingClientRect();
      c.style.setProperty('--mx', `${e.clientX - r.left}px`);
      c.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
    c.addEventListener('click', () => location.hash = `#/jobs/${c.dataset.id}`);
  });

  return view;
}
