/**
 * services.js – Smart Service Dashboard (6 government services)
 */
import { t } from './i18n.js';
import { escapeHtml } from './utils.js';

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

    // Click anywhere on card to select service
    card.addEventListener('click', () => {
      if (onServiceSelectCb) onServiceSelectCb(service.id);
    });

    grid.appendChild(card);
  });
}

