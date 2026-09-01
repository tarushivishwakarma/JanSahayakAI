/**
 * form-wizard.js – Step-by-step form wizard for all 6 services
 * Features: one question per screen, progress bar, validation, offline save, OCR autofill
 */
import { t, getLang } from './i18n.js';
import { showToast } from './app.js';
import { getCurrentUser } from './auth.js';

let currentServiceId = null;
let currentStepIndex = 0;
let formData = {};
let steps = [];
let onSubmitSuccessCb = null;
const STORAGE_KEY_PREFIX = 'jansahayak-form-';

export function initFormWizard({ onSubmitSuccess }) {
  onSubmitSuccessCb = onSubmitSuccess;

  document.getElementById('wizard-back-btn')?.addEventListener('click', () => {
    import('./app.js').then(m => m.navigateTo('dashboard'));
  });
}

/** Start wizard for a given service */
export function startWizard(serviceId) {
  currentServiceId = serviceId;
  currentStepIndex = 0;
  formData = {};

  const wizardServices = t('wizardServices');
  const service = wizardServices[serviceId];
  if (!service) {
    console.error('Unknown service:', serviceId);
    return;
  }

  steps = service.steps;

  // Update header
  document.getElementById('wizard-service-name').textContent = service.name;

  // Check for saved offline progress
  const saved = loadOfflineProgress(serviceId);
  if (saved && Object.keys(saved).length > 0) {
    formData = saved;
    showToast(t('wizardRestored'), 'info');
    // Find the last answered step
    let lastAnswered = -1;
    steps.forEach((step, i) => {
      if (formData[step.key] !== undefined) lastAnswered = i;
    });
    currentStepIndex = Math.min(lastAnswered + 1, steps.length - 1);
  }

  renderStep();
}

/** Render the current wizard step */
function renderStep() {
  const container = document.getElementById('wizard-step-container');
  if (!container || !steps.length) return;

  const step = steps[currentStepIndex];
  const total = steps.length;
  const pct = Math.round((currentStepIndex / total) * 100);

  // Update progress
  document.getElementById('wizard-progress-fill').style.width = pct + '%';
  document.getElementById('wizard-progress-text').textContent =
    `${t('wizardStep')} ${currentStepIndex + 1} ${t('of')} ${total}`;

  // Build step HTML
  let inputHtml = '';
  const savedVal = formData[step.key] || '';

  if (step.type === 'select' && step.options) {
    inputHtml = `
      <div class="wizard-options-grid" role="group" aria-label="${escapeHtml(step.question)}">
        ${step.options.map(opt => `
          <button class="wizard-option-btn ${savedVal === opt ? 'selected' : ''}"
            data-value="${escapeHtml(opt)}"
            aria-pressed="${savedVal === opt}"
          >${escapeHtml(opt)}</button>
        `).join('')}
      </div>
    `;
  } else if (step.type === 'number') {
    inputHtml = `
      <input
        type="number"
        class="form-input"
        id="wizard-input"
        value="${escapeHtml(String(savedVal))}"
        placeholder="${step.hint || ''}"
        aria-label="${escapeHtml(step.question)}"
        min="0"
        style="font-size:1.1rem;padding:1rem"
      />
    `;
  } else {
    inputHtml = `
      <input
        type="text"
        class="form-input"
        id="wizard-input"
        value="${escapeHtml(String(savedVal))}"
        placeholder="${step.hint || ''}"
        aria-label="${escapeHtml(step.question)}"
        style="font-size:1.1rem;padding:1rem"
        autocomplete="on"
      />
    `;
  }

  const isLast = currentStepIndex === steps.length - 1;

  container.innerHTML = `
    <div class="wizard-step">
      <p class="wizard-question">${escapeHtml(step.question)}</p>
      ${step.hint ? `<p class="wizard-hint">${escapeHtml(step.hint)}</p>` : ''}

      ${inputHtml}

      <span class="field-error" id="wizard-error"></span>

      <div class="wizard-nav">
        ${currentStepIndex > 0 ? `<button class="btn btn-outline" id="wizard-prev" aria-label="Previous step">← ${t('wizardBack').replace('← ', '')}</button>` : ''}
        <button class="btn btn-primary" id="wizard-next" style="margin-left:auto" aria-label="${isLast ? 'Submit application' : 'Next step'}">
          ${isLast ? `✅ ${t('wizardSubmit')}` : `${t('wizardNext')}`}
        </button>
      </div>
    </div>
  `;

  // Option buttons
  container.querySelectorAll('.wizard-option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.wizard-option-btn').forEach(b => {
        b.classList.remove('selected');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('selected');
      btn.setAttribute('aria-pressed', 'true');
    });
  });

  // Prev / Next buttons
  document.getElementById('wizard-prev')?.addEventListener('click', goToPrevStep);
  document.getElementById('wizard-next')?.addEventListener('click', goToNextStep);

  // Enter key for text/number inputs
  const input = document.getElementById('wizard-input');
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') goToNextStep();
  });
  input?.focus();
}

function goToNextStep() {
  const value = getStepValue();
  const step = steps[currentStepIndex];

  // Validate
  const error = validateStep(step, value);
  if (error) {
    const errEl = document.getElementById('wizard-error');
    if (errEl) errEl.textContent = error;
    return;
  }

  // Save value
  formData[step.key] = value;
  saveOfflineProgress(currentServiceId, formData);
  showToast(t('wizardSaved'), 'info');

  if (currentStepIndex < steps.length - 1) {
    currentStepIndex++;
    renderStep();
  } else {
    submitForm();
  }
}

function goToPrevStep() {
  if (currentStepIndex > 0) {
    currentStepIndex--;
    renderStep();
  }
}

function getStepValue() {
  const step = steps[currentStepIndex];
  if (step.type === 'select') {
    const selected = document.querySelector('.wizard-option-btn.selected');
    return selected ? selected.dataset.value : '';
  }
  const input = document.getElementById('wizard-input');
  return input ? input.value.trim() : '';
}

function validateStep(step, value) {
  const lang = getLang();
  if (!value || value === '') {
    return lang === 'hi' ? 'यह फ़ील्ड आवश्यक है' : 'This field is required';
  }
  if (step.type === 'number') {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) {
      return lang === 'hi' ? 'कृपया एक वैध संख्या दर्ज करें' : 'Please enter a valid number';
    }
  }
  return null; // No error
}

async function submitForm() {
  const user = getCurrentUser();
  const applicationData = {
    serviceId: currentServiceId,
    serviceName: t('wizardServices')[currentServiceId]?.name || currentServiceId,
    formData: { ...formData },
    userId: user?.uid || 'anonymous',
    userEmail: user?.email || '',
    status: 'submitted',
    submittedAt: new Date().toISOString(),
    applicationId: 'APP-' + Date.now()
  };

  try {
    // Try to save to backend API
    const backendUrl = getBackendUrl();
    const resp = await fetch(`${backendUrl}/api/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(applicationData)
    });

    if (!resp.ok) throw new Error('Backend error');
    const result = await resp.json();
    applicationData.applicationId = result.application_id || applicationData.applicationId;

  } catch (err) {
    // Fallback: save to Firestore if available
    if (window.firebaseReady && window.db && getCurrentUser()) {
      try {
        await window.db.collection('applications').add({
          ...applicationData,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (fbErr) {
        console.warn('Firestore save failed:', fbErr);
      }
    }
    // Always save to localStorage as offline backup
    saveApplicationLocally(applicationData);
  }

  // Clear saved progress
  clearOfflineProgress(currentServiceId);

  if (onSubmitSuccessCb) onSubmitSuccessCb(applicationData);
}

// ——— Offline Support ———
function saveOfflineProgress(serviceId, data) {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + serviceId, JSON.stringify(data));
  } catch (e) {}
}

function loadOfflineProgress(serviceId) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + serviceId);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function clearOfflineProgress(serviceId) {
  try {
    localStorage.removeItem(STORAGE_KEY_PREFIX + serviceId);
  } catch (e) {}
}

function saveApplicationLocally(application) {
  try {
    const existing = JSON.parse(localStorage.getItem('jansahayak-applications') || '[]');
    existing.push(application);
    localStorage.setItem('jansahayak-applications', JSON.stringify(existing));
  } catch (e) {}
}

/** Auto-fill form fields from OCR extracted data */
export function autoFillFromOcr(ocrData) {
  // Map OCR fields to current form data
  if (ocrData.name) formData['fullName'] = ocrData.name;
  if (ocrData.dob) formData['dob'] = ocrData.dob;
  if (ocrData.address) formData['address'] = ocrData.address;

  // Re-render current step to show pre-filled data
  renderStep();
}

function getBackendUrl() {
  return localStorage.getItem('jansahayak-backend-url') || 'http://localhost:8000';
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
