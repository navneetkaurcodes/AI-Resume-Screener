import { api, setToken } from '../api.js';
import { toast, h } from '../ui.js';

export async function renderLogin() {
  const view = h(`
    <div class="auth-shell">
      <div class="bg-orbs" aria-hidden="true">
        <span class="orb orb-1"></span>
        <span class="orb orb-2"></span>
        <span class="orb orb-3"></span>
        <span class="orb orb-4"></span>
      </div>
      <div class="auth-hero">
        <div class="brand-lg">
          <span class="brand-dot"></span>
          <span class="brand-name">AIResume<b>Ranking</b></span>
        </div>

        <h1>Find your next hire, <span class="grad-text">ranked and ready</span>.</h1>
        <p>Sign in to screen resumes, match candidates to your job descriptions, and see AI-powered skill gap analysis — all in one place.</p>
        <div class="score-mock">
          <div class="score-mock-head">
            <span class="score-mock-tag">✨ AI Screening</span>
          </div>
          <div class="semi-gauge">
            <svg viewBox="0 0 160 90">
              <path class="semi-bg" d="M10,80 A70,70 0 0 1 150,80"></path>
              <path class="semi-fg" d="M10,80 A70,70 0 0 1 150,80" stroke-dasharray="202 220"></path>
            </svg>
            <div class="semi-gauge-val"><span>Strong</span><small>Overall match</small></div>
          </div>
          <ul class="score-mock-list">
            <li><span class="sm-icon ok">✓</span><span class="sm-label">Skill match</span><span class="sm-badge good">Strong</span></li>
            <li><span class="sm-icon ok">✓</span><span class="sm-label">Relevance</span><span class="sm-badge good">Strong</span></li>
            <li><span class="sm-icon warn">!</span><span class="sm-label">Experience fit</span><span class="sm-badge warn">Fair</span></li>
            <li><span class="sm-icon lock">🔒</span><span class="sm-label">Certifications</span><span class="sm-badge locked">Pro</span></li>
          </ul>
        </div>
      </div>
      <div class="auth-form-wrap">
        <form class="auth-card" id="login-form" novalidate>
          <h2>Sign in</h2>
          <p>Enter your credentials to access your dashboard.</p>
          <div class="field">
            <label>Email</label>
            <input type="email" name="email" required placeholder="Email address" autocomplete="email" />
            <div class="err-msg">Enter a valid email address</div>
          </div>
          <div class="field">
            <label>Password</label>
            <input type="password" name="password" required placeholder="**********" autocomplete="current-password" />
            <div class="err-msg">Password required</div>
          </div>
          <button type="submit" class="btn full" id="submit-btn">
            <span>Sign in</span>
          </button>
          <div class="auth-alt">Don't have an account? <a href="#/register">Create one →</a></div>
        </form>
      </div>
    </div>
  `);

  const form = view.querySelector('#login-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    form.querySelectorAll('.field').forEach((f) => f.classList.remove('has-err'));
    const fd = new FormData(form);
    const email = (fd.get('email') || '').toString().trim();
    const password = (fd.get('password') || '').toString();
    let bad = false;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { form.querySelectorAll('.field')[0].classList.add('has-err'); bad = true; }
    if (!password) { form.querySelectorAll('.field')[1].classList.add('has-err'); bad = true; }
    if (bad) return;
    const btn = form.querySelector('#submit-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span><span>Signing in…</span>';
    try {
      const res = await api.login(email, password);
      setToken(res.access_token);
      const me = await api.me();
      window.__setUser(me);
      toast(`Welcome back, ${me.full_name || me.email.split('@')[0]}!`, 'ok');
      window.__nav('/dashboard');
    } catch (err) {
      toast(err.message || 'Login failed', 'err');
      btn.disabled = false;
      btn.innerHTML = '<span>Sign in</span>';
    }
  });

  return view;
}
