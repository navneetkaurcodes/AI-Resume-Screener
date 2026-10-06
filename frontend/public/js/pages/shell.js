import { h, esc } from '../ui.js';

export function renderShell(user, currentPath) {
  const isAdmin = user.role === 'admin';
  const initials = (user.full_name || user.email).split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  const nav = [
    { path: '/dashboard', icon: '📊', label: 'Dashboard' },
    { path: '/jobs', icon: '💼', label: 'Job Descriptions' },
    { path: '/resumes', icon: '📄', label: 'Resumes' },
    { path: '/profile', icon: '👤', label: 'Profile' },
  ];
  const adminNav = [
    { path: '/admin', icon: '👑', label: 'Admin Panel' },
  ];

  function itemHtml(it) {
    const active = currentPath === it.path || (it.path !== '/dashboard' && currentPath.startsWith(it.path));
    return `<a class="nav-item ${active ? 'active' : ''}" href="#${it.path}"><span class="nav-icon">${it.icon}</span><span>${it.label}</span></a>`;
  }

  const shell = h(`
    <div class="app-shell">
      <button class="hamburger" id="hamburger">☰</button>
      <aside class="sidebar" id="sidebar">
        <div class="brand-lg">
          <span class="brand-dot"></span>
          <span class="brand-name">Resume<b>Ray</b></span>
        </div>
        <div class="side-section">Workspace</div>
        ${nav.map(itemHtml).join('')}
        ${isAdmin ? `<div class="side-section">Admin</div>${adminNav.map(itemHtml).join('')}` : ''}
        <div class="side-footer">
          <div class="side-user">
            <div class="side-user-ava">${esc(initials)}</div>
            <div style="flex:1;min-width:0">
              <div class="side-user-name" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(user.full_name || user.email)}</div>
              <div class="side-user-role">${isAdmin ? '👑 Admin' : 'HR Manager'}</div>
            </div>
            <button class="btn ghost sm" onclick="__logout()" title="Sign out">⎋</button>
          </div>
        </div>
      </aside>
      <main class="main" id="main-content"></main>
    </div>`);

  const ham = shell.querySelector('#hamburger');
  const side = shell.querySelector('#sidebar');
  ham.addEventListener('click', () => side.classList.toggle('open'));
  side.querySelectorAll('.nav-item').forEach((a) => a.addEventListener('click', () => side.classList.remove('open')));

  return shell;
}
