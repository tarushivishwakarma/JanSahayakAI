/**
 * chatbot.js – Two chatbots:
 *   1. Scheme Finder (full-page) — ported from React ChatbotInterface.tsx
 *   2. FAQ Floating Chatbot — FAQ assistant with keyword matching
 */

import { t, getLang } from './i18n.js';
import { initVoice, startListening, stopListening, getIsListening, setVoiceLang, isVoiceSupported } from './voice.js';

// ——— SCHEME FINDER CHATBOT ———

let chatOnComplete = null;
let chatMessages = [];
let currentQuestionIndex = 0;
let userData = {};
let initialized = false;

export function initChatbot({ onComplete }) {
  chatOnComplete = onComplete;

  document.getElementById('chat-back-btn')?.addEventListener('click', () => {
    import('./app.js').then(m => m.navigateTo('landing'));
  });

  document.getElementById('chat-send-btn')?.addEventListener('click', () => handleChatSubmit());

  document.getElementById('chat-text-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleChatSubmit();
  });

  document.getElementById('chat-mic-btn')?.addEventListener('click', toggleChatVoice);

  // Re-initialize when page becomes active (to reset for new sessions)
  const page = document.getElementById('page-chatbot');
  if (page) {
    const observer = new MutationObserver(() => {
      if (page.classList.contains('active') && !initialized) {
        startFreshChat();
        initialized = true;
      }
      if (!page.classList.contains('active')) {
        initialized = false;
      }
    });
    observer.observe(page, { attributes: true, attributeFilter: ['class'] });
  }
}

function startFreshChat() {
  chatMessages = [];
  currentQuestionIndex = 0;
  userData = {};
  const container = document.getElementById('chat-messages');
  if (container) container.innerHTML = '';
  document.getElementById('chat-options-area').style.display = 'none';

  setVoiceLang(getLang());
  updateProgress();

  // Welcome message
  setTimeout(() => addBotMessage(t('chatWelcome')), 300);
  setTimeout(() => askQuestion(0), 900);
}

function askQuestion(index) {
  const questions = t('questions');
  if (!questions || index >= questions.length) return;
  currentQuestionIndex = index;
  updateProgress();
  addBotMessage(questions[index].question);
  showOptions(questions[index]);
}

function showOptions(question) {
  const area = document.getElementById('chat-options-area');
  const grid = document.getElementById('chat-options-grid');

  if (question.options && question.options.length > 0) {
    area.style.display = 'block';
    grid.innerHTML = '';
    question.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'chat-option-btn';
      btn.textContent = opt;
      btn.addEventListener('click', () => handleOptionSelect(opt));
      grid.appendChild(btn);
    });
  } else {
    area.style.display = 'none';
  }
}

function handleOptionSelect(value) {
  if (value === 'Skip') {
    handleChatSubmit('Not specified');
  } else {
    handleChatSubmit(value);
  }
}

function handleChatSubmit(overrideValue) {
  const input = document.getElementById('chat-text-input');
  const value = overrideValue || input?.value?.trim();
  if (!value) return;

  addUserMessage(value);
  if (input) input.value = '';

  // Hide options
  document.getElementById('chat-options-area').style.display = 'none';

  const questions = t('questions');
  const q = questions[currentQuestionIndex];
  let processed = value;

  if (q.type === 'number') {
    processed = parseInt(value.replace(/[^\d]/g, '')) || 0;
  }

  userData[q.key] = processed;

  if (currentQuestionIndex < questions.length - 1) {
    showTypingIndicator();
    setTimeout(() => {
      removeTypingIndicator();
      askQuestion(currentQuestionIndex + 1);
    }, 600);
  } else {
    // All questions answered
    showTypingIndicator();
    setTimeout(() => {
      removeTypingIndicator();
      addBotMessage(t('chatComplete'));
      setTimeout(() => {
        if (chatOnComplete) chatOnComplete(userData);
      }, 1200);
    }, 600);
  }
}

function toggleChatVoice() {
  const micBtn = document.getElementById('chat-mic-btn');
  const listeningText = document.getElementById('chat-listening-text');

  if (!isVoiceSupported()) {
    alert(getLang() === 'en'
      ? 'Voice input is not supported in your browser'
      : 'आपके ब्राउज़र में आवाज़ इनपुट समर्थित नहीं है');
    return;
  }

  if (getIsListening()) {
    stopListening();
    micBtn.classList.remove('listening');
    listeningText.style.display = 'none';
  } else {
    const started = startListening(
      (transcript) => {
        document.getElementById('chat-text-input').value = transcript;
        micBtn.classList.remove('listening');
        listeningText.style.display = 'none';
      },
      () => {
        micBtn.classList.remove('listening');
        listeningText.style.display = 'none';
      }
    );
    if (started) {
      micBtn.classList.add('listening');
      listeningText.style.display = 'block';
      listeningText.textContent = t('listeningText');
    }
  }
}

function addBotMessage(text) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = 'chat-msg bot';
  msgDiv.innerHTML = `
    <div class="chat-msg-icon" aria-hidden="true">🤖</div>
    <div class="chat-bubble">${escapeHtml(text)}</div>
  `;
  container.appendChild(msgDiv);
  scrollChatToBottom();
}

function addUserMessage(text) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = 'chat-msg user';
  msgDiv.innerHTML = `
    <div class="chat-msg-icon" aria-hidden="true">👤</div>
    <div class="chat-bubble">${escapeHtml(text)}</div>
  `;
  container.appendChild(msgDiv);
  scrollChatToBottom();
}

function showTypingIndicator() {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  const indicator = document.createElement('div');
  indicator.className = 'chat-msg bot';
  indicator.id = 'typing-indicator';
  indicator.innerHTML = `
    <div class="chat-msg-icon" aria-hidden="true">🤖</div>
    <div class="chat-bubble">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;
  container.appendChild(indicator);
  scrollChatToBottom();
}

function removeTypingIndicator() {
  document.getElementById('typing-indicator')?.remove();
}

function updateProgress() {
  const questions = t('questions');
  const total = questions?.length || 8;
  const current = currentQuestionIndex + 1;
  const pct = Math.round(((current - 1) / total) * 100);

  const fill = document.getElementById('chat-progress-fill');
  const text = document.getElementById('chat-progress-text');
  const wrap = document.getElementById('chat-progress-bar-wrap');

  if (fill) fill.style.width = pct + '%';
  if (text) text.textContent = `${t('questionOf')} ${current} ${t('of')} ${total}`;
  if (wrap) wrap.setAttribute('aria-valuenow', pct);
}

function scrollChatToBottom() {
  const container = document.getElementById('chat-messages');
  if (container) container.scrollTop = container.scrollHeight;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


// ——— FAQ FLOATING CHATBOT ———

let faqPanelOpen = false;
let faqIsPending = false; // guard: prevent duplicate submissions
let faqInitialized = false;

export function initFaqChatbot() {
  if (faqInitialized) return;
  faqInitialized = true;

  const toggle = document.getElementById('faq-toggle');
  const faqClose = document.getElementById('faq-close');
  const faqPanel = document.getElementById('faq-panel');
  const faqSend = document.getElementById('faq-send');
  const faqInput = document.getElementById('faq-text-input');

  toggle?.addEventListener('click', () => {
    faqPanelOpen = !faqPanelOpen;
    faqPanel.classList.toggle('hidden', !faqPanelOpen);
    toggle.setAttribute('aria-expanded', faqPanelOpen.toString());
    if (faqPanelOpen) {
      const messagesContainer = document.getElementById('faq-messages');
      if (messagesContainer && messagesContainer.children.length === 0) {
        addFaqBotMessage(t('faqWelcome'));
        renderFaqSuggestions();
      }
      faqInput?.focus();
    }
  });

  faqClose?.addEventListener('click', () => {
    faqPanelOpen = false;
    faqPanel.classList.add('hidden');
    toggle.setAttribute('aria-expanded', 'false');
  });

  faqSend?.addEventListener('click', () => sendFaqMessage());
  faqInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendFaqMessage();
    }
  });
}

const BACKEND_URL =
  localStorage.getItem('jansahayak-backend-url') ||
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : 'https://jansahayakai-ukbl.onrender.com');

function showFaqTypingIndicator() {
  const container = document.getElementById('faq-messages');
  if (!container || document.getElementById('faq-typing-indicator')) return;
  const typingDiv = document.createElement('div');
  typingDiv.className = 'faq-msg bot';
  typingDiv.id = 'faq-typing-indicator';
  typingDiv.innerHTML = `<div class="faq-bubble"><span aria-label="Loading" class="typing-dot-anim">●●●</span></div>`;
  container.appendChild(typingDiv);
  container.scrollTop = container.scrollHeight;
}

function removeFaqTypingIndicator() {
  document.getElementById('faq-typing-indicator')?.remove();
}

/**
 * High-confidence FAQ matcher.
 * Returns local verified answer for known core services (Aadhaar, PAN, Pension, Scholarship, Ration, Income Certificate).
 * Returns null for any scheme-specific question or general query so it reaches AI.
 */
function getFaqAnswer(query) {
  if (!query || typeof query !== 'string') return null;

  const answers = t('faqAnswers');
  if (!answers) return null;

  const raw = query.trim().toLowerCase();
  // Normalize punctuation and extra spaces
  const clean = raw.replace(/[^\w\s\u0900-\u097F]/gi, ' ').replace(/\s+/g, ' ').trim();

  // If query explicitly asks about specific schemes (e.g. PM Kisan, Ayushman, Sukanya, Ujjwala, Mudra, etc.)
  // or asks for broad scheme discovery (e.g. "schemes for farmers", "schemes for students"),
  // DO NOT intercept with local FAQ — pass to AI!
  const schemeKeywords = [
    'pm kisan', 'pmkisan', 'kisan samman', 'पीएम किसान', 'किसान सम्मान',
    'ayushman', 'pmjay', 'आयुष्मान',
    'sukanya', 'सुकन्या',
    'ujjwala', 'उज्ज्वला',
    'mudra', 'मुद्रा',
    'fasal bima', 'फसल बीमा',
    'kcc', 'kisan credit', 'किसान क्रेडिट',
    'shram yogi', 'श्रम योगी',
    'svanidhi', 'स्वनिधि',
    'vishwakarma', 'विश्वकर्मा',
    'awas yojana', 'pmay', 'आवास योजना',
    'matru vandana', 'मातृ वंदना',
    'mgnrega', 'nrega', 'मनरेगा',
    'schemes for', 'scheme for', 'available for', 'योजनाएं', 'योजना',
    'which government scheme', 'which scheme', 'कौन सी योजना'
  ];

  if (schemeKeywords.some(kw => clean.includes(kw))) {
    return null; // Route to AI
  }

  // 1. Aadhaar
  if (
    clean.includes('aadhaar') || clean.includes('aadhar') || clean.includes('uidai') ||
    clean.includes('आधार') || clean.includes('unique id')
  ) {
    return answers.aadhaar || null;
  }

  // 2. PAN
  if (
    /\bpan card\b/i.test(clean) ||
    clean.includes('pan कार्ड') ||
    clean.includes('पैन कार्ड') ||
    clean.includes('पैन क्या') ||
    clean.includes('pan क्या') ||
    clean.includes('permanent account number') ||
    /\bwhat is pan\b/i.test(clean) ||
    /\btell me about pan\b/i.test(clean) ||
    clean === 'pan' || clean === 'pan card' || clean === 'पैन' || clean === 'पैन कार्ड'
  ) {
    return answers.pan || null;
  }


  // 3. Pension
  if (
    clean.includes('pension') || clean.includes('पेंशन') || clean.includes('वृद्धावस्था')
  ) {
    return answers.pension || null;
  }

  // 4. Scholarship (Must be specifically about scholarship, not generic student scheme questions)
  if (
    clean.includes('scholarship') || clean.includes('छात्रवृत्ति')
  ) {
    return answers.scholarship || null;
  }

  // 5. Ration Card
  if (
    clean.includes('ration card') || clean.includes('राशन कार्ड') ||
    clean.includes('ration') || clean.includes('राशन')
  ) {
    return answers.ration || null;
  }

  // 6. Income Certificate
  if (
    clean.includes('income certificate') || clean.includes('आय प्रमाण') || clean.includes('income proof')
  ) {
    return answers.income || null;
  }

  return null;
}

/**
 * Clean and format AI bot response with safe HTML escaping and markdown formatting.
 */
function formatBotResponse(text) {
  if (!text) return '';
  // 1. Escape unsafe HTML characters
  let safe = escapeHtml(String(text).trim());

  // 2. Convert markdown bold **text** to <strong>text</strong>
  safe = safe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // 3. Convert markdown links [text](url) to safe clickable links
  safe = safe.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:var(--color-primary-light);text-decoration:underline;">$1</a>');

  // 4. Convert bullet lines like "* item" or "- item" to <li> elements
  const lines = safe.split('\n');
  const formattedLines = lines.map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      const content = trimmed.substring(2).trim();
      return `<li style="margin-left:1.2rem;margin-bottom:0.25rem;">${content}</li>`;
    }
    return line;
  });

  safe = formattedLines.join('<br />').replace(/(<br \/>\s*)+(<li)/g, '$2').replace(/(<\/li>)\s*(<br \/>)+/g, '$1');

  // 5. Convert inline markdown italic *text* (excluding bullet asterisks)
  safe = safe.replace(/(?<!\*)\*([^\s\*](?:[^*]*?[^\s\*])?)\*(?!\*)/g, '<em>$1</em>');

  return safe;
}


async function sendFaqMessage(overrideText) {
  if (faqIsPending) return; // prevent duplicate submissions

  const input = document.getElementById('faq-text-input');
  const sendBtn = document.getElementById('faq-send');
  const text = overrideText || input?.value?.trim();
  if (!text) return;

  // Add user message to UI
  addFaqUserMessage(text);
  if (!overrideText && input) input.value = '';

  // Set pending state and disable inputs to guard against spam / duplicate clicks
  faqIsPending = true;
  if (sendBtn) sendBtn.disabled = true;
  if (input) input.disabled = true;

  // 1. Check local FAQ first (High Confidence)
  const localAnswer = getFaqAnswer(text);
  if (localAnswer) {
    showFaqTypingIndicator();
    setTimeout(() => {
      removeFaqTypingIndicator();
      addFaqBotMessage(localAnswer);
      renderFaqSuggestions();
      faqIsPending = false;
      if (sendBtn) sendBtn.disabled = false;
      if (input) {
        input.disabled = false;
        input.focus();
      }
    }, 300);
    return;
  }

  // 2. Not a local FAQ -> Call live AI Backend
  showFaqTypingIndicator();

  // AbortController for sensible cold-start timeout (45 seconds)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(`${BACKEND_URL}/api/llm/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: text }],
        language: getLang()
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    removeFaqTypingIndicator();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data && data.reply && typeof data.reply === 'string' && data.reply.trim()) {
      addFaqBotMessage(data.reply, true);
    } else {
      throw new Error('Empty AI response');
    }
    renderFaqSuggestions();
  } catch (error) {
    clearTimeout(timeoutId);
    removeFaqTypingIndicator();
    console.error('JanSahayak AI Floating Chatbot Error:', error.message || error);

    // Friendly localized fallback message
    const fallbackMsg = t('faqAiUnavailable') ||
      (getLang() === 'hi'
        ? 'अभी AI से उत्तर प्राप्त नहीं हो पा रहा है। मैं आधार, PAN, पेंशन, छात्रवृत्ति, राशन कार्ड और आय प्रमाण पत्र जैसी सेवाओं में सहायता कर सकता हूँ। आप किसी सरकारी योजना के बारे में भी पूछ सकते हैं।'
        : 'I\'m unable to get an AI response right now. I can still help with supported services such as Aadhaar, PAN, Pension, Scholarship, Ration Card and Income Certificate. You can also try asking about a specific government scheme.');

    addFaqBotMessage(fallbackMsg);
    renderFaqSuggestions();
  } finally {
    faqIsPending = false;
    if (sendBtn) sendBtn.disabled = false;
    if (input) {
      input.disabled = false;
      input.focus();
    }
  }
}

function addFaqBotMessage(text, isFormatted = false) {
  const container = document.getElementById('faq-messages');
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'faq-msg bot';
  const content = isFormatted ? formatBotResponse(text) : escapeHtml(text);
  div.innerHTML = `<div class="faq-bubble">${content}</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function addFaqUserMessage(text) {
  const container = document.getElementById('faq-messages');
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'faq-msg user';
  div.innerHTML = `<div class="faq-bubble">${escapeHtml(text)}</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function renderFaqSuggestions() {
  const container = document.getElementById('faq-suggestions');
  if (!container) return;
  const suggestions = t('faqSuggestions');
  container.innerHTML = '';
  suggestions?.forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'faq-suggest';
    btn.textContent = s;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!faqIsPending) sendFaqMessage(s);
    });
    container.appendChild(btn);
  });
}
