/**
 * scheme-results.js – Scheme matching logic + results display
 * Ported from React SchemeResults.tsx — preserves identical matching algorithm
 */

import { t, getLang } from './i18n.js';

let schemesData = [];
let currentUserData = null;
let matchedSchemes = [];

// ——— Init ———
export function initSchemeResults({ onBack }) {
  loadSchemes();

  document.getElementById('results-back-btn')?.addEventListener('click', () => {
    if (onBack) onBack();
  });

  document.getElementById('view-dashboard-btn')?.addEventListener('click', showDashboardView);
  document.getElementById('back-to-results-btn')?.addEventListener('click', showResultsView);
  document.getElementById('back-from-detail-btn')?.addEventListener('click', showResultsView);
}

async function loadSchemes() {
  try {
    const res = await fetch('./data/schemes.json');
    schemesData = await res.json();
  } catch (e) {
    console.error('Failed to load schemes:', e);
    schemesData = [];
  }
}

// ——— Render Results (called from app.js) ———
export function renderResults(userData) {
  currentUserData = userData;
  matchedSchemes = filterSchemes(userData);

  showResultsView();
  renderSchemeCards();
  updateResultsHeader();
}

/** Identical matching logic from SchemeResults.tsx */
function filterSchemes(userData) {
  return schemesData.filter(scheme => {
    const stateMatch = scheme.state === 'All' || scheme.state === userData.state;
    const incomeMatch = userData.income >= scheme.minIncome && userData.income <= scheme.maxIncome;
    const ageMatch = userData.age >= scheme.minAge && userData.age <= scheme.maxAge;
    const categoryMatch = scheme.socialCategory.includes(userData.category);
    const occupationMatch = scheme.occupation.includes('All') || scheme.occupation.includes(userData.occupation);
    const genderMatch = scheme.gender === 'All' || scheme.gender === userData.gender;
    const disabilityMatch = scheme.disability === 'Any'
      || (scheme.disability === 'Yes' && userData.disability === 'Yes')
      || (scheme.disability === 'No' && userData.disability === 'No');
    const maritalMatch = !scheme.maritalStatus || scheme.maritalStatus === userData.maritalStatus;

    return stateMatch && incomeMatch && ageMatch && categoryMatch && occupationMatch && genderMatch && disabilityMatch && maritalMatch;
  });
}

function updateResultsHeader() {
  const matchText = document.getElementById('results-match-text');
  if (matchText) {
    matchText.textContent = `${matchedSchemes.length} ${t('matchFound')}`;
  }
}

function renderSchemeCards() {
  const container = document.getElementById('scheme-cards-container');
  if (!container) return;

  const lang = getLang();
  container.innerHTML = '';

  if (matchedSchemes.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="icon">🔍</div>
        <h3>No Matches Found</h3>
        <p>${t('noMatch')}</p>
      </div>`;
    return;
  }

  matchedSchemes.forEach((scheme, idx) => {
    const card = createSchemeCard(scheme, lang);
    card.style.animationDelay = `${idx * 0.08}s`;
    card.classList.add('animate-in');
    container.appendChild(card);
  });
}

function createSchemeCard(scheme, lang) {
  const name = lang === 'hi' ? scheme.nameHi : scheme.name;
  const benefit = lang === 'hi' ? scheme.benefitHi : scheme.benefit;
  const desc = lang === 'hi' ? scheme.descriptionHi : scheme.description;
  const reasons = getEligibilityReasons(scheme, lang);
  const iscentral = scheme.category === 'Central';
  const badgeClass = iscentral ? 'badge-orange' : 'badge-green';
  const categoryLabel = iscentral ? t('central') : t('state');

  const card = document.createElement('div');
  card.className = 'glass scheme-card';
  card.innerHTML = `
    <div class="scheme-card-header">
      <h3>${escapeHtml(name)}</h3>
      <span class="badge ${badgeClass}">${categoryLabel}</span>
    </div>
    <p style="font-size:0.85rem;color:var(--color-text-muted);margin-bottom:0.75rem">${escapeHtml(desc)}</p>
    <div class="scheme-benefit">💰 ${escapeHtml(benefit)}</div>
    <div class="scheme-reasons">
      ${reasons.slice(0, 3).map(r => `<span class="scheme-reason">✓ ${escapeHtml(r.split(':')[0])}</span>`).join('')}
    </div>
    <div class="scheme-actions">
      <button class="btn btn-primary btn-sm" data-scheme-id="${scheme.id}" aria-label="Know more about ${escapeHtml(name)}">${t('knowMore')}</button>
      <a href="${scheme.applyLink}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm" aria-label="Apply for ${escapeHtml(name)}">
        🔗 ${t('applyNow')}
      </a>
    </div>
  `;

  card.querySelector('[data-scheme-id]').addEventListener('click', () => showSchemeDetail(scheme));
  return card;
}

function getEligibilityReasons(scheme, lang) {
  const u = currentUserData;
  if (!u) return [];
  const reasons = [];
  if (scheme.state === u.state) reasons.push(`State: ${u.state}`);
  if (u.age >= scheme.minAge && u.age <= scheme.maxAge)
    reasons.push(`Age: ${u.age} years`);
  if (u.income <= scheme.maxIncome)
    reasons.push(`Income: ₹${Number(u.income).toLocaleString('en-IN')}`);
  if (scheme.socialCategory.includes(u.category))
    reasons.push(`Category: ${u.category}`);
  if (scheme.occupation.includes(u.occupation))
    reasons.push(`Occupation: ${u.occupation}`);
  return reasons;
}

// ——— View Switching ———
function showResultsView() {
  document.getElementById('results-view').style.display = '';
  document.getElementById('dashboard-view').style.display = 'none';
  document.getElementById('scheme-detail-view').style.display = 'none';
}

function showDashboardView() {
  document.getElementById('results-view').style.display = 'none';
  document.getElementById('dashboard-view').style.display = '';
  document.getElementById('scheme-detail-view').style.display = 'none';
  renderDashboard();
}

function showSchemeDetail(scheme) {
  document.getElementById('results-view').style.display = 'none';
  document.getElementById('dashboard-view').style.display = 'none';
  document.getElementById('scheme-detail-view').style.display = '';
  renderSchemeDetail(scheme);
}

// ——— Dashboard View ———
function renderDashboard() {
  const lang = getLang();
  const central = matchedSchemes.filter(s => s.category === 'Central');
  const state = matchedSchemes.filter(s => s.category === 'State');

  const estimatedBenefit = matchedSchemes.reduce((total, scheme) => {
    const match = scheme.benefit.match(/₹([\d,]+)/);
    if (match) return total + parseInt(match[1].replace(/,/g, ''));
    return total;
  }, 0);

  // Stats grid
  const statsGrid = document.getElementById('dashboard-stats-grid');
  if (statsGrid) {
    statsGrid.innerHTML = `
      <div class="glass dashboard-stat">
        <div class="big-num">${matchedSchemes.length}</div>
        <div class="stat-label">${t('totalMatched')}</div>
      </div>
      <div class="glass dashboard-stat">
        <div class="big-num">${central.length}</div>
        <div class="stat-label">${t('centralSchemes')}</div>
      </div>
      <div class="glass dashboard-stat">
        <div class="big-num">${state.length}</div>
        <div class="stat-label">${t('stateSchemes')}</div>
      </div>
    `;
  }

  // Estimated benefit
  const breakdown = document.getElementById('dashboard-breakdown');
  if (breakdown) {
    breakdown.innerHTML = `
      <h3 style="font-size:1.1rem;margin-bottom:0.5rem">${t('estimatedBenefit')}</h3>
      <div class="gradient-text" style="font-size:2.5rem;font-weight:800;margin-bottom:0.4rem">₹${estimatedBenefit.toLocaleString('en-IN')}+</div>
      <p style="font-size:0.8rem;color:var(--color-text-muted);margin-bottom:1.5rem">${t('estimatedNote')}</p>
      <h3 style="font-size:1rem;font-weight:600;margin-bottom:0.75rem">${t('schemeBreakdown')}</h3>
      <div style="display:flex;flex-direction:column;gap:0.5rem">
        ${matchedSchemes.map(s => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:0.6rem 0.8rem;background:var(--bg-card);border-radius:var(--radius-sm)">
            <div>
              <div style="font-size:0.9rem">${escapeHtml(lang === 'hi' ? s.nameHi : s.name)}</div>
              <div style="font-size:0.75rem;color:var(--color-green-light)">${escapeHtml(lang === 'hi' ? s.benefitHi : s.benefit)}</div>
            </div>
            <span class="badge ${s.category === 'Central' ? 'badge-orange' : 'badge-green'}">${s.category === 'Central' ? t('central') : t('state')}</span>
          </div>
        `).join('')}
      </div>
    `;
  }
}

// ——— Scheme Detail ———
function renderSchemeDetail(scheme) {
  const lang = getLang();
  const name = lang === 'hi' ? scheme.nameHi : scheme.name;
  const benefit = lang === 'hi' ? scheme.benefitHi : scheme.benefit;
  const desc = lang === 'hi' ? scheme.descriptionHi : scheme.description;
  const reasons = getEligibilityReasons(scheme, lang);
  const iscentral = scheme.category === 'Central';

  const content = document.getElementById('scheme-detail-content');
  if (!content) return;

  content.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem">
      <div>
        <h2 style="font-size:1.5rem;margin-bottom:0.5rem">${escapeHtml(name)}</h2>
        <span class="badge ${iscentral ? 'badge-orange' : 'badge-green'}">${iscentral ? t('central') : t('state')}</span>
      </div>
      <span style="font-size:2rem">✅</span>
    </div>

    <p style="color:var(--color-text-muted);margin-bottom:2rem">${escapeHtml(desc)}</p>

    <!-- Why Eligible -->
    <div class="scheme-detail-section">
      <h3>✅ ${t('whyEligible')}</h3>
      ${reasons.map(r => `<div class="eligibility-item">✓ ${escapeHtml(r)}</div>`).join('')}
    </div>

    <!-- Benefits -->
    <div class="scheme-detail-section">
      <h3>💰 ${t('benefits')}</h3>
      <div style="background:rgba(22,163,74,0.1);border-radius:var(--radius-md);padding:1rem">
        <div style="font-size:1.4rem;font-weight:700;color:var(--color-green-light)">${escapeHtml(benefit)}</div>
      </div>
    </div>

    <!-- Documents -->
    <div class="scheme-detail-section">
      <h3>📄 ${t('documents')}</h3>
      ${scheme.documents.map(doc => `<div class="doc-item">📋 ${escapeHtml(doc)}</div>`).join('')}
    </div>

    <!-- How to Apply -->
    <div class="scheme-detail-section">
      <h3>🗺️ ${t('howToApply')}</h3>
      <ol style="list-style:decimal;padding-left:1.25rem;color:var(--color-text-muted);font-size:0.9rem;line-height:2">
        <li>${t('visitPortal')}</li>
        <li>${t('fillForm')}</li>
        <li>${t('uploadDocs')}</li>
        <li>${t('submitNote')}</li>
      </ol>
    </div>

    <!-- Official Link -->
    <div>
      <h3 style="margin-bottom:0.75rem">🔗 ${t('officialLink')}</h3>
      <a href="${scheme.applyLink}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" aria-label="Apply for ${escapeHtml(name)}">
        🚀 ${t('applyNow')}
      </a>
      <button class="btn btn-outline" style="margin-left:0.5rem" id="ask-ai-scheme-btn" aria-label="Ask AI about ${escapeHtml(name)}">🤖 Ask AI</button>
    </div>
  `;

  document.getElementById('ask-ai-scheme-btn')?.addEventListener('click', () => {
    import('./chatbot.js').then(m => {
      const msg = lang === 'en' 
        ? `I have a question about the ${name} scheme.`
        : `मुझे ${name} योजना के बारे में एक सवाल है।`;
      m.openFaqWithContext(msg, { scheme_context: scheme });
    });
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
