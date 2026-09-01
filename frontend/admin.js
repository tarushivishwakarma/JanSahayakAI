/**
 * admin.js – Admin Dashboard
 * View all applications, update statuses, show analytics
 * Admin access controlled by email whitelist
 */
import { t } from './i18n.js';
import { getCurrentUser } from './auth.js';
import { showToast } from './app.js';

const BACKEND_URL =
  localStorage.getItem('jansahayak-backend-url') ||
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : 'https://jansahayakai-ukbl.onrender.com');
const ADMIN_EMAILS = ['admin@jansahayak.in', 'admin@test.com'];

export async function initAdmin() {
  const user = getCurrentUser();
  const tableBody = document.getElementById('admin-table-body');
  const analyticsGrid = document.getElementById('admin-analytics-grid');

  if (!user) {
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--color-text-muted)">${t('loginRequired')}</td></tr>`;
    return;
  }

  const isAdmin = ADMIN_EMAILS.includes(user.email) || user.isDemo;

  if (!isAdmin) {
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--color-text-muted)">${t('noAdminAccess')}</td></tr>`;
    return;
  }

  // Show loading
  if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem"><div class="spinner" style="margin:0 auto"></div></td></tr>`;

  document.getElementById('admin-refresh-btn')?.addEventListener('click', initAdmin);

  let applications = [];

  try {
    const resp = await fetch(`${BACKEND_URL}/api/admin/applications`);
    if (resp.ok) {
      const data = await resp.json();
      applications = data.applications || [];
    } else throw new Error('Backend unavailable');
  } catch {
    // Try Firestore
    if (window.firebaseReady && window.db) {
      try {
        const snap = await window.db.collection('applications')
          .orderBy('submittedAt', 'desc')
          .limit(50)
          .get();
        applications = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (fbErr) {
        console.warn('Firestore read failed:', fbErr);
      }
    }

    // Demo data fallback
    if (!applications.length) {
      applications = getDemoApplications();
    }
  }

  renderAnalytics(analyticsGrid, applications);
  renderTable(tableBody, applications);
}

function renderAnalytics(grid, applications) {
  if (!grid) return;
  const total = applications.length;
  const reviewing = applications.filter(a => a.status === 'reviewing').length;
  const approved = applications.filter(a => a.status === 'approved').length;
  const rejected = applications.filter(a => a.status === 'rejected').length;

  grid.innerHTML = `
    <div class="glass dashboard-stat">
      <div class="big-num">${total}</div>
      <div class="stat-label">${t('adminTotal')}</div>
    </div>
    <div class="glass dashboard-stat">
      <div class="big-num" style="-webkit-text-fill-color:#facc15;color:#facc15">${reviewing}</div>
      <div class="stat-label">${t('adminPending')}</div>
    </div>
    <div class="glass dashboard-stat">
      <div class="big-num" style="-webkit-text-fill-color:var(--color-green-light);color:var(--color-green-light)">${approved}</div>
      <div class="stat-label">${t('adminApproved')}</div>
    </div>
    <div class="glass dashboard-stat">
      <div class="big-num" style="-webkit-text-fill-color:#f87171;color:#f87171">${rejected}</div>
      <div class="stat-label">${t('adminRejected')}</div>
    </div>
  `;
}

function renderTable(tableBody, applications) {
  if (!tableBody) return;
  if (!applications.length) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--color-text-muted)">No applications found</td></tr>`;
    return;
  }

  tableBody.innerHTML = '';
  applications.forEach(app => {
    const row = createTableRow(app);
    tableBody.appendChild(row);
  });
}

function createTableRow(app) {
  const statusColors = {
    submitted: '#94a3b8',
    reviewing: '#facc15',
    approved: '#22c55e',
    rejected: '#f87171'
  };
  const statusLabel = {
    submitted: t('statusSubmitted'),
    reviewing: t('statusReviewing'),
    approved: t('statusApproved'),
    rejected: t('statusRejected')
  };

  const status = app.status || 'submitted';
  const date = formatDate(app.submittedAt || app.createdAt);

  const row = document.createElement('tr');
  row.innerHTML = `
    <td style="font-family:monospace;font-size:0.78rem">${escapeHtml(String(app.applicationId || app.id || '').substring(0, 12))}…</td>
    <td>${escapeHtml(app.userEmail || app.userId || '—')}</td>
    <td>${escapeHtml(app.serviceName || app.serviceId || '—')}</td>
    <td>${date}</td>
    <td>
      <span style="color:${statusColors[status]};font-weight:600;font-size:0.85rem">
        ● ${statusLabel[status] || status}
      </span>
    </td>
    <td>
      <select class="status-select" data-app-id="${escapeHtml(String(app.id || app.applicationId))}" aria-label="Change status for application">
        <option value="submitted" ${status === 'submitted' ? 'selected' : ''}>${t('statusSubmitted')}</option>
        <option value="reviewing" ${status === 'reviewing' ? 'selected' : ''}>${t('statusReviewing')}</option>
        <option value="approved" ${status === 'approved' ? 'selected' : ''}>${t('statusApproved')}</option>
        <option value="rejected" ${status === 'rejected' ? 'selected' : ''}>${t('statusRejected')}</option>
      </select>
    </td>
  `;

  // Status change handler
  const select = row.querySelector('.status-select');
  select.addEventListener('change', async (e) => {
    const newStatus = e.target.value;
    const appId = select.dataset.appId;
    await updateApplicationStatus(appId, newStatus, app);
    // Refresh
    setTimeout(() => initAdmin(), 500);
  });

  return row;
}

async function updateApplicationStatus(appId, newStatus, app) {
  try {
    const resp = await fetch(`${BACKEND_URL}/api/applications/${appId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    if (!resp.ok) throw new Error('Backend error');
    showToast(`Status updated to: ${newStatus}`, 'success');
  } catch {
    // Firestore fallback
    if (window.firebaseReady && window.db && appId) {
      try {
        await window.db.collection('applications').doc(appId).update({ status: newStatus });
        showToast(`Status updated to: ${newStatus}`, 'success');
        return;
      } catch (fbErr) {
        console.warn('Firestore update failed:', fbErr);
      }
    }
    // localStorage fallback
    updateLocalStatus(appId, newStatus);
    showToast(`Status updated (offline): ${newStatus}`, 'info');
  }
}

function updateLocalStatus(appId, newStatus) {
  try {
    const apps = JSON.parse(localStorage.getItem('jansahayak-applications') || '[]');
    const idx = apps.findIndex(a => a.applicationId === appId || a.id === appId);
    if (idx >= 0) {
      apps[idx].status = newStatus;
      localStorage.setItem('jansahayak-applications', JSON.stringify(apps));
    }
  } catch (e) {}
}

// Demo data for when nothing is available
function getDemoApplications() {
  return [
    { id: 'demo-1', applicationId: 'APP-1748000001', userEmail: 'user1@example.com', userId: 'user1', serviceName: 'Aadhaar Correction', status: 'submitted', submittedAt: new Date(Date.now() - 86400000).toISOString() },
    { id: 'demo-2', applicationId: 'APP-1748000002', userEmail: 'user2@example.com', userId: 'user2', serviceName: 'Scholarship Form', status: 'reviewing', submittedAt: new Date(Date.now() - 172800000).toISOString() },
    { id: 'demo-3', applicationId: 'APP-1748000003', userEmail: 'user3@example.com', userId: 'user3', serviceName: 'Pension Scheme', status: 'approved', submittedAt: new Date(Date.now() - 259200000).toISOString() },
    { id: 'demo-4', applicationId: 'APP-1748000004', userEmail: 'user4@example.com', userId: 'user4', serviceName: 'Income Certificate', status: 'rejected', submittedAt: new Date(Date.now() - 345600000).toISOString() },
    { id: 'demo-5', applicationId: 'APP-1748000005', userEmail: 'user5@example.com', userId: 'user5', serviceName: 'Ration Card', status: 'reviewing', submittedAt: new Date(Date.now() - 432000000).toISOString() }
  ];
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
