/**
 * app.js – Main SPA router and orchestrator
 * Coordinates all feature modules and manages page navigation
 */

import { initAuth, getCurrentUser, openAuthModal } from './auth.js';
import { initLanding } from './landing.js';
import { initChatbot } from './chatbot.js';
import { initSchemeResults } from './scheme-results.js';
import { initServices } from './services.js';
import { initFormWizard } from './form-wizard.js';
import { initTracker } from './tracker.js';
import { initAdmin } from './admin.js';
import { initFaqChatbot } from './chatbot.js';
import { initAccessibility } from './accessibility.js';
import { initOcr } from './ocr.js';
import { t, setLang, getLang, toggleLang } from './i18n.js';

// ——— State ———
let currentPage = 'landing';
let userData = null;   // Collected from scheme-finder chatbot

// ——— Init ———
document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  applyTranslations();
  initAuth(onAuthStateChanged);
  initLanding({ onStartChat, onTryDemo, onGoServices: () => navigateTo('dashboard') });
  initServices({ onServiceSelect: startFormWizard });
  initFormWizard({ onSubmitSuccess: onFormSubmitted });
  initChatbot({ onComplete: onChatbotComplete });
  initSchemeResults({ onBack: () => navigateTo('landing') });
  initTracker();
  initAdmin();
  initFaqChatbot();
  initAccessibility();
  initOcr();
  setupNavbarListeners();
  setupGlobalKeyboard();
  restoreScrollPosition();
});

// ——— Page Navigation ———
export function navigateTo(page) {
  const pages = document.querySelectorAll('.page');
  pages.forEach(p => p.classList.remove('active'));

  const target = document.getElementById(`page-${page}`);
  if (target) {
    target.classList.add('active');
    currentPage = page;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Close mobile menu
    document.getElementById('mobile-menu')?.classList.remove('open');
    document.getElementById('hamburger')?.setAttribute('aria-expanded', 'false');
  } else {
    console.warn(`Page not found: page-${page}`);
  }
}

// ——— Auth Callback ———
function onAuthStateChanged(user) {
  // Refresh tracker/admin if on those pages
  if (currentPage === 'tracker') initTracker();
  if (currentPage === 'admin') initAdmin();
  applyTranslations();
}

// ——— Landing Page Actions ———
function onStartChat() {
  navigateTo('chatbot');
}

function onTryDemo() {
  userData = {
    state: "Uttar Pradesh",
    age: 25,
    income: 200000,
    category: "OBC",
    occupation: "Student",
    gender: "Female",
    disability: "No"
  };
  import('./scheme-results.js').then(m => {
    m.renderResults(userData);
    navigateTo('results');
  });
}

// ——— Chatbot Complete ———
function onChatbotComplete(collectedData) {
  userData = collectedData;
  import('./scheme-results.js').then(m => {
    m.renderResults(userData);
    navigateTo('results');
  });
}

// ——— Service → Form Wizard ———
function startFormWizard(serviceId) {
  import('./form-wizard.js').then(m => {
    m.startWizard(serviceId);
    navigateTo('form-wizard');
  });
}

// ——— Form Submitted ———
function onFormSubmitted(applicationData) {
  showToast(t('toastFormSubmitted'), 'success');
  setTimeout(() => navigateTo('tracker'), 1500);
}

// ——— Navbar Setup ———
function setupNavbarListeners() {
  // Logo / home
  document.getElementById('nav-home-btn')?.addEventListener('click', () => navigateTo('landing'));
  document.getElementById('nav-home-btn')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') navigateTo('landing');
  });

  // Nav links
  document.getElementById('nav-dashboard-btn')?.addEventListener('click', () => navigateTo('dashboard'));
  document.getElementById('nav-chatbot-btn')?.addEventListener('click', () => navigateTo('chatbot'));
  document.getElementById('nav-tracker-btn')?.addEventListener('click', () => {
    if (!getCurrentUser()) { openAuthModal(); return; }
    navigateTo('tracker');
    initTracker();
  });
  document.getElementById('nav-admin-btn')?.addEventListener('click', () => {
    navigateTo('admin');
    initAdmin();
  });

  // Mobile menu
  document.getElementById('m-nav-dashboard')?.addEventListener('click', () => navigateTo('dashboard'));
  document.getElementById('m-nav-chatbot')?.addEventListener('click', () => navigateTo('chatbot'));
  document.getElementById('m-nav-tracker')?.addEventListener('click', () => {
    if (!getCurrentUser()) { openAuthModal(); return; }
    navigateTo('tracker');
    initTracker();
  });
  document.getElementById('m-nav-admin')?.addEventListener('click', () => navigateTo('admin'));

  // Hamburger toggle
  document.getElementById('hamburger')?.addEventListener('click', () => {
    const menu = document.getElementById('mobile-menu');
    const isOpen = menu.classList.toggle('open');
    document.getElementById('hamburger').setAttribute('aria-expanded', isOpen.toString());
  });

  // Language toggle
  document.getElementById('lang-toggle')?.addEventListener('click', () => {
    toggleLang();
    applyTranslations();
    // Re-render service cards with new language (but don't re-bind landing buttons)
    import('./services.js').then(m => m.renderServiceCards?.());
  });

  // Theme toggle
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
    document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    document.getElementById('theme-toggle').textContent = isDark ? '🌙' : '☀️';
    localStorage.setItem('jansahayak-theme', isDark ? 'light' : 'dark');
  });
}

// ——— Apply Theme from localStorage ———
function applyTheme() {
  const saved = localStorage.getItem('jansahayak-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  document.body.setAttribute('data-theme', saved);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = saved === 'dark' ? '🌙' : '☀️';
}

// ——— Apply Translations to static elements ———
export function applyTranslations() {
  const lang = getLang();

  // Navbar
  safeText('nav-brand-text', t('heroTitle'));
  safeText('nav-dashboard-btn', t('navServices'));
  safeText('nav-chatbot-btn', t('navFindSchemes'));
  safeText('nav-tracker-btn', t('navTrack'));
  safeText('nav-admin-btn', t('navAdmin'));
  safeText('nav-login-btn', t('navLogin'));
  safeText('nav-logout-btn', t('navLogout'));
  safeText('lang-toggle', t('langToggle'));
  safeText('m-nav-dashboard', t('navServices'));
  safeText('m-nav-chatbot', t('navFindSchemes'));
  safeText('m-nav-tracker', t('navTrack'));
  safeText('m-nav-admin', t('navAdmin'));

  // Landing
  safeText('hero-title', t('heroTitle'));
  safeText('hero-tagline', t('heroTagline'));
  safeText('btn-start-chat-text', t('btnStartChat'));
  safeText('btn-try-demo-text', t('btnTryDemo'));
  safeText('btn-services-text', t('btnServices'));
  safeText('feat1-title', t('feat1Title'));
  safeText('feat1-desc', t('feat1Desc'));
  safeText('feat2-title', t('feat2Title'));
  safeText('feat2-desc', t('feat2Desc'));
  safeText('feat3-title', t('feat3Title'));
  safeText('feat3-desc', t('feat3Desc'));
  safeText('stat1-label', t('stat1Label'));
  safeText('stat2-label', t('stat2Label'));
  safeText('stat3-label', t('stat3Label'));
  safeText('stat4-label', t('stat4Label'));

  // Dashboard
  safeText('dash-title', t('dashTitle'));
  safeText('dash-subtitle', t('dashSubtitle'));
  safeText('ocr-banner-title', t('ocrBannerTitle'));
  safeText('ocr-banner-desc', t('ocrBannerDesc'));
  safeText('ocr-trigger-btn', t('ocrBannerBtn'));

  // Chatbot
  safeText('chat-title', t('chatTitle'));
  safeText('chat-subtitle', t('chatSubtitle'));
  safeText('chat-back-btn', t('chatBack'));
  const chatInput = document.getElementById('chat-text-input');
  if (chatInput) chatInput.placeholder = t('chatInputPlaceholder');

  // Results
  safeText('results-title', t('resultsTitle'));
  safeText('view-dashboard-btn', t('viewDashboard'));
  safeText('results-back-btn', t('newSearch'));

  // Tracker
  safeText('tracker-title', t('trackerTitle'));
  safeText('tracker-subtitle', t('trackerSubtitle'));

  // Admin
  safeText('admin-title', t('adminTitle'));
  safeText('admin-subtitle', t('adminSubtitle'));
  safeText('th-user', t('adminColUser'));
  safeText('th-service', t('adminColService'));
  safeText('th-date', t('adminColDate'));
  safeText('th-status', t('adminColStatus'));
  safeText('th-action', t('adminColAction'));

  // Accessibility
  safeText('a11y-contrast-label', t('a11yContrastLabel'));
  safeText('a11y-font-label', t('a11yFontLabel'));
  safeText('a11y-keyboard-label', t('a11yKeyboardLabel'));

  // FAQ
  safeText('faq-panel-title', t('faqTitle'));
  safeText('faq-panel-subtitle', t('faqSubtitle'));

  // Auth tabs
  safeText('tab-login', t('authLogin'));
  safeText('tab-signup', t('authSignup'));
  safeText('btn-login', t('authLogin'));
  safeText('btn-signup', t('authSignup'));
}

function safeText(id, text) {
  const el = document.getElementById(id);
  if (el && text !== undefined) el.textContent = text;
}

// ——— Toast Notification ———
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ——— Global Keyboard Navigation ———
function setupGlobalKeyboard() {
  document.addEventListener('keydown', (e) => {
    // Escape closes modals
    if (e.key === 'Escape') {
      document.getElementById('auth-modal')?.classList.add('hidden');
      document.getElementById('ocr-modal')?.classList.add('hidden');
      document.getElementById('faq-panel')?.classList.add('hidden');
      document.getElementById('a11y-menu')?.classList.add('hidden');
    }
    // Alt+H = Home
    if (e.altKey && e.key === 'h') { e.preventDefault(); navigateTo('landing'); }
    // Alt+S = Services
    if (e.altKey && e.key === 's') { e.preventDefault(); navigateTo('dashboard'); }
  });
}

// ——— Scroll Position ———
function restoreScrollPosition() {
  window.addEventListener('beforeunload', () => {
    localStorage.setItem('jansahayak-scroll', window.scrollY);
  });
}

// ——— Global Error Handler (helps with debugging) ———
window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled Promise rejection:', e.reason);
});
window.addEventListener('error', (e) => {
  console.error('Global JS error:', e.message, 'at', e.filename, e.lineno);
});
