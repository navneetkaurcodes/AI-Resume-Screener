import { api, KNOWN_SKILLS } from '../api.js';
import { h, esc, toast, chipInput } from '../ui.js';

export async function renderJobForm(jobId) {
  const isEdit = !!jobId;
  let existing = null;
  if (isEdit) {
    try { existing = await api.job(jobId); } catch (e) { toast('Job not found', 'err'); location.hash = '#/jobs'; return h('<div/>'); }
  }

  const view = h(`
    <div style="max-width:820px">
      <div class="page-head">
        <div>
          <h1 class="page-title">${isEdit ? 'Edit job' : 'Create job description'}</h1>
          <div class="page-sub">${isEdit ? 'Update this job posting.' : 'Post a new role and start scoring candidates.'}</div>
        </div>
      </div>
      <form class="card" id="job-form">
        <div class="field">
          <label>Job title *</label>
          <input name="title" required placeholder="Senior Backend Engineer" value="${esc(existing?.title || '')}" />
          <div class="err-msg">Title required</div>
        </div>
        <div class="field">
          <label>Company</label>
          <input name="company" placeholder="Acme Corp" value="${esc(existing?.company || '')}" />
        </div>
        <div class="field">
          <label>Description *</label>
          <textarea name="description" required placeholder="Describe the role, responsibilities, and tech stack…">${esc(existing?.description || '')}</textarea>
          <div class="err-msg">Description required</div>
        </div>
        <div class="field">
          <label>Required skills *</label>
          <div id="req-skills-input"></div>
        </div>
        <div class="field">
          <label>Preferred skills</label>
          <div id="pref-skills-input"></div>
        </div>
        <div class="field" style="max-width:260px">
          <label>Minimum experience (years)</label>
          <input type="number" name="min_experience" min="0" max="30" placeholder="e.g. 3" value="${existing?.min_experience ?? ''}" />
        </div>
        <div class="modal-actions">
          <a class="btn ghost" href="#/jobs">Cancel</a>
          <button type="submit" class="btn" id="submit-btn"><span>${isEdit ? 'Save changes' : 'Create job'}</span></button>
        </div>
      </form>
    </div>
  `);

  const reqState = chipInput(view.querySelector('#req-skills-input'), existing?.required_skills || [], KNOWN_SKILLS);
  const prefState = chipInput(view.querySelector('#pref-skills-input'), existing?.preferred_skills || [], KNOWN_SKILLS);

  view.querySelector('#job-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const fields = form.querySelectorAll('.field');
    fields.forEach((f) => f.classList.remove('has-err'));
    const fd = new FormData(form);
    const title = (fd.get('title') || '').toString().trim();
    const company = (fd.get('company') || '').toString().trim();
    const description = (fd.get('description') || '').toString().trim();
    const min = fd.get('min_experience');
    let bad = false;
    if (!title) { fields[0].classList.add('has-err'); bad = true; }
    if (!description) { fields[2].classList.add('has-err'); bad = true; }
    if (bad) return;
    if (!reqState.tags.length) { toast('Add at least one required skill', 'err'); return; }

    const btn = form.querySelector('#submit-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span><span>Saving…</span>';
    const payload = {
      title, company: company || null, description,
      required_skills: reqState.tags,
      preferred_skills: prefState.tags,
      min_experience: min ? +min : null,
    };
    try {
      if (isEdit) {
        await api.updateJob(jobId, payload);
        toast('Job updated', 'ok');
        location.hash = `#/jobs/${jobId}`;
      } else {
        const job = await api.createJob(payload);
        toast(`Created "${job.title}"`, 'ok');
        location.hash = `#/jobs/${job.id}`;
      }
    } catch (err) {
      toast(err.message || 'Save failed', 'err');
      btn.disabled = false;
      btn.innerHTML = `<span>${isEdit ? 'Save changes' : 'Create job'}</span>`;
    }
  });

  return view;
}
