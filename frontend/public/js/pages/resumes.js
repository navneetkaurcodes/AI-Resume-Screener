import { api } from '../api.js';
import { h, esc, chips, toast, relTime, openModal, confetti } from '../ui.js';

export async function renderResumes() {
  const view = h(`
    <div>
      <div class="page-head">
        <div>
          <h1 class="page-title">Resume Library</h1>
          <div class="page-sub">All the candidates you've uploaded.</div>
        </div>
        <div class="page-actions">
          <button class="btn" id="upload-btn">⬆ Upload PDF</button>
        </div>
      </div>
      <div class="card" style="padding:16px">
        <div class="search-bar">
          <input id="q-name" placeholder="🔍 Search candidate name…" />
          <input id="q-skill" placeholder="Filter by skill (e.g. Python)" />
          <input id="q-exp" type="number" min="0" placeholder="Min years" style="max-width:140px" />
          <button class="btn ghost" id="q-btn">Search</button>
          <button class="btn ghost" id="q-clear">Clear</button>
        </div>
      </div>
      <div id="res-body"></div>
    </div>
  `);

  const body = view.querySelector('#res-body');
  const upBtn = view.querySelector('#upload-btn');
  upBtn.addEventListener('click', openUploader);

  async function load(searchParams = null) {
    body.innerHTML = `<div class="card"><div class="skel" style="height:24px;width:60%;margin:8px 0"></div><div class="skel" style="height:24px;width:80%;margin:8px 0"></div></div>`;
    const list = searchParams ? await api.searchResumes(searchParams) : await api.resumes();
    if (!list.length) {
      body.innerHTML = `<div class="card table-empty"><div class="table-empty-emoji">📄</div><h3>${searchParams ? 'No results' : 'No resumes yet'}</h3><p style="color:var(--ink-mute);margin:6px 0 16px">${searchParams ? 'Try different filters.' : 'Upload your first PDF to start screening.'}</p><button class="btn" id="empty-up">Upload PDF</button></div>`;
      body.querySelector('#empty-up').addEventListener('click', openUploader);
      return;
    }
    body.innerHTML = `<div class="card" style="padding:0;overflow:hidden">
      <table class="table">
        <thead><tr><th>Candidate</th><th>Contact</th><th>Experience</th><th>Skills</th><th>Uploaded</th><th></th></tr></thead>
        <tbody>
        ${list.map((r) => {
          const initials = (r.candidate_name || '?').split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase();
          return `<tr style="cursor:pointer" data-id="${r.id}">
            <td><div style="display:flex;align-items:center;gap:12px"><div style="width:38px;height:38px;border-radius:11px;background:var(--grad-cool);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0">${esc(initials)}</div><div><div style="font-weight:600">${esc(r.candidate_name || 'Unknown')}</div><div style="color:var(--ink-mute);font-size:12px">${esc(r.pdf_filename)}</div></div></div></td>
            <td><div style="font-size:13px">${esc(r.email || '—')}</div><div style="color:var(--ink-mute);font-size:12px">${esc(r.phone || '')}</div></td>
            <td><div style="font-family:'JetBrains Mono',monospace">${r.experience_years ? r.experience_years + 'y' : 'Not specified'}</div></td>
            <td>${chips((r.extracted_skills || []).slice(0, 4))}</td>
            <td style="color:var(--ink-mute);font-size:12.5px">${relTime(r.uploaded_at)}</td>
            <td style="text-align:right"><a class="btn ghost sm" href="#/resumes/${r.id}">View →</a></td>
          </tr>`;
        }).join('')}
        </tbody>
      </table>
    </div>`;
    body.querySelectorAll('tr[data-id]').forEach((tr) => {
      tr.addEventListener('click', (e) => { if (!(e.target instanceof HTMLAnchorElement)) location.hash = `#/resumes/${tr.dataset.id}`; });
    });
  }

  view.querySelector('#q-btn').addEventListener('click', () => {
    const q = {
      candidate_name: view.querySelector('#q-name').value.trim(),
      skill: view.querySelector('#q-skill').value.trim(),
      min_experience: view.querySelector('#q-exp').value.trim(),
    };
    load(q);
  });
  view.querySelector('#q-clear').addEventListener('click', () => {
    view.querySelector('#q-name').value = '';
    view.querySelector('#q-skill').value = '';
    view.querySelector('#q-exp').value = '';
    load(null);
  });

  function openUploader() {
    const content = h(`
      <div>
        <h3>Upload resume PDF</h3>
        <p style="color:var(--ink-dim);font-size:14px;margin:0 0 20px">We'll extract candidate details automatically.</p>
        <div class="dropzone" id="dz">
          <div class="dropzone-emoji">📄</div>
          <h3>Drag & drop a PDF here</h3>
          <p>or click to browse — max 10 MB</p>
          <input type="file" id="file-in" accept="application/pdf,.pdf" style="display:none" />
        </div>
        <div id="up-status" style="margin-top:14px;font-size:14px;color:var(--ink-dim);text-align:center"></div>
      </div>
    `);
    const close = openModal(content);
    const dz = content.querySelector('#dz');
    const inp = content.querySelector('#file-in');
    const status = content.querySelector('#up-status');
    dz.addEventListener('click', () => inp.click());
    ['dragenter','dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drag'); }));
    ['dragleave','drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('drag'); }));
    dz.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) handle(f); });
    inp.addEventListener('change', () => { if (inp.files[0]) handle(inp.files[0]); });

    async function handle(file) {
      if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) { toast('Only PDF files are accepted', 'err'); return; }
      status.innerHTML = '<span class="spinner"></span> Uploading & parsing…';
      try {
        const res = await api.uploadResume(file);
        confetti();
        toast(`Uploaded and parsed: ${res.filename}`, 'ok');
        close();
        load(null);
      } catch (e) { status.textContent = ''; toast(e.message, 'err'); }
    }
  }

  load(null);
  return view;
}
