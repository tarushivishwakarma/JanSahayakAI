/**
 * tracker.js – Application Status Tracker
 * Shows user's submitted applications with status (Submitted → Approved)
 * Data pulled from: Backend API > Firestore > localStorage (fallback)
 */
import { t, getLang } from './i18n.js';
import { getCurrentUser } from './auth.js';
import { showToast } from './app.js';
import { getBackendUrl, formatDate, escapeHtml, authFetch } from './utils.js';

export async function initTracker() {
  const user = getCurrentUser();
  const container = document.getElementById('tracker-list');
  if (!container) return;

  if (!user) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">🔒</div>
        <h3>${t('trackerTitle')}</h3>
        <p>${t('loginToTrack')}</p>
        <button class="btn btn-primary" onclick="document.getElementById('nav-login-btn').click()" style="margin-top:1rem">
          ${t('navLogin')}
        </button>
      </div>`;
    return;
  }

  container.innerHTML = `<div class="flex-center" style="padding:2rem"><div class="spinner"></div></div>`;

  let applications = [];
  let isDegraded = false;
  let serviceError = null;

  try {
    // Try backend API first with verified authentication
    const backendUrl = getBackendUrl();
    const resp = await authFetch(`${backendUrl}/api/applications/user/${user.uid}`, { timeout: 15000 });
    if (resp.ok) {
      const data = await resp.json();
      applications = data.applications || [];
    } else if (resp.status === 401) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">🔒</div>
          <h3>${t('trackerTitle')}</h3>
          <p>Your session has expired. Please sign in again.</p>
          <button class="btn btn-primary" onclick="document.getElementById('nav-login-btn').click()" style="margin-top:1rem">
            ${t('navLogin')}
          </button>
        </div>`;
      return;
    } else if (resp.status === 403) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">🚫</div>
          <h3>${t('trackerTitle')}</h3>
          <p>Access denied.</p>
        </div>`;
      return;
    } else if (resp.status === 503) {
      serviceError = 'Application service is temporarily unavailable.';
      throw new Error('503');
    } else {
      serviceError = 'Unable to reach the server. Please try again.';
      throw new Error(`HTTP ${resp.status}`);
    }
  } catch (err) {
    if (!serviceError) {
      const isTimeout = err.name === 'TimeoutError' || err.isTimeout;
      serviceError = isTimeout
        ? 'Unable to reach the server. Please try again.'
        : 'Unable to reach the server. Please try again.';
    }

    // Attempt secondary fallback to Firestore
    if (window.firebaseReady && window.db) {
      try {
        const snap = await window.db.collection('applications')
          .where('userId', '==', user.uid)
          .orderBy('submittedAt', 'desc')
          .limit(20)
          .get();
        applications = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (applications.length > 0) isDegraded = true;
      } catch (fbErr) {
        console.warn('Firestore fallback read failed:', fbErr.code || 'FIRESTORE_ERROR');
      }
    }

    // Fallback to localStorage
    if (!applications.length) {
      try {
        const local = JSON.parse(localStorage.getItem('jansahayak-applications') || '[]');
        applications = local.filter(a => a.userId === user.uid || a.userId === 'anonymous');
        if (applications.length > 0) isDegraded = true;
      } catch (e) {}
    }

    // If no fallback data exists: show authoritative error with retry, not false empty state
    if (!applications.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">⚠️</div>
          <h3>${t('trackerTitle')}</h3>
          <p>${escapeHtml(serviceError)}</p>
          <button class="btn btn-primary btn-sm" id="tracker-retry-btn" style="margin-top:1rem">Try Again</button>
        </div>`;
      document.getElementById('tracker-retry-btn')?.addEventListener('click', initTracker);
      return;
    }
  }

  renderTrackerCards(container, applications, isDegraded);
}


function renderTrackerCards(container, applications, isDegraded = false) {
  if (!applications.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📋</div>
        <h3>No Applications Yet</h3>
        <p>${t('noApplications')}</p>
        <button class="btn btn-primary" id="goto-services-btn" style="margin-top:1rem">${t('navServices')}</button>
      </div>`;

    document.getElementById('goto-services-btn')?.addEventListener('click', () => {
      import('./app.js').then(m => m.navigateTo('dashboard'));
    });
    return;
  }

  container.innerHTML = '';
  if (isDegraded) {
    const banner = document.createElement('div');
    banner.className = 'glass';
    banner.style.cssText = 'padding:0.75rem 1rem;margin-bottom:1.5rem;border-left:4px solid #f59e0b;font-size:0.875rem;color:var(--color-text-muted);border-radius:var(--radius-sm);';
    banner.innerHTML = `⚠️ <strong>Authoritative application service is temporarily unreachable.</strong> Showing cached application records. Processing status updates may be delayed.`;
    container.appendChild(banner);
  }

  applications.forEach(app => {
    const card = createTrackerCard(app);
    container.appendChild(card);
  });
}


function createTrackerCard(app) {
  const status = app.status || 'submitted';
  const statusMap = {
    submitted: { label: t('statusSubmitted'), class: 'badge-blue', statusClass: 'status-submitted' },
    reviewing: { label: t('statusReviewing'), class: 'badge-yellow', statusClass: 'status-reviewing' },
    approved: { label: t('statusApproved'), class: 'badge-green', statusClass: 'status-approved' },
    rejected: { label: t('statusRejected'), class: 'badge-red', statusClass: 'status-rejected' }
  };
  const { label, class: badgeClass, statusClass } = statusMap[status] || statusMap.submitted;

  const date = formatDate(app.submittedAt || app.createdAt);

  const card = document.createElement('div');
  card.className = `glass track-card ${statusClass}`;
  card.innerHTML = `
    <div class="track-status-dot" aria-hidden="true"></div>
    <div class="track-info">
      <div class="track-service-name">${escapeHtml(app.serviceName || app.serviceId || 'Service')}</div>
      <div class="track-app-id">ID: ${escapeHtml(app.applicationId || app.id || '—')}</div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.4rem">
      <span class="badge ${badgeClass}" role="status">${label}</span>
      <span class="track-date">${date}</span>
    </div>
  `;
  return card;
}
