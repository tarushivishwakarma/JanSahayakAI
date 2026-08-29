/**
 * tracker.js – Application Status Tracker
 * Shows user's submitted applications with status (Submitted → Approved)
 * Data pulled from: Backend API > Firestore > localStorage (fallback)
 */
import { t, getLang } from './i18n.js';
import { getCurrentUser } from './auth.js';
import { showToast } from './app.js';

const BACKEND_URL = localStorage.getItem('jansahayak-backend-url') || 'http://localhost:8000';

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

  try {
    // Try backend API first
    const resp = await fetch(`${BACKEND_URL}/api/applications/user/${user.uid}`, {
      headers: { 'X-User-ID': user.uid }
    });
    if (resp.ok) {
      const data = await resp.json();
      applications = data.applications || [];
    } else throw new Error('Backend unavailable');
  } catch {
    // Try Firestore
    if (window.firebaseReady && window.db) {
      try {
        const snap = await window.db.collection('applications')
          .where('userId', '==', user.uid)
          .orderBy('submittedAt', 'desc')
          .limit(20)
          .get();
        applications = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (fbErr) {
        console.warn('Firestore read failed:', fbErr);
      }
    }

    // Fallback to localStorage
    if (!applications.length) {
      const local = JSON.parse(localStorage.getItem('jansahayak-applications') || '[]');
      applications = local.filter(a => a.userId === user.uid || a.userId === 'anonymous');
    }
  }

  renderTrackerCards(container, applications);
}

function renderTrackerCards(container, applications) {
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

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr.seconds ? dateStr.seconds * 1000 : dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
}

function escapeHtml(str) {
  return String(str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
