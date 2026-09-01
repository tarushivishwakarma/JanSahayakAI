/**
 * accessibility.js – Accessibility features:
 * - High contrast mode toggle
 * - Font size scaling (A- / A / A+)
 * - ARIA live region updates
 * - Keyboard navigation hints
 */

export function initAccessibility() {
  setupA11yPanel();
  restoreA11yPreferences();
}

function setupA11yPanel() {
  const toggle = document.getElementById('a11y-toggle');
  const menu = document.getElementById('a11y-menu');

  // Toggle panel
  toggle?.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('hidden');
    toggle.setAttribute('aria-expanded', (!isOpen).toString());
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!document.getElementById('accessibility-panel')?.contains(e.target)) {
      menu?.classList.add('hidden');
      toggle?.setAttribute('aria-expanded', 'false');
    }
  });

  // High contrast toggle
  document.getElementById('high-contrast-toggle')?.addEventListener('change', (e) => {
    setHighContrast(e.target.checked);
    localStorage.setItem('jansahayak-high-contrast', e.target.checked.toString());
  });

  // Font size buttons
  document.getElementById('font-decrease')?.addEventListener('click', () => adjustFont(-0.1));
  document.getElementById('font-reset')?.addEventListener('click', () => setFontScale(1));
  document.getElementById('font-increase')?.addEventListener('click', () => adjustFont(0.1));
}

function restoreA11yPreferences() {
  // High contrast
  const hc = localStorage.getItem('jansahayak-high-contrast') === 'true';
  if (hc) {
    setHighContrast(true);
    const toggle = document.getElementById('high-contrast-toggle');
    if (toggle) toggle.checked = true;
  }

  // Font scale
  const scale = parseFloat(localStorage.getItem('jansahayak-font-scale') || '1');
  setFontScale(scale);
}

function setHighContrast(enabled) {
  document.documentElement.setAttribute('data-high-contrast', enabled.toString());
  document.body.setAttribute('data-high-contrast', enabled.toString());
}

let currentFontScale = 1;
const MIN_SCALE = 0.8;
const MAX_SCALE = 1.4;

function adjustFont(delta) {
  currentFontScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, currentFontScale + delta));
  setFontScale(currentFontScale);
}

function setFontScale(scale) {
  currentFontScale = scale;
  document.documentElement.style.setProperty('--font-scale', scale.toString());
  localStorage.setItem('jansahayak-font-scale', scale.toString());
}
