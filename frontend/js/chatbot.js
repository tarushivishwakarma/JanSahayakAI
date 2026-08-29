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

const faqKeywords = {
  aadhaar: ['aadhaar', 'aadhar', 'uid', 'आधार', 'unique id'],
  pension: ['pension', 'पेंशन', 'old age', 'widow', 'disability pension', 'वृद्धावस्था'],
  scholarship: ['scholarship', 'छात्रवृत्ति', 'student', 'education', 'study', 'पढ़ाई'],
  pan: ['pan', 'पैन', 'permanent account', 'tax', 'income tax'],
  ration: ['ration', 'राशन', 'food', 'grain', 'bpl', 'pds', 'खाद्यान्न'],
  income: ['income certificate', 'आय प्रमाण', 'income proof', 'certificate']
};

let faqPanelOpen = false;

export function initFaqChatbot() {
  const toggle = document.getElementById('faq-toggle');
  const faqClose = document.getElementById('faq-close');
  const faqPanel = document.getElementById('faq-panel');
  const faqSend = document.getElementById('faq-send');
  const faqInput = document.getElementById('faq-text-input');
  const faqMicBtn = document.getElementById('faq-mic-btn');

  toggle?.addEventListener('click', () => {
    faqPanelOpen = !faqPanelOpen;
    faqPanel.classList.toggle('hidden', !faqPanelOpen);
    toggle.setAttribute('aria-expanded', faqPanelOpen.toString());
    if (faqPanelOpen && document.getElementById('faq-messages').children.length === 0) {
      addFaqBotMessage(t('faqWelcome'));
      renderFaqSuggestions();
    }
  });

  faqClose?.addEventListener('click', () => {
    faqPanelOpen = false;
    faqPanel.classList.add('hidden');
    toggle.setAttribute('aria-expanded', 'false');
  });

  faqSend?.addEventListener('click', sendFaqMessage);
  faqInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendFaqMessage();
  });
  faqMicBtn?.addEventListener('click', toggleFaqVoice);
}

function toggleFaqVoice() {
  const micBtn = document.getElementById('faq-mic-btn');
  const listeningText = document.getElementById('faq-listening-text');

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
        document.getElementById('faq-text-input').value = transcript;
        micBtn.classList.remove('listening');
        listeningText.style.display = 'none';
        sendFaqMessage(); // auto-send when voice is done
      },
      () => {
        micBtn.classList.remove('listening');
        listeningText.style.display = 'none';
      }
    );
    if (started) {
      micBtn.classList.add('listening');
      listeningText.style.display = 'block';
      listeningText.textContent = t('listeningText') || 'Listening...';
    }
  }
}

let faqChatHistory = [];

async function sendFaqMessage(overrideText = null, customContext = null) {
  const input = document.getElementById('faq-text-input');
  let text = '';
  if (typeof overrideText === 'string') {
    text = overrideText;
  } else {
    text = input?.value?.trim();
  }
  if (!text) return;

  addFaqUserMessage(text);
  if (input) input.value = '';
  
  faqChatHistory.push({ role: 'user', content: text });

  // Show typing indicator
  const container = document.getElementById('faq-messages');
  const indicator = document.createElement('div');
  indicator.className = 'faq-msg bot';
  indicator.id = 'faq-typing-indicator';
  indicator.innerHTML = '<div class="faq-bubble">Typing...</div>';
  container.appendChild(indicator);
  container.scrollTop = container.scrollHeight;

  try {
    const BACKEND_URL = localStorage.getItem('jansahayak-backend-url') || 'http://localhost:8000';
    const payload = {
      messages: faqChatHistory,
      language: getLang() === 'hi' ? 'Hindi' : 'English',
      user_context: userData // pass the existing profile if available
    };
    
    if (customContext) {
       Object.assign(payload, customContext);
    }

    const res = await fetch(`${BACKEND_URL}/api/llm/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error('API Error');
    const data = await res.json();
    
    document.getElementById('faq-typing-indicator')?.remove();
    addFaqBotMessage(data.reply);
    faqChatHistory.push({ role: 'assistant', content: data.reply });
  } catch (err) {
    console.error('LLM API Error:', err);
    document.getElementById('faq-typing-indicator')?.remove();
    // Fallback to keyword matching
    const answer = getFaqAnswer(text.toLowerCase());
    addFaqBotMessage(answer);
    faqChatHistory.push({ role: 'assistant', content: answer });
  }
  
  if (!customContext) {
    renderFaqSuggestions();
  }
}

// Expose openFaqWithContext for OCR and Scheme Detail use cases
export function openFaqWithContext(message, customContext) {
  faqPanelOpen = true;
  document.getElementById('faq-panel').classList.remove('hidden');
  document.getElementById('faq-toggle').setAttribute('aria-expanded', 'true');
  sendFaqMessage(message, customContext);
}

function getFaqAnswer(query) {
  const answers = t('faqAnswers');
  for (const [topic, keywords] of Object.entries(faqKeywords)) {
    if (keywords.some(kw => query.includes(kw))) {
      return answers[topic] || answers.default;
    }
  }
  return answers.default;
}

function addFaqBotMessage(text) {
  const container = document.getElementById('faq-messages');
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'faq-msg bot';
  div.innerHTML = `<div class="faq-bubble">${escapeHtml(text)}</div>`;
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
    btn.addEventListener('click', () => {
      sendFaqMessage(s);
    });
    container.appendChild(btn);
  });
}
