/**
 * utils.js – Centralized Shared Utilities and Authenticated Fetch for JanSahayakAI.
 * 
 * Provides:
 * - getBackendUrl(): Resolves local vs production backend API URL
 * - escapeHtml(str): XSS prevention helper
 * - formatDate(dateStr): Localized date formatter
 * - sanitizeUrl(url): Strict URL sanitizer rejecting javascript:, data:, etc.
 * - getOrInitAuthUser(): Returns current user or triggers Firebase anonymous auth
 * - getAuthToken(forceRefresh): Retrieves valid Firebase ID token
 * - authFetch(url, options): Authenticated HTTP fetch with Bearer token injection
 */

/**
 * Resolves the backend API base URL from localStorage override or current hostname.
 */
export function getBackendUrl() {
  return (
    localStorage.getItem('jansahayak-backend-url') ||
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:8000'
      : 'https://jansahayakai-ukbl.onrender.com')
  );
}

/**
 * Safely escapes HTML special characters to prevent DOM-based XSS.
 */
export function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Formats date strings into a clean Indian English format.
 */
export function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (e) {
    return String(dateStr);
  }
}

/**
 * Centralized safe URL sanitizer.
 * Enforces http: or https: scheme only.
 * Rejects javascript:, data:, vbscript:, malformed schemes, and relative exploits.
 * Returns '#' if unsafe or invalid.
 */
export function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') {
    return '#';
  }
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();

  // Explicitly deny dangerous pseudo-protocols
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:') ||
    lower.startsWith('blob:')
  ) {
    console.warn('Rejected unsafe URL scheme:', trimmed);
    return '#';
  }

  try {
    const base = typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost';
    const parsed = new URL(trimmed, base);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return trimmed;
    }
  } catch (e) {
    // Allow relative paths starting with a single '/'
    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
      return trimmed;
    }
  }
  return '#';
}

/**
 * Obtains current authenticated Firebase user.
 * If user is not logged in, attempts Firebase Anonymous Authentication so unauthenticated
 * citizens (e.g. asking queries in floating chatbot) receive a valid Firebase session.
 */
export async function getOrInitAuthUser() {
  if (!window.firebaseReady || !window.auth) {
    return null;
  }

  let user = window.auth.currentUser;
  if (user) {
    return user;
  }

  // Attempt anonymous sign-in if enabled in Firebase
  try {
    const cred = await window.auth.signInAnonymously();
    return cred.user;
  } catch (err) {
    // Log only safe error code, never sensitive message details or tokens
    console.warn('Firebase anonymous authentication unavailable:', err.code || 'AUTH_UNAVAILABLE');
    return null;
  }
}

/**
 * Retrieves a fresh Firebase ID token.
 */
export async function getAuthToken(forceRefresh = false) {
  try {
    const user = await getOrInitAuthUser();
    if (user && typeof user.getIdToken === 'function') {
      return await user.getIdToken(forceRefresh);
    }
  } catch (err) {
    console.warn('Error fetching Firebase ID token:', err.code || 'TOKEN_FETCH_ERROR');
  }
  return null;
}

/**
 * Authenticated fetch wrapper with integrated timeout support.
 * Automatically injects Authorization Bearer header with Firebase ID token.
 * Defaults to 30-second timeout unless caller specifies custom timeout or signal.
 */
export async function authFetch(url, options = {}) {
  const { timeout, signal, ...restOpts } = options;
  const opts = { ...restOpts };
  opts.headers = { ...(opts.headers || {}) };

  try {
    const token = await getAuthToken();
    if (token) {
      opts.headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (err) {
    console.warn('Could not attach authorization token to request:', err.code || 'AUTH_ATTACH_ERROR');
  }

  // Determine timeout duration: explicit timeout, or 30s default if no caller signal provided
  const timeoutMs = timeout !== undefined ? timeout : (signal ? 0 : 30000);

  if (timeoutMs <= 0 && signal) {
    opts.signal = signal;
    return fetch(url, opts);
  }

  const controller = new AbortController();
  let timerId = null;

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', () => controller.abort());
    }
  }

  if (timeoutMs > 0) {
    timerId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
  }

  opts.signal = controller.signal;

  try {
    const resp = await fetch(url, opts);
    return resp;
  } catch (err) {
    if (controller.signal.aborted && !signal?.aborted) {
      const timeoutErr = new Error(`Request timed out after ${timeoutMs}ms`);
      timeoutErr.name = 'TimeoutError';
      timeoutErr.isTimeout = true;
      throw timeoutErr;
    }
    throw err;
  } finally {
    if (timerId) clearTimeout(timerId);
  }
}
