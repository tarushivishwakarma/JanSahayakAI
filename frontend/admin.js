/**
 * admin.js – Admin Dashboard
 * View all applications, update statuses, show analytics
 * Backend is authoritative for admin access — frontend does not implement admin access control.
 */
import { t } from './i18n.js';
import { getCurrentUser } from './auth.js';
import { showToast } from './app.js';
import { getBackendUrl, formatDate, escapeHtml, authFetch } from './utils.js';

export async function initAdmin() {
  const user = getCurrentUser();
  const tableBody = document.getElementById('admin-table-body');
  const analyticsGrid = document.getElementById('admin-analytics-grid');

  if (!user) {
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--color-text-muted)">${t('loginRequired')}</td></tr>`;
    return;
  }

  // Show loading
  if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem"><div class="spinner" style="margin:0 auto"></div></td></tr>`;

  document.getElementById('admin-refresh-btn')?.addEventListener('click', initAdmin);

  let applications = [];
  let loadError = null;

  try {
    const resp = await authFetch(`${getBackendUrl()}/api/admin/applications`);
    if (resp.ok) {
      const data = await resp.json();
      applications = data.applications || [];
    } else if (resp.status === 401 || resp.status === 403) {
      // Backend denied access — show permission denied, do not fall back to fake data
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--color-text-muted)">${t('noAdminAccess')}</td></tr>`;
      if (analyticsGrid) analyticsGrid.innerHTML = '';
      return;
    } else {
      throw new Error(`Backend returned HTTP ${resp.status}`);
    }
  } catch (err) {
    // Try Firestore as secondary source (admin access verified by Firestore rules)
    if (window.firebaseReady && window.db) {
      try {
        const snap = await window.db.collection('applications')
          .orderBy('submittedAt', 'desc')
          .limit(50)
          .get();
        applications = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (fbErr) {
        console.warn('Firestore read failed:', fbErr);
        loadError = 'Database temporarily unavailable.';
      }
    } else {
      loadError = 'Service unavailable. Please try again later.';
    }

    // If both sources failed: show honest error — never show fabricated data
    if (!applications.length && loadError) {
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--color-text-muted)">⚠️ ${escapeHtml(loadError)}</td></tr>`;
      if (analyticsGrid) analyticsGrid.innerHTML = '';
      showToast('Could not load applications. ' + loadError, 'error');
      return;
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
    const resp = await authFetch(`${getBackendUrl()}/api/applications/${appId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    if (!resp.ok) throw new Error(`Backend error: ${resp.status}`);
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

