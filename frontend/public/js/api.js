const TOKEN_KEY = 'resume_screener_token';

// ── Backend location ────────────────────────────────────────────────────
// This frontend is a static site (served by Live Server, port 5500 by
// default) and the FastAPI backend runs separately (uvicorn, port 8000).
// They are NOT the same origin, so every request needs the full backend
// URL — a plain fetch('/users/create_user') would hit port 5500, not FastAPI.
//
// Override at runtime without editing this file, e.g. from index.html:
//   <script>window.API_BASE_URL = 'http://127.0.0.1:8000';</script>
export const API_BASE_URL = window.API_BASE_URL || 'http://127.0.0.1:8000';

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
export function clearToken() { localStorage.removeItem(TOKEN_KEY); }

async function request(method, path, { body, form, isForm, auth = true } = {}) {
  const headers = {};
  let payload;
  if (isForm) {
    payload = new URLSearchParams(form).toString();
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  } else if (body instanceof FormData) {
    payload = body;
  } else if (body != null) {
    payload = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }
  if (auth) {
    const t = getToken();
    if (t) headers['Authorization'] = `Bearer ${t}`;
  }
  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { method, headers, body: payload });
  } catch (networkErr) {
    throw new Error(`Can't reach the backend at ${API_BASE_URL}. Is uvicorn running? (${networkErr.message})`);
  }
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json().catch(() => ({})) : await res.text();
  if (res.status === 401 && auth) {
    clearToken();
    if (location.hash !== '#/login') location.hash = '#/login';
  }
  if (!res.ok) {
    const err = new Error(data?.detail || data?.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  register: (b) => request('POST', '/users/create_user', { body: b, auth: false }),
  login: (email, password) => request('POST', '/auth/login', { isForm: true, form: { username: email, password }, auth: false }),
  me: () => request('GET', '/users/my_profile'),
  updateMe: (id, b) => request('PUT', `/users/update_user/${id}`, { body: b }),
  users: () => request('GET', '/users/display_users'),
  deleteUser: (id) => request('DELETE', `/users/delete_user/${id}`),

  createJob: (b) => request('POST', '/job-descriptions/create_job_description', { body: b }),
  jobs: () => request('GET', '/job-descriptions/display_jobs'),
  job: (id) => request('GET', `/job-descriptions/display_job_description/${id}`),
  updateJob: (id, b) => request('PUT', `/job-descriptions/update_job_description/${id}`, { body: b }),
  deleteJob: (id) => request('DELETE', `/job-descriptions/delete_job_description/${id}`),

  uploadResume: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return request('POST', '/resumes/upload', { body: fd });
  },
  resumes: () => request('GET', '/resumes/get_resumes'),
  resumesPaged: (page = 1, limit = 10) => request('GET', `/resumes/?page=${page}&limit=${limit}`),
  resume: (id) => request('GET', `/resumes/get_resume/${id}`),
  updateResume: (id, b) => request('PUT', `/resumes/update_resume/${id}`, { body: b }),
  deleteResume: (id) => request('DELETE', `/resumes/delete_resume/${id}`),
  searchResumes: (q) => {
    const s = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => { if (v != null && v !== '') s.set(k, v); });
    return request('GET', `/resumes/search?${s.toString()}`);
  },

  score: (rid, jid) => request('POST', `/scoring/score_candidate/${rid}/${jid}`),
  ranking: (jid) => request('GET', `/scoring/ranking/${jid}`),
  top: (jid, limit = 5) => request('GET', `/scoring/top/${jid}?limit=${limit}`),
  candidate: (rid, jid) => request('GET', `/scoring/candidate/${rid}/${jid}`),

  dashHr: () => request('GET', '/dashboard/hr_manager'),
  dashAdmin: () => request('GET', '/dashboard/admin'),
};

export const KNOWN_SKILLS = ['Python','FastAPI','Flask','Django','Node.js','JavaScript','TypeScript','React','Vue','Angular','SQL','PostgreSQL','MySQL','MongoDB','Redis','Docker','Kubernetes','Git','GitHub','AWS','Azure','GCP','Pandas','NumPy','Scikit-learn','TensorFlow','PyTorch','Power BI','Tableau','Excel','Machine Learning','Deep Learning','LangChain','OpenAI','REST API','GraphQL','Linux','CI/CD','Java','Go','Rust','C++','HTML','CSS','Tailwind'];
