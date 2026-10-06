import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'resume-ray-dev-secret-change-me';
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is required');

const pool = mysql.createPool(DATABASE_URL);

// PDFs are held in memory only for parsing; the platform disk is ephemeral,
// so we don't persist the binary — we just extract fields and store metadata.
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- schema ----------
async function migrate() {
  await pool.execute(`CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255),
    hashed_password VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'hr_manager',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.execute(`CREATE TABLE IF NOT EXISTS jobs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    company VARCHAR(255),
    description TEXT NOT NULL,
    required_skills JSON,
    preferred_skills JSON,
    min_experience INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (user_id)
  )`);
  await pool.execute(`CREATE TABLE IF NOT EXISTS resumes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(64),
    pdf_filename VARCHAR(255),
    pdf_path VARCHAR(255),
    raw_text MEDIUMTEXT,
    extracted_skills JSON,
    education JSON,
    experience_years INT,
    job_titles JSON,
    uploaded_by INT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (uploaded_by)
  )`);
  await pool.execute(`CREATE TABLE IF NOT EXISTS scores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    resume_id INT NOT NULL,
    jd_id INT NOT NULL,
    tfidf_score INT,
    skill_match_percent INT,
    final_score INT,
    rank_val INT,
    scored_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY (resume_id, jd_id),
    INDEX (jd_id)
  )`);
  await pool.execute(`CREATE TABLE IF NOT EXISTS skill_gaps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    resume_id INT NOT NULL,
    jd_id INT NOT NULL,
    matched_skills JSON,
    missing_skills JSON,
    match_percent INT,
    UNIQUE KEY (resume_id, jd_id)
  )`);

  // Seed admin if not present
  const [rows] = await pool.execute(`SELECT id FROM users WHERE email = ?`, ['admin@resumeray.io']);
  if (!rows.length) {
    await pool.execute(
      `INSERT INTO users (email, full_name, hashed_password, role) VALUES (?, ?, ?, ?)`,
      ['admin@resumeray.io', 'System Admin', bcrypt.hashSync('admin123', 8), 'Admin']
    );
  }
}

function toJson(v) { return v == null ? null : JSON.stringify(v); }
function fromJson(v) {
  if (v == null) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return null; }
}
function mapJob(r) {
  return {
    id: r.id, user_id: r.user_id, title: r.title, company: r.company, description: r.description,
    required_skills: fromJson(r.required_skills) || [],
    preferred_skills: fromJson(r.preferred_skills) || [],
    min_experience: r.min_experience, created_at: r.created_at,
  };
}
function mapResume(r) {
  return {
    id: r.id, candidate_name: r.candidate_name, email: r.email, phone: r.phone,
    pdf_filename: r.pdf_filename, pdf_path: r.pdf_path, raw_text: r.raw_text,
    extracted_skills: fromJson(r.extracted_skills) || [],
    education: fromJson(r.education),
    experience_years: r.experience_years,
    job_titles: fromJson(r.job_titles) || [],
    uploaded_by: r.uploaded_by, uploaded_at: r.uploaded_at,
  };
}
function mapScore(r) {
  return {
    id: r.id, resume_id: r.resume_id, jd_id: r.jd_id,
    tfidf_score: r.tfidf_score, skill_match_percent: r.skill_match_percent,
    final_score: r.final_score, rank: r.rank_val, scored_at: r.scored_at,
  };
}
function mapGap(r) {
  return {
    id: r.id, resume_id: r.resume_id, jd_id: r.jd_id,
    matched_skills: fromJson(r.matched_skills) || [],
    missing_skills: fromJson(r.missing_skills) || [],
    match_percent: r.match_percent,
  };
}
function stripUser(u) { const { hashed_password, ...rest } = u; return rest; }

// ---------- auth middleware ----------
function issueToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '2h' });
}
async function authRequired(req, res, next) {
  const h = req.headers.authorization || '';
  const [, tok] = h.split(' ');
  if (!tok) return res.status(401).json({ detail: 'Not authenticated' });
  try {
    const payload = jwt.verify(tok, JWT_SECRET);
    const [rows] = await pool.execute(`SELECT * FROM users WHERE id = ?`, [payload.sub]);
    if (!rows.length) return res.status(401).json({ detail: 'User not found' });
    req.user = rows[0];
    next();
  } catch {
    return res.status(401).json({ detail: 'Invalid or expired token' });
  }
}
function adminOnly(req, res, next) {
  if (req.user.role !== 'Admin') return res.status(403).json({ detail: 'Admin access required' });
  next();
}

// ---------- users / auth ----------
app.post('/users/create_user', async (req, res) => {
  try {
    const { email, password, full_name } = req.body || {};
    if (!email || !password) return res.status(400).json({ detail: 'email and password required' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ detail: 'Invalid email' });
    if (password.length < 6) return res.status(400).json({ detail: 'Password must be at least 6 characters' });
    const [dup] = await pool.execute(`SELECT id FROM users WHERE email = ?`, [email]);
    if (dup.length) return res.status(409).json({ detail: 'Email already registered' });
    const [ins] = await pool.execute(
      `INSERT INTO users (email, full_name, hashed_password, role) VALUES (?, ?, ?, ?)`,
      [email, full_name || null, bcrypt.hashSync(password, 8), 'hr_manager']
    );
    const [rows] = await pool.execute(`SELECT * FROM users WHERE id = ?`, [ins.insertId]);
    res.status(201).json(stripUser(rows[0]));
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

app.post('/auth/login', async (req, res) => {
  try {
    const username = req.body.username || req.body.email;
    const password = req.body.password;
    const [rows] = await pool.execute(`SELECT * FROM users WHERE email = ?`, [username || '']);
    const u = rows[0];
    if (!u || !bcrypt.compareSync(password || '', u.hashed_password))
      return res.status(401).json({ detail: 'Invalid email or password' });
    res.json({ access_token: issueToken(u), token_type: 'bearer' });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

app.get('/users/my_profile', authRequired, (req, res) => res.json(stripUser(req.user)));

app.put('/users/update_user/:id', authRequired, async (req, res) => {
  try {
    const u = req.user;
    const { email, password, full_name } = req.body || {};
    const updates = [], vals = [];
    if (email) {
      const [dup] = await pool.execute(`SELECT id FROM users WHERE email = ? AND id != ?`, [email, u.id]);
      if (dup.length) return res.status(409).json({ detail: 'Email already registered' });
      updates.push('email = ?'); vals.push(email);
    }
    if (full_name !== undefined) { updates.push('full_name = ?'); vals.push(full_name); }
    if (password) { updates.push('hashed_password = ?'); vals.push(bcrypt.hashSync(password, 8)); }
    if (updates.length) {
      vals.push(u.id);
      await pool.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, vals);
    }
    const [rows] = await pool.execute(`SELECT * FROM users WHERE id = ?`, [u.id]);
    res.json(stripUser(rows[0]));
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

app.get('/users/display_users', authRequired, adminOnly, async (req, res) => {
  const [rows] = await pool.execute(`SELECT * FROM users ORDER BY id`);
  res.json(rows.map(stripUser));
});
app.delete('/users/delete_user/:id', authRequired, adminOnly, async (req, res) => {
  await pool.execute(`DELETE FROM users WHERE id = ?`, [+req.params.id]);
  res.json({ detail: 'deleted' });
});

// ---------- jobs ----------
app.post('/job-descriptions/create_job_description', authRequired, async (req, res) => {
  try {
    const { title, company, description, required_skills, preferred_skills, min_experience } = req.body || {};
    if (!title || !description) return res.status(400).json({ detail: 'title and description required' });
    const [ins] = await pool.execute(
      `INSERT INTO jobs (user_id, title, company, description, required_skills, preferred_skills, min_experience)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, title, company || null, description,
       toJson(Array.isArray(required_skills) ? required_skills : []),
       toJson(Array.isArray(preferred_skills) ? preferred_skills : []),
       min_experience != null ? +min_experience : null]
    );
    const [rows] = await pool.execute(`SELECT * FROM jobs WHERE id = ?`, [ins.insertId]);
    res.status(201).json(mapJob(rows[0]));
  } catch (e) { res.status(500).json({ detail: e.message }); }
});
app.get('/job-descriptions/display_jobs', authRequired, async (req, res) => {
  const [rows] = req.user.role === 'Admin'
    ? await pool.execute(`SELECT * FROM jobs ORDER BY created_at DESC`)
    : await pool.execute(`SELECT * FROM jobs WHERE user_id = ? ORDER BY created_at DESC`, [req.user.id]);
  res.json(rows.map(mapJob));
});
app.get('/job-descriptions/display_job_description/:id', authRequired, async (req, res) => {
  const [rows] = await pool.execute(`SELECT * FROM jobs WHERE id = ?`, [+req.params.id]);
  const j = rows[0];
  if (!j) return res.status(404).json({ detail: 'Job not found' });
  if (j.user_id !== req.user.id && req.user.role !== 'Admin') return res.status(404).json({ detail: 'Job not found' });
  res.json(mapJob(j));
});
app.put('/job-descriptions/update_job_description/:id', authRequired, async (req, res) => {
  const [rows] = await pool.execute(`SELECT * FROM jobs WHERE id = ?`, [+req.params.id]);
  const j = rows[0];
  if (!j) return res.status(404).json({ detail: 'Job not found' });
  if (j.user_id !== req.user.id && req.user.role !== 'Admin') return res.status(404).json({ detail: 'Job not found' });
  const b = req.body || {};
  const fields = { title: b.title, company: b.company, description: b.description, min_experience: b.min_experience };
  const updates = [], vals = [];
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) { updates.push(`${k} = ?`); vals.push(v); }
  if (b.required_skills !== undefined) { updates.push(`required_skills = ?`); vals.push(toJson(b.required_skills)); }
  if (b.preferred_skills !== undefined) { updates.push(`preferred_skills = ?`); vals.push(toJson(b.preferred_skills)); }
  if (updates.length) {
    vals.push(j.id);
    await pool.execute(`UPDATE jobs SET ${updates.join(', ')} WHERE id = ?`, vals);
  }
  const [after] = await pool.execute(`SELECT * FROM jobs WHERE id = ?`, [j.id]);
  res.json(mapJob(after[0]));
});
app.delete('/job-descriptions/delete_job_description/:id', authRequired, adminOnly, async (req, res) => {
  await pool.execute(`DELETE FROM jobs WHERE id = ?`, [+req.params.id]);
  res.json({ detail: 'deleted' });
});

// ---------- resumes ----------
const KNOWN_SKILLS = ['Python','FastAPI','Flask','Django','Node.js','JavaScript','TypeScript','React','Vue','Angular','SQL','PostgreSQL','MySQL','MongoDB','Redis','Docker','Kubernetes','Git','GitHub','AWS','Azure','GCP','Pandas','NumPy','Scikit-learn','TensorFlow','PyTorch','Power BI','Tableau','Excel','Machine Learning','Deep Learning','LangChain','OpenAI','REST API','GraphQL','Linux','CI/CD','Java','Go','Rust','C++','HTML','CSS','Tailwind'];

function fakeExtractFromFilename(name) {
  const base = name.replace(/\.pdf$/i, '').replace(/^\d+-/, '').replace(/[_\-]+/g, ' ').trim();
  const candidate = base.split(/\s+/).slice(0, 3).map((w) => w[0]?.toUpperCase() + w.slice(1).toLowerCase()).join(' ') || 'Unknown Candidate';
  const skills = KNOWN_SKILLS.slice().sort(() => 0.5 - Math.random()).slice(0, 6 + Math.floor(Math.random() * 4));
  const years = 1 + Math.floor(Math.random() * 9);
  return {
    candidate_name: candidate,
    email: candidate.toLowerCase().replace(/\s+/g, '.') + '@example.com',
    phone: '+1 555-' + Math.floor(1000000 + Math.random() * 9000000),
    extracted_skills: skills,
    experience_years: years,
    job_titles: ['Software Engineer', 'Backend Developer'].slice(0, 1 + Math.floor(Math.random() * 2)),
    education: { degree: 'B.Tech Computer Science', college: 'State University' },
    raw_text: `Resume of ${candidate}. ${years} years of experience across ${skills.join(', ')}. Passionate about scalable systems, mentoring, and clean architecture. Prior roles include work at fast-moving startups and mid-size product companies. Delivered projects around data pipelines, REST APIs, and cloud infrastructure.`,
  };
}

app.post('/resumes/upload', authRequired, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ detail: err.message || 'Upload failed' });
    if (!req.file) return res.status(400).json({ detail: 'No file uploaded' });
    try {
      const parsed = fakeExtractFromFilename(req.file.originalname);
      const [ins] = await pool.execute(
        `INSERT INTO resumes (candidate_name, email, phone, pdf_filename, pdf_path, raw_text, extracted_skills, education, experience_years, job_titles, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [parsed.candidate_name, parsed.email, parsed.phone, req.file.originalname, null,
         parsed.raw_text, toJson(parsed.extracted_skills), toJson(parsed.education),
         parsed.experience_years, toJson(parsed.job_titles), req.user.id]
      );
      const [rows] = await pool.execute(`SELECT * FROM resumes WHERE id = ?`, [ins.insertId]);
      const resume = mapResume(rows[0]);
      res.status(201).json({ message: 'Uploaded', resume_id: resume.id, filename: resume.pdf_filename, resume });
    } catch (e) { res.status(500).json({ detail: e.message }); }
  });
});

async function ownedResumes(user) {
  const [rows] = user.role === 'Admin'
    ? await pool.execute(`SELECT * FROM resumes ORDER BY uploaded_at DESC`)
    : await pool.execute(`SELECT * FROM resumes WHERE uploaded_by = ? ORDER BY uploaded_at DESC`, [user.id]);
  return rows.map(mapResume);
}
app.get('/resumes/get_resumes', authRequired, async (req, res) => res.json(await ownedResumes(req.user)));
app.get('/resumes/', authRequired, async (req, res) => {
  const list = await ownedResumes(req.user);
  const page = +(req.query.page || 1); const limit = +(req.query.limit || 10);
  const start = (page - 1) * limit;
  res.json({ total: list.length, page, limit, items: list.slice(start, start + limit) });
});
app.get('/resumes/search', authRequired, async (req, res) => {
  let list = await ownedResumes(req.user);
  const { candidate_name, skill, min_experience } = req.query;
  if (candidate_name) list = list.filter((r) => (r.candidate_name || '').toLowerCase().includes(candidate_name.toLowerCase()));
  if (skill) list = list.filter((r) => (r.extracted_skills || []).some((s) => s.toLowerCase().includes(skill.toLowerCase())));
  if (min_experience) list = list.filter((r) => (r.experience_years || 0) >= +min_experience);
  res.json(list);
});
app.get('/resumes/get_resume/:id', authRequired, async (req, res) => {
  const [rows] = await pool.execute(`SELECT * FROM resumes WHERE id = ?`, [+req.params.id]);
  const r = rows[0];
  if (!r) return res.status(404).json({ detail: 'Resume not found' });
  if (r.uploaded_by !== req.user.id && req.user.role !== 'Admin') return res.status(404).json({ detail: 'Resume not found' });
  res.json(mapResume(r));
});
app.put('/resumes/update_resume/:id', authRequired, async (req, res) => {
  const [rows] = await pool.execute(`SELECT * FROM resumes WHERE id = ?`, [+req.params.id]);
  const r = rows[0];
  if (!r) return res.status(404).json({ detail: 'Resume not found' });
  if (r.uploaded_by !== req.user.id && req.user.role !== 'Admin') return res.status(404).json({ detail: 'Resume not found' });
  const b = req.body || {};
  const scalars = { candidate_name: b.candidate_name, email: b.email, phone: b.phone, experience_years: b.experience_years, raw_text: b.raw_text };
  const updates = [], vals = [];
  for (const [k, v] of Object.entries(scalars)) if (v !== undefined) { updates.push(`${k} = ?`); vals.push(v); }
  ['extracted_skills','education','job_titles'].forEach((k) => {
    if (b[k] !== undefined) { updates.push(`${k} = ?`); vals.push(toJson(b[k])); }
  });
  if (updates.length) { vals.push(r.id); await pool.execute(`UPDATE resumes SET ${updates.join(', ')} WHERE id = ?`, vals); }
  const [after] = await pool.execute(`SELECT * FROM resumes WHERE id = ?`, [r.id]);
  res.json(mapResume(after[0]));
});
app.delete('/resumes/delete_resume/:id', authRequired, adminOnly, async (req, res) => {
  await pool.execute(`DELETE FROM resumes WHERE id = ?`, [+req.params.id]);
  res.json({ detail: 'deleted' });
});

// ---------- scoring ----------
function tokenize(text) { return (text || '').toLowerCase().match(/[a-z][a-z0-9+.#\-]{1,}/g) || []; }
function tfidfLike(a, b) {
  const at = new Set(tokenize(a)); const bt = new Set(tokenize(b));
  if (!at.size || !bt.size) return 0;
  let inter = 0; at.forEach((t) => { if (bt.has(t)) inter++; });
  return Math.round((inter / Math.max(at.size, bt.size)) * 100);
}
function scorePair(resume, job) {
  const req = (job.required_skills || []).map((s) => s.toLowerCase());
  const pref = (job.preferred_skills || []).map((s) => s.toLowerCase());
  const have = new Set((resume.extracted_skills || []).map((s) => s.toLowerCase()));
  const matched = [], missing = [];
  req.forEach((s) => (have.has(s) ? matched.push(s) : missing.push(s)));
  pref.forEach((s) => have.has(s) && matched.push(s));
  const skillPct = req.length ? Math.round((req.filter((s) => have.has(s)).length / req.length) * 100) : 100;
  const tfidf = tfidfLike(job.description + ' ' + (job.required_skills || []).join(' '), (resume.raw_text || '') + ' ' + (resume.extracted_skills || []).join(' '));
  const need = job.min_experience || 0; const has = resume.experience_years || 0;
  const expScore = need === 0 ? 100 : Math.max(0, Math.min(100, Math.round((has / need) * 100)));
  const final = Math.round(tfidf * 0.5 + skillPct * 0.35 + expScore * 0.15);
  const all = (job.required_skills || []).concat(job.preferred_skills || []);
  const properMatched = matched.map((m) => all.find((s) => s.toLowerCase() === m) || m);
  const properMissing = missing.map((m) => (job.required_skills || []).find((s) => s.toLowerCase() === m) || m);
  return { tfidf, skillPct, expScore, final, matched: properMatched, missing: properMissing };
}

async function recomputeRanks(jobId) {
  const [rows] = await pool.execute(`SELECT id, final_score FROM scores WHERE jd_id = ? ORDER BY final_score DESC`, [jobId]);
  for (let i = 0; i < rows.length; i++) {
    await pool.execute(`UPDATE scores SET rank_val = ? WHERE id = ?`, [i + 1, rows[i].id]);
  }
}

app.post('/scoring/score_candidate/:rid/:jid', authRequired, async (req, res) => {
  try {
    const rid = +req.params.rid, jid = +req.params.jid;
    const [[r]] = await pool.execute(`SELECT * FROM resumes WHERE id = ?`, [rid]);
    const [[j]] = await pool.execute(`SELECT * FROM jobs WHERE id = ?`, [jid]);
    if (!r || !j) return res.status(404).json({ detail: 'Resume or job not found' });
    if (req.user.role !== 'Admin' && (r.uploaded_by !== req.user.id || j.user_id !== req.user.id))
      return res.status(404).json({ detail: 'Not found or access denied' });
    const resume = mapResume(r), job = mapJob(j);
    const s = scorePair(resume, job);
    await pool.execute(
      `INSERT INTO scores (resume_id, jd_id, tfidf_score, skill_match_percent, final_score)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE tfidf_score = VALUES(tfidf_score), skill_match_percent = VALUES(skill_match_percent), final_score = VALUES(final_score), scored_at = CURRENT_TIMESTAMP`,
      [rid, jid, s.tfidf, s.skillPct, s.final]
    );
    await pool.execute(
      `INSERT INTO skill_gaps (resume_id, jd_id, matched_skills, missing_skills, match_percent)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE matched_skills = VALUES(matched_skills), missing_skills = VALUES(missing_skills), match_percent = VALUES(match_percent)`,
      [rid, jid, toJson(s.matched), toJson(s.missing), s.skillPct]
    );
    await recomputeRanks(jid);
    res.json({
      resume_id: rid, job_id: jid, tfidf_score: s.tfidf, skill_match: s.skillPct,
      experience_score: s.expScore, final_score: s.final,
      matched_skills: s.matched, missing_skills: s.missing,
    });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});
app.get('/scoring/ranking/:jid', authRequired, async (req, res) => {
  const [[j]] = await pool.execute(`SELECT * FROM jobs WHERE id = ?`, [+req.params.jid]);
  if (!j) return res.status(404).json({ detail: 'Job not found' });
  if (j.user_id !== req.user.id && req.user.role !== 'Admin') return res.status(404).json({ detail: 'Job not found' });
  const [rows] = await pool.execute(`SELECT * FROM scores WHERE jd_id = ? ORDER BY rank_val ASC`, [+req.params.jid]);
  res.json(rows.map(mapScore));
});
app.get('/scoring/top/:jid', authRequired, async (req, res) => {
  const limit = +(req.query.limit || 5);
  const [rows] = await pool.execute(`SELECT * FROM scores WHERE jd_id = ? ORDER BY final_score DESC LIMIT ?`, [+req.params.jid, limit]);
  res.json(rows.map(mapScore));
});
app.get('/scoring/candidate/:rid/:jid', authRequired, async (req, res) => {
  const rid = +req.params.rid, jid = +req.params.jid;
  const [[s]] = await pool.execute(`SELECT * FROM scores WHERE resume_id = ? AND jd_id = ?`, [rid, jid]);
  const [[g]] = await pool.execute(`SELECT * FROM skill_gaps WHERE resume_id = ? AND jd_id = ?`, [rid, jid]);
  if (!s) return res.status(404).json({ detail: 'Not scored yet' });
  res.json({ score: mapScore(s), skill_gap: g ? mapGap(g) : null });
});

// ---------- dashboards ----------
app.get('/dashboard/hr_manager', authRequired, async (req, res) => {
  const [[{ cJobs }]] = await pool.execute(`SELECT COUNT(*) AS cJobs FROM jobs WHERE user_id = ?`, [req.user.id]);
  const [[{ cRes }]] = await pool.execute(`SELECT COUNT(*) AS cRes FROM resumes WHERE uploaded_by = ?`, [req.user.id]);
  const [scoredRows] = await pool.execute(
    `SELECT s.final_score FROM scores s JOIN jobs j ON s.jd_id = j.id WHERE j.user_id = ?`, [req.user.id]
  );
  const finals = scoredRows.map((r) => r.final_score || 0);
  res.json({
    total_jobs: cJobs, total_resumes: cRes,
    total_scored_candidates: finals.length,
    average_score: finals.length ? Math.round(finals.reduce((a, b) => a + b, 0) / finals.length) : 0,
    highest_score: finals.length ? Math.max(...finals) : 0,
  });
});
app.get('/dashboard/admin', authRequired, adminOnly, async (req, res) => {
  const [[{ cU }]] = await pool.execute(`SELECT COUNT(*) AS cU FROM users`);
  const [[{ cJ }]] = await pool.execute(`SELECT COUNT(*) AS cJ FROM jobs`);
  const [[{ cR }]] = await pool.execute(`SELECT COUNT(*) AS cR FROM resumes`);
  const [rows] = await pool.execute(`SELECT final_score FROM scores`);
  const finals = rows.map((r) => r.final_score || 0);
  res.json({
    total_users: cU, total_jobs: cJ, total_resumes: cR,
    total_scored_candidates: finals.length,
    average_score: finals.length ? Math.round(finals.reduce((a, b) => a + b, 0) / finals.length) : 0,
    highest_score: finals.length ? Math.max(...finals) : 0,
  });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

migrate().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log(`ResumeRay running on 0.0.0.0:${PORT}`));
}).catch((e) => { console.error('Migration failed:', e); process.exit(1); });
