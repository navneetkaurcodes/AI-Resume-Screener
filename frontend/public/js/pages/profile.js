import { api } from '../api.js';
import { h, esc, toast } from '../ui.js';
import { state } from '../main.js';

export async function renderProfile() {
  const u = state.user;
  const view = h(`
    <div style="max-width:640px">
      <div class="page-head">
        <div>
          <h1 class="page-title">Profile</h1>
          <div class="page-sub">Update your account details.</div>
        </div>
      </div>
      <div class="card" style="text-align:center;padding:32px">
        <div style="width:88px;height:88px;border-radius:24px;background:var(--grad-hot);display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:32px;box-shadow:0 20px 40px rgba(212,175,55,.3);animation:pulse 3s ease-in-out infinite">${esc((u.full_name || u.email).split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase())}</div>
        <h3 style="margin:14px 0 4px;font-family:'Space Grotesk',sans-serif">${esc(u.full_name || 'No name')}</h3>
        <div style="color:var(--ink-dim);font-size:14px">${esc(u.email)}</div>
        <div style="margin-top:12px"><span class="chip">${u.role === 'admin' ? '👑 Admin' : 'HR Manager'}</span></div>
      </div>
      <form class="card" id="p-form">
        <h3 class="card-title" style="margin-bottom:16px">Edit account</h3>
        <div class="field"><label>Full name</label><input name="full_name" value="${esc(u.full_name || '')}" /></div>
        <div class="field"><label>Email</label><input type="email" name="email" value="${esc(u.email)}" /></div>
        <div class="field"><label>New password (leave blank to keep current)</label><input type="password" name="password" placeholder="••••••••" /></div>
        <div class="modal-actions">
          <button type="submit" class="btn" id="save-btn">Save changes</button>
        </div>
      </form>
    </div>
  `);

  view.querySelector('#p-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {
      full_name: (fd.get('full_name') || '').toString().trim() || null,
      email: (fd.get('email') || '').toString().trim(),
    };
    const pw = (fd.get('password') || '').toString();
    if (pw) body.password = pw;
    const btn = view.querySelector('#save-btn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span><span>Saving…</span>';
    try {
      const updated = await api.updateMe(u.id, body);
      window.__setUser(updated);
      toast('Profile updated', 'ok');
    } catch (err) { toast(err.message, 'err'); }
    btn.disabled = false; btn.innerHTML = 'Save changes';
  });

  return view;
}
