/* Theme: light | dark | system. "system" removes data-theme from <html>. */
(function () {
  var KEY = 'w1-theme';
  var ICONS = {
    light: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    dark: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/></svg>',
    system: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>'
  };
  var LABEL = { light: 'Light theme', dark: 'Dark theme', system: 'System theme' };
  var ORDER = ['light', 'dark', 'system'];

  function read() {
    try { var v = localStorage.getItem(KEY); if (ORDER.indexOf(v) >= 0) return v; } catch (e) {}
    return 'system';
  }
  function apply(mode) {
    var root = document.documentElement;
    if (mode === 'light' || mode === 'dark') root.setAttribute('data-theme', mode);
    else root.removeAttribute('data-theme');
  }

  var forced = null;
  try { var q = new URLSearchParams(location.search).get('theme'); if (q === 'light' || q === 'dark') forced = q; } catch (e) {}
  var mode = forced || read();
  apply(mode);

  function sync() {
    var all = document.querySelectorAll('.theme-toggle button');
    for (var i = 0; i < all.length; i++) all[i].setAttribute('aria-pressed', String(all[i].dataset.mode === mode));
  }
  function set(m) {
    if (ORDER.indexOf(m) < 0) return;
    mode = m;
    apply(m);
    if (!forced) { try { localStorage.setItem(KEY, m); } catch (e) {} }
    sync();
  }
  function cycle() { set(ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length]); }
  function mount(el) {
    el.classList.add('theme-toggle');
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', 'Theme');
    el.innerHTML = ORDER.map(function (m) {
      return '<button type="button" data-mode="' + m + '" aria-label="' + LABEL[m] + '" title="' + LABEL[m] + '" aria-pressed="false">' + ICONS[m] + '</button>';
    }).join('');
    el.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-mode]');
      if (b) set(b.dataset.mode);
    });
    el.addEventListener('mousedown', function (e) { if (e.target.closest('button')) e.preventDefault(); });
    sync();
  }
  function mountAll() {
    var els = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < els.length; i++) mount(els[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountAll); else mountAll();

  window.Theme = { get: function () { return mode; }, set: set, cycle: cycle, mount: mount };
})();
