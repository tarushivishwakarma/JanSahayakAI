/**
 * services.js – Smart Service Dashboard (6 government services)
 */
import { t } from './i18n.js';

let onServiceSelectCb = null;

export function initServices({ onServiceSelect }) {
  onServiceSelectCb = onServiceSelect;
  renderServiceCards();

  document.getElementById('ocr-trigger-btn')?.addEventListener('click', () => {
    document.getElementById('ocr-modal')?.classList.remove('hidden');
  });
}

export function renderServiceCards() {
  const grid = document.getElementById('service-cards-grid');
  if (!grid) return;

  const services = t('services');
  grid.innerHTML = '';

  services.forEach((service, i) => {
    const card = document.createElement('div');
    card.className = 'glass service-card animate-in';
    card.style.animationDelay = `${i * 0.08}s`;
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Apply for ${service.title}`);

    card.innerHTML = `
      <div class="service-icon" style="background:${service.color}22;color:${service.color}">
        ${service.icon}
      </div>
      <h3>${escapeHtml(service.title)}</h3>
      <p>${escapeHtml(service.desc)}</p>
      <button class="btn btn-primary" aria-label="${escapeHtml(t('applyBtn'))} - ${escapeHtml(service.title)}">
        ${escapeHtml(t('applyBtn'))}
      </button>
    `;

    const btn = card.querySelector('.btn');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (onServiceSelectCb) onServiceSelectCb(service.id);
    });

    // Keyboard support on the card
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (onServiceSelectCb) onServiceSelectCb(service.id);
      }
    });

    grid.appendChild(card);
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
