/**
 * auth.js – Firebase Authentication (login, signup, logout, Google sign-in)
 * Exports: initAuth, openAuthModal, closeAuthModal, getCurrentUser
 */
import { showToast } from './app.js';
import { t } from './i18n.js';

let currentUser = null;
let onAuthChangeCallback = null;

/** Initialize auth state listener */
export function initAuth(onAuthChange) {
  onAuthChangeCallback = onAuthChange;

  if (!window.firebaseReady) {
    // Demo mode: no auth
    renderAuthUI(null);
    return;
  }

  window.auth.onAuthStateChanged((user) => {
    currentUser = user;
    renderAuthUI(user);
    if (onAuthChangeCallback) onAuthChangeCallback(user);
  });

  // Setup modal event listeners
  setupAuthModal();
}

/** Get current logged-in user */
export function getCurrentUser() {
  return currentUser;
}

/** Open the auth modal */
export function openAuthModal() {
  document.getElementById('auth-modal').classList.remove('hidden');
  document.getElementById('login-email').focus();
}

/** Close the auth modal */
export function closeAuthModal() {
  document.getElementById('auth-modal').classList.add('hidden');
  clearAuthErrors();
}

/** Render user info in navbar */
function renderAuthUI(user) {
  const authArea = document.getElementById('nav-auth-area');
  const userArea = document.getElementById('nav-user-area');
  const loginBtn = document.getElementById('nav-login-btn');

  if (user) {
    authArea.classList.add('hidden');
    userArea.classList.remove('hidden');
    const displayName = user.displayName || user.email?.split('@')[0] || 'User';
    document.getElementById('nav-username').textContent = displayName;
    document.getElementById('nav-avatar').textContent = displayName[0].toUpperCase();

    // Show admin link if admin
    const adminEmails = ['admin@jansahayak.in', 'admin@test.com']; // Configurable
    const isAdmin = adminEmails.includes(user.email);
    document.getElementById('nav-admin-btn').style.display = isAdmin ? '' : 'none';
    document.getElementById('m-nav-admin').style.display = isAdmin ? '' : 'none';
  } else {
    authArea.classList.remove('hidden');
    userArea.classList.add('hidden');
    document.getElementById('nav-admin-btn').style.display = 'none';
    document.getElementById('m-nav-admin').style.display = 'none';
  }
}

/** Setup all auth modal interactions */
function setupAuthModal() {
  // Close modal
  document.getElementById('auth-modal-close').addEventListener('click', closeAuthModal);
  document.getElementById('auth-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('auth-modal')) closeAuthModal();
  });

  // Tab switching
  document.getElementById('tab-login').addEventListener('click', () => switchTab('login'));
  document.getElementById('tab-signup').addEventListener('click', () => switchTab('signup'));

  // Login button
  document.getElementById('btn-login').addEventListener('click', handleLogin);

  // Signup button
  document.getElementById('btn-signup').addEventListener('click', handleSignup);

  // Google buttons
  document.getElementById('btn-google-login').addEventListener('click', handleGoogleAuth);
  document.getElementById('btn-google-signup').addEventListener('click', handleGoogleAuth);

  // Open modal from navbar
  document.getElementById('nav-login-btn').addEventListener('click', openAuthModal);

  // Logout
  document.getElementById('nav-logout-btn').addEventListener('click', handleLogout);

  // Enter key support
  document.getElementById('login-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
  document.getElementById('signup-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSignup();
  });
}

/** Switch between login and signup tabs */
function switchTab(tab) {
  const loginPanel = document.getElementById('panel-login');
  const signupPanel = document.getElementById('panel-signup');
  const loginTab = document.getElementById('tab-login');
  const signupTab = document.getElementById('tab-signup');

  if (tab === 'login') {
    loginPanel.style.display = '';
    signupPanel.style.display = 'none';
    loginTab.classList.add('active');
    loginTab.setAttribute('aria-selected', 'true');
    signupTab.classList.remove('active');
    signupTab.setAttribute('aria-selected', 'false');
    document.getElementById('login-email').focus();
  } else {
    loginPanel.style.display = 'none';
    signupPanel.style.display = '';
    loginTab.classList.remove('active');
    loginTab.setAttribute('aria-selected', 'false');
    signupTab.classList.add('active');
    signupTab.setAttribute('aria-selected', 'true');
    document.getElementById('signup-name').focus();
  }
  clearAuthErrors();
}

/** Handle email/password login */
async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  clearAuthErrors();

  if (!validateEmail(email)) {
    showError('login-email-error', 'Please enter a valid email address');
    return;
  }
  if (password.length < 6) {
    showError('login-password-error', 'Password must be at least 6 characters');
    return;
  }

  if (!window.firebaseReady) {
    // Demo mode login
    simulateDemoLogin(email);
    return;
  }

  const btn = document.getElementById('btn-login');
  btn.disabled = true;
  btn.textContent = 'Logging in…';

  try {
    await window.auth.signInWithEmailAndPassword(email, password);
    closeAuthModal();
    showToast(t('toastLoginSuccess'), 'success');
  } catch (err) {
    const msg = getFriendlyError(err.code);
    showError('login-email-error', msg);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Login';
  }
}

/** Handle email/password signup */
async function handleSignup() {
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  clearAuthErrors();

  if (!name) { showError('signup-name-error', 'Please enter your name'); return; }
  if (!validateEmail(email)) { showError('signup-email-error', 'Please enter a valid email'); return; }
  if (password.length < 6) { showError('signup-password-error', 'Password must be at least 6 characters'); return; }

  if (!window.firebaseReady) {
    simulateDemoLogin(email, name);
    return;
  }

  const btn = document.getElementById('btn-signup');
  btn.disabled = true;
  btn.textContent = 'Creating account…';

  try {
    const cred = await window.auth.createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: name });
    closeAuthModal();
    showToast(t('toastSignupSuccess'), 'success');
  } catch (err) {
    const msg = getFriendlyError(err.code);
    showError('signup-email-error', msg);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign Up';
  }
}

/** Handle Google authentication */
async function handleGoogleAuth() {
  if (!window.firebaseReady) {
    simulateDemoLogin('demo@google.com', 'Demo User');
    return;
  }

  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    await window.auth.signInWithPopup(provider);
    closeAuthModal();
    showToast(t('toastLoginSuccess'), 'success');
  } catch (err) {
    console.error('Google auth error:', err);
    showError('login-email-error', 'Google sign-in failed. Please try again.');
  }
}

/** Handle logout */
async function handleLogout() {
  if (!window.firebaseReady) {
    currentUser = null;
    renderAuthUI(null);
    if (onAuthChangeCallback) onAuthChangeCallback(null);
    showToast(t('toastLogoutSuccess'), 'info');
    return;
  }

  try {
    await window.auth.signOut();
    showToast(t('toastLogoutSuccess'), 'info');
  } catch (err) {
    console.error('Logout error:', err);
  }
}

/** Demo mode: simulate login without Firebase */
function simulateDemoLogin(email, name) {
  currentUser = {
    uid: 'demo-user-' + Date.now(),
    email,
    displayName: name || email.split('@')[0],
    isDemo: true
  };
  closeAuthModal();
  renderAuthUI(currentUser);
  if (onAuthChangeCallback) onAuthChangeCallback(currentUser);
  showToast(t('toastLoginSuccess') + ' (Demo Mode)', 'success');
}

// ——— Helpers ———

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) el.textContent = message;
}

function clearAuthErrors() {
  ['login-email-error', 'login-password-error', 'signup-name-error', 'signup-email-error', 'signup-password-error']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '';
    });
}

function getFriendlyError(code) {
  const errors = {
    'auth/user-not-found': 'No account found with this email',
    'auth/wrong-password': 'Incorrect password',
    'auth/email-already-in-use': 'Email is already registered',
    'auth/invalid-email': 'Invalid email address',
    'auth/weak-password': 'Password is too weak',
    'auth/too-many-requests': 'Too many attempts. Please try later.',
    'auth/network-request-failed': 'Network error. Check your connection.',
  };
  return errors[code] || 'Authentication failed. Please try again.';
}
