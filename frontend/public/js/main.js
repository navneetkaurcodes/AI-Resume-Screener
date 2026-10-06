import { api, getToken, clearToken, setToken } from './api.js';
import { toast, h } from './ui.js';
import { renderLogin } from './pages/login.js';
import { renderRegister } from './pages/register.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderJobs } from './pages/jobs.js';
import { renderJobDetail } from './pages/jobDetail.js';
import { renderJobForm } from './pages/jobForm.js';
import { renderResumes } from './pages/resumes.js';
import { renderResumeDetail } from './pages/resumeDetail.js';
import { renderProfile } from './pages/profile.js';
import { renderCandidate } from './pages/candidate.js';
import { renderAdmin } from './pages/admin.js';
import { renderShell } from './pages/shell.js';

const app = document.getElementById('app');
export const state = { user: null };

const routes = [
  { path: /^\/login$/, view: renderLogin, public: true, bare: true },
  { path: /^\/register$/, view: renderRegister, public: true, bare: true },
  { path: /^\/dashboard$/, view: renderDashboard },
  { path: /^\/jobs$/, view: renderJobs },
  { path: /^\/jobs\/new$/, view: () => renderJobForm() },
  { path: /^\/jobs\/(\d+)\/edit$/, view: (m) => renderJobForm(m[1]) },
  { path: /^\/jobs\/(\d+)$/, view: (m) => renderJobDetail(m[1]) },
  { path: /^\/resumes$/, view: renderResumes },
  { path: /^\/resumes\/(\d+)$/, view: (m) => renderResumeDetail(m[1]) },
  { path: /^\/profile$/, view: renderProfile },
  { path: /^\/candidates\/(\d+)\/(\d+)$/, view: (m) => renderCandidate(m[1], m[2]) },
  { path: /^\/admin$/, view: renderAdmin, admin: true },
];

function getHash() {
  const h = location.hash.replace(/^#/, '') || '/dashboard';
  return h;
}
export function navigate(path) {
  location.hash = path.startsWith('#') ? path : '#' + path;
}

async function boot() {
  const token = getToken();
  if (token) {
    try { state.user = await api.me(); } catch { state.user = null; clearToken(); }
  }
  window.addEventListener('hashchange', route);
  route();
}

async function route() {
  const path = getHash();
  const match = routes.find((r) => r.path.test(path));
  if (!match) return navigate('/dashboard');

  if (!match.public && !state.user) return navigate('/login');
  if (match.public && state.user) return navigate('/dashboard');
  if (match.admin && state.user?.role !== 'admin') { toast('Admin access required', 'err'); return navigate('/dashboard'); }

  const m = path.match(match.path);
  app.innerHTML = '';

  if (match.bare) {
    const view = await match.view(m);
    app.appendChild(view);
  } else {
    const shell = renderShell(state.user, path);
    app.appendChild(shell);
    const main = shell.querySelector('#main-content');
    const loading = h(`<div class="skel" style="height:120px;margin:20px 0"></div>`);
    main.appendChild(loading);
    try {
      const view = await match.view(m);
      main.innerHTML = '';
      main.appendChild(view);
    } catch (err) {
      main.innerHTML = '';
      const errCard = h(`<div class="card" style="text-align:center;padding:40px"><div style="font-size:44px;margin-bottom:12px">⚠️</div><h3 style="margin:0 0 8px">Something went wrong</h3><p style="color:var(--ink-dim);margin:0">${err.message || 'Unknown error'}</p></div>`);
      main.appendChild(errCard);
    }
  }
}

// expose helpers on window for inline handlers
window.__nav = navigate;
window.__logout = () => { clearToken(); state.user = null; toast('Signed out', 'info'); navigate('/login'); };
window.__setUser = (u) => { state.user = u; };

boot();
