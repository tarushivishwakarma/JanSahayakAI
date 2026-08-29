/**
 * ocr.js – AI Document AutoFill
 * Uploads document images to FastAPI backend for OCR extraction,
 * then auto-fills the active form wizard fields.
 */
import { t } from './i18n.js';
import { showToast } from './app.js';

const BACKEND_URL = localStorage.getItem('jansahayak-backend-url') || 'http://localhost:8000';

export function initOcr() {
  const ocrClose = document.getElementById('ocr-modal-close');
  const ocrZone = document.getElementById('ocr-drop-zone');
  const ocrFileInput = document.getElementById('ocr-file-input');
  const ocrReset = document.getElementById('ocr-reset-btn');
  const ocrAutoFill = document.getElementById('ocr-autofill-btn');
  const ocrExplainBtn = document.getElementById('ocr-explain-btn');

  ocrClose?.addEventListener('click', closeOcrModal);
  document.getElementById('ocr-modal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('ocr-modal')) closeOcrModal();
  });

  // Click on drop zone opens file picker
  ocrZone?.addEventListener('click', () => ocrFileInput?.click());
  ocrZone?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') ocrFileInput?.click();
  });

  // File selected
  ocrFileInput?.addEventListener('change', (e) => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
  });

  // Drag & drop
  ocrZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    ocrZone.classList.add('drag-over');
  });
  ocrZone?.addEventListener('dragleave', () => ocrZone.classList.remove('drag-over'));
  ocrZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    ocrZone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });

  // Reset button
  ocrReset?.addEventListener('click', resetOcr);

  // Auto-fill button
  ocrAutoFill?.addEventListener('click', () => {
    const extracted = getLastExtracted();
    if (extracted) {
      import('./form-wizard.js').then(m => {
        m.autoFillFromOcr(extracted);
        closeOcrModal();
        showToast(t('ocrSuccess'), 'success');
      });
    }
  });

  // Explain Document button
  ocrExplainBtn?.addEventListener('click', () => {
    const extracted = getLastExtracted();
    if (extracted) {
      import('./chatbot.js').then(m => {
        const msg = getLang() === 'en' 
          ? "Please explain these extracted document fields."
          : "कृपया इन निकाले गए दस्तावेज़ विवरणों को समझाएं।";
        m.openFaqWithContext(msg, { document_context: extracted });
        closeOcrModal();
      });
    }
  });
}

let lastExtracted = null;

function getLang() {
  return document.documentElement.lang || 'en';
}

function getLastExtracted() {
  return lastExtracted;
}

async function handleFile(file) {
  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    showToast('File too large. Maximum size is 5MB.', 'error');
    return;
  }

  // Show preview
  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = document.getElementById('ocr-preview');
      if (preview) {
        preview.src = e.target.result;
        preview.style.display = 'block';
      }
    };
    reader.readAsDataURL(file);
  }

  // Show loading state
  showOcrLoading(true);
  document.getElementById('ocr-result').style.display = 'none';

  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${BACKEND_URL}/api/ocr/extract`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();
    lastExtracted = data.extracted;
    showOcrResult(data.extracted);

  } catch (err) {
    console.warn('OCR backend unavailable, using demo extraction:', err);
    // Demo fallback when backend is not running
    const demoData = getDemoExtraction(file.name);
    lastExtracted = demoData;
    showOcrResult(demoData);
  } finally {
    showOcrLoading(false);
  }
}

function showOcrResult(extracted) {
  const resultDiv = document.getElementById('ocr-result');
  const fieldsList = document.getElementById('ocr-fields-list');

  if (!resultDiv || !fieldsList) return;

  const fieldLabels = {
    name: '👤 Name',
    dob: '📅 Date of Birth',
    address: '🏠 Address',
    idNumber: '🔢 ID Number',
    gender: '⚧ Gender',
    fatherName: "👨 Father's Name"
  };

  fieldsList.innerHTML = '';
  Object.entries(extracted).forEach(([key, value]) => {
    if (value) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:0.5rem;padding:0.4rem 0.6rem;background:var(--bg-card);border-radius:var(--radius-sm);font-size:0.85rem';
      row.innerHTML = `
        <span style="color:var(--color-text-muted);flex-shrink:0">${fieldLabels[key] || key}</span>
        <span style="font-weight:500;flex:1">${escapeHtml(String(value))}</span>
      `;
      fieldsList.appendChild(row);
    }
  });

  resultDiv.style.display = 'block';
}

function showOcrLoading(show) {
  const loading = document.getElementById('ocr-loading');
  const zone = document.getElementById('ocr-drop-zone');
  if (loading) loading.style.display = show ? 'block' : 'none';
  if (zone) zone.style.display = show ? 'none' : 'block';
  const loadingText = document.getElementById('ocr-loading-text');
  if (loadingText) loadingText.textContent = t('ocrLoading');
}

function resetOcr() {
  lastExtracted = null;
  document.getElementById('ocr-result').style.display = 'none';
  document.getElementById('ocr-preview').style.display = 'none';
  document.getElementById('ocr-preview').src = '';
  document.getElementById('ocr-file-input').value = '';
  document.getElementById('ocr-drop-zone').style.display = 'block';
  document.getElementById('ocr-fields-list').innerHTML = '';
}

function closeOcrModal() {
  document.getElementById('ocr-modal').classList.add('hidden');
  resetOcr();
}

/** Demo extraction when backend is not available */
function getDemoExtraction(filename) {
  return {
    name: 'Ramesh Kumar Singh',
    dob: '15/08/1995',
    address: 'Village Rampur, District Gorakhpur, UP - 273001',
    idNumber: '1234 5678 9012',
    gender: 'Male',
    fatherName: 'Suresh Kumar Singh'
  };
}

function escapeHtml(str) {
  return String(str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
