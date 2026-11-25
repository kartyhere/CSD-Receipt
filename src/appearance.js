'use strict';
// Visual preference only: Dark (default) or Light. The main process shares it across project windows.
(() => {
  const key = 'business-operations-appearance-v2';
  const options = ['dark', 'light'];
  let mode = 'dark';
  try { const saved = localStorage.getItem(key); if (options.includes(saved)) mode = saved; } catch (_) {}
  const icons = {
    // Shown icon = the theme you will switch to.
    sun: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  };
  function apply(next) {
    mode = options.includes(next) ? next : 'dark';
    document.documentElement.dataset.theme = mode;
    const target = mode === 'dark' ? 'light' : 'dark';
    document.querySelectorAll('[data-theme-toggle]').forEach((control) => {
      control.innerHTML = mode === 'dark' ? icons.sun : icons.moon;
      control.setAttribute('aria-label', 'Switch to ' + target + ' theme');
      control.setAttribute('title', 'Switch to ' + target + ' theme');
      control.setAttribute('aria-pressed', String(mode === 'light'));
      control.dataset.mode = mode;
    });
  }
  // Theme changes made with the toggle fade between the old and the new look (View Transitions; plain crossfade, about 0.65 s).
  // Skipped when the system asks for reduced motion, or when the browser has no support: the theme then simply switches.
  let activeTransition = null;
  let pendingTarget = null;
  function applyFaded(next) {
    const target = options.includes(next) ? next : 'dark';
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (activeTransition && pendingTarget === target) return;
    if (target === mode || reduced || typeof document.startViewTransition !== 'function') return apply(target);
    try {
      if (activeTransition) { try { activeTransition.skipTransition(); } catch (_) {} }
      pendingTarget = target;
      const transition = activeTransition = document.startViewTransition(() => apply(target));
      transition.ready.then(() => {
        for (const side of ['old', 'new']) {
          document.documentElement.animate({ opacity: side === 'old' ? [1, 0] : [0, 1] }, { duration: 650, easing: 'ease', pseudoElement: '::view-transition-' + side + '(root)', fill: 'forwards' });
        }
      }).catch(() => {});
      transition.finished.finally(() => { if (activeTransition === transition) activeTransition = null; });
    } catch (_) { apply(target); }
  }
  apply(mode);
  if (window.appAppearance) {
    window.appAppearance.get().then(apply).catch(() => {});
    window.appAppearance.onChange(applyFaded);
  } else {
    window.addEventListener('storage', (event) => { if (event.key === key) apply(event.newValue); });
  }
  document.addEventListener('DOMContentLoaded', () => {
    apply(mode);
    const status = document.getElementById('appearanceStatus');
    async function choose(next) {
      if (status) status.textContent = '';
      try {
        if (window.appAppearance) applyFaded(await window.appAppearance.set(next));
        else { localStorage.setItem(key, next); applyFaded(next); }
      } catch (error) {
        apply(mode);
        if (status) status.textContent = 'Theme could not be changed. Try again.';
      }
    }
    document.querySelectorAll('[data-theme-toggle]').forEach((control) => {
      control.addEventListener('click', () => choose(mode === 'dark' ? 'light' : 'dark'));
    });
  });
})();
