import { api, clearToken } from '../api.js';
import { toast, h, confetti } from '../ui.js';

export async function renderRegister() {
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
        
        <h1>Find your best<span class="grad-text"> candidates in </span> minutes.</h1>
        <p>Create your account to start screening and ranking candidates for your open roles.</p>
        <div class="hero-perks">
          <div class="perk"><span class="perk-emoji">⚡</span><div><div class="perk-title">Instant match scores</div><div class="perk-desc">Weighted TF-IDF + skill overlap + experience</div></div></div>
          <div class="perk"><span class="perk-emoji">🎯</span><div><div class="perk-title">Skill gap analysis</div><div class="perk-desc">See exactly what each candidate is missing</div></div></div>
          <div class="perk"><span class="perk-emoji">🏆</span><div><div class="perk-title">Ranked leaderboards</div><div class="perk-desc">Top candidates surfaced automatically per job</div></div></div>
        </div>
      </div>
      <div class="auth-form-wrap">
        <form class="auth-card" id="reg-form" novalidate>
          <h2>Create your account</h2>
          <p>Join HR teams cutting screening time by 90%.</p>
          <div class="field">
            <label>Full name</label>
            <input type="text" name="full_name" required placeholder="Enter your full name" autocomplete="name" />
            <div class="err-msg">Name required</div>
          </div>
          <div class="field">
            <label>Work email</label>
            <input type="email" name="email" required placeholder="Enter your company email" autocomplete="email" />
            <div class="err-msg">Enter a valid email address</div>
          </div>
          <div class="field">
            <label>Password</label>
            <input type="password" name="password" required placeholder="At least 6 characters" autocomplete="new-password" />
            <div class="err-msg">Password must be at least 6 characters</div>
          </div>
          <div class="field">
            <label>Confirm password</label>
            <input type="password" name="confirm" required placeholder="Retype password" autocomplete="new-password" />
            <div class="err-msg">Passwords don't match</div>
          </div>
          <div class="field">
  <label>Register as</label>
  <div class="cselect" id="role-select">
    <input type="hidden" name="role" value="hr_manager" />
    <button type="button" class="cselect-trigger">
      <span class="cselect-value">HR Manager</span>
      <span class="cselect-arrow">▾</span>
    </button>
    <ul class="cselect-list">
      <li data-value="hr_manager" class="selected">HR Manager</li>
      <li data-value="admin">Admin</li>
    </ul>
  </div>
</div>
          <div class="field" id="admin-code-field" style="display:none">
            <label>Admin signup code</label>
            <input type="password" name="admin_code" placeholder="Provided by your organization" autocomplete="off" />
            <div class="err-msg">Enter the admin signup code to register as Admin</div>
          </div>
          <button type="submit" class="btn full" id="submit-btn"><span>Create account</span></button>
          <div class="auth-alt">Already have an account? <a href="#/login">Sign in →</a></div>
        </form>
      </div>
    </div>
  `);

  const form = view.querySelector('#reg-form');
  const roleSelect = view.querySelector('#role-select');
  const roleHidden = roleSelect.querySelector('input[name="role"]');
  const roleTrigger = roleSelect.querySelector('.cselect-trigger');
  const roleValueLabel = roleSelect.querySelector('.cselect-value');
  const roleList = roleSelect.querySelector('.cselect-list');
  const adminCodeField = view.querySelector('#admin-code-field');
  const adminCodeInput = adminCodeField.querySelector('input[name="admin_code"]');

  // Only show the admin-code field once "Admin" is picked — hr_manager
  // registration never needs it.
  roleTrigger.addEventListener('click', () => {
  roleTrigger.classList.toggle('open');
  roleList.classList.toggle('open');
});

roleList.addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (!li) return;
  roleList.querySelectorAll('li').forEach((el) => el.classList.remove('selected'));
  li.classList.add('selected');
  roleHidden.value = li.dataset.value;
  roleValueLabel.textContent = li.textContent;
  roleTrigger.classList.remove('open');
  roleList.classList.remove('open');

  // Only show the admin-code field once "Admin" is picked — hr_manager
  // registration never needs it.
  const isAdmin = li.dataset.value === 'admin';
  adminCodeField.style.display = isAdmin ? '' : 'none';
  if (!isAdmin) { adminCodeInput.value = ''; adminCodeField.classList.remove('has-err'); }
});

document.addEventListener('click', (e) => {
  if (!roleSelect.contains(e.target)) {
    roleTrigger.classList.remove('open');
    roleList.classList.remove('open');
  }
});

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fields = form.querySelectorAll('.field');
    fields.forEach((f) => f.classList.remove('has-err'));
    const fd = new FormData(form);
    const full_name = (fd.get('full_name') || '').toString().trim();
    const email = (fd.get('email') || '').toString().trim();
    const password = (fd.get('password') || '').toString();
    const confirm = (fd.get('confirm') || '').toString();
    const role = (fd.get('role') || 'hr_manager').toString();
    const admin_code = (fd.get('admin_code') || '').toString();
    let bad = false;
    if (!full_name) { fields[0].classList.add('has-err'); bad = true; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { fields[1].classList.add('has-err'); bad = true; }
    if (password.length < 6) { fields[2].classList.add('has-err'); bad = true; }
    if (password !== confirm) { fields[3].classList.add('has-err'); bad = true; }
    if (role === 'admin' && !admin_code) { adminCodeField.classList.add('has-err'); bad = true; }
    if (bad) return;

    const btn = form.querySelector('#submit-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span><span>Creating account…</span>';
    try {
      // Note: the server is the source of truth on role — it only grants
      // "admin" if admin_code matches ADMIN_SIGNUP_CODE in the backend's
      // .env. Sending role: "admin" with a wrong/blank code just gets you
      // registered as hr_manager, same as normal signup.
      // api.register already returns the created user (including the
      // role the server actually assigned) — no need to log in to check it.
      const created = await api.register({ full_name, email, password, role, admin_code: role === 'admin' ? admin_code : undefined });
      clearToken();
      window.__setUser(null);
      confetti();
      if (role === 'admin' && created.role !== 'admin') {
        toast(`Account created! Your admin code didn't match, so you were registered as an HR Manager. Please sign in.`, 'info');
      } else {
        toast(`Account created as ${created.role === 'admin' ? 'Admin' : 'HR Manager'} 🎉 Please sign in to continue.`, 'ok');
      }
      setTimeout(() => window.__nav('/login'), 900);
    } catch (err) {
      toast(err.message || 'Registration failed', 'err');
      btn.disabled = false;
      btn.innerHTML = '<span>Create account</span>';
    }
  });
  return view;
}
