/**
 * chatbot.js – Two chatbots:
 *   1. Scheme Finder (full-page) — ported from React ChatbotInterface.tsx
 *   2. FAQ Floating Chatbot — FAQ assistant with keyword matching
 */

import { t, getLang } from './i18n.js';
import { initVoice, startListening, stopListening, getIsListening, setVoiceLang, isVoiceSupported } from './voice.js';
import { getBackendUrl, authFetch } from './utils.js';

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
 * Validate and clean URLs from AI Markdown responses.
 * Rejects dangerous schemes (javascript:, data:, vbscript:, file:, etc.)
 * Normalizes nested/duplicated Markdown links and extracts only the safe HTTP/HTTPS URL.
 */
function sanitizeBotUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  let cleaned = rawUrl.trim();

  // Strip enclosing angle brackets (both raw and HTML-escaped): <https://...> or &lt;https://...&gt;
  cleaned = cleaned.replace(/^(?:<|&lt;)+|(?:>|&gt;)+$/gi, '').trim();

  // Handle nested/duplicated markdown link inside parentheses:
  // e.g. [https://pmkisan.gov.in](https://pmkisan.gov.in) -> extract the inner URL
  while (/\[.*?\]\((https?:\/\/[^\s\)]+)\)/i.test(cleaned)) {
    const nestedMatch = cleaned.match(/\[.*?\]\((https?:\/\/[^\s\)]+)\)/i);
    if (nestedMatch) {
      cleaned = nestedMatch[1];
    } else {
      break;
    }
  }

  // Strip enclosing brackets or parens wrapping the URL
  if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  cleaned = cleaned.replace(/^(?:<|&lt;)+|(?:>|&gt;)+$/gi, '').trim();


  // Extract the URL candidate starting with http:// or https://
  const httpMatch = cleaned.match(/^https?:\/\/[^\s"'>]+/i);
  if (!httpMatch) {
    // Rejects dangerous protocols: javascript:, data:, vbscript:, file:, etc.
    return null;
  }

  cleaned = httpMatch[0];

  // Strip trailing punctuation (brackets, commas, periods, semicolons)
  cleaned = cleaned.replace(/[\]\.,;]+$/, '');

  // Only strip trailing closing parenthesis if it is an unmatched closing paren
  while (cleaned.endsWith(')')) {
    const openCount = (cleaned.match(/\(/g) || []).length;
    const closeCount = (cleaned.match(/\)/g) || []).length;
    if (closeCount > openCount) {
      cleaned = cleaned.slice(0, -1);
    } else {
      break;
    }
  }

  // Strip any stray square brackets
  if (/[\[\]]/.test(cleaned)) {
    cleaned = cleaned.replace(/[\[\]]/g, '');
  }

  // Validate protocol strictly
  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return cleaned;
  } catch {
    if (/^https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;%=]+$/i.test(cleaned)) {
      return cleaned;
    }
    return null;
  }
}

/**
 * Clean and format AI bot response with safe HTML escaping and markdown formatting.
 * Strictly prevents XSS, removes all raw Markdown syntax (*, #, `, ---, etc.),
 * and renders clean semantic HTML (bold, headings, bullet/numbered lists, links, dividers).
 */
function formatBotResponse(text) {
  if (!text) return '';

  // 1. Escape raw HTML first for security (strictly prevent XSS)
  let safe = escapeHtml(String(text).trim());

  // 2. Normalize line breaks
  safe = safe.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 3. Inline backticks `code` -> display text without backticks
  safe = safe.replace(/`([^`]+)`/g, '$1');
  safe = safe.replace(/`/g, '');

  // 4. Strikethrough ~~text~~
  safe = safe.replace(/~~(.*?)~~/g, '<del>$1</del>');
  safe = safe.replace(/~/g, '');

  // 5. Markdown links: [text](url)
  // Pre-normalize nested/duplicated Markdown URLs:
  // e.g. [label]([url](url)) -> [label](url)
  safe = safe.replace(/\[([^\]]+)\]\(\s*\[([^\]]*)\]\((https?:\/\/[^\s\)]+)\)\s*\)/gi, '[$1]($3)');
  // e.g. [label]([url]) -> [label](url)
  safe = safe.replace(/\[([^\]]+)\]\(\s*\[(https?:\/\/[^\s\]]+)\]\s*\)/gi, '[$1]($2)');
  // e.g. [label](<url>) or [label](&lt;url&gt;) -> [label](url)
  safe = safe.replace(/\[([^\]]+)\]\(\s*(?:<|&lt;)(https?:\/\/[^\s>&]+)(?:>|&gt;)\s*\)/gi, '[$1]($2)');
  // e.g. [label]() -> label
  safe = safe.replace(/\[([^\]]+)\]\(\s*\)/g, '$1');

  // Main Markdown link replacement supporting balanced parentheses
  safe = safe.replace(
    /\[([^\]]+)\]\((((?:\([^()\s]*\)|[^()\s])+))\)/g,
    (match, label, rawTarget) => {
      const cleanUrl = sanitizeBotUrl(rawTarget);
      if (cleanUrl) {
        return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" style="color:var(--color-primary-light);text-decoration:underline;">${label}</a>`;
      }
      // If dangerous (javascript:, data:) or invalid, strip link and render label safely
      return label;
    }
  );



  // 6. Bold and Bold-Italic (**text**, ***text***, __text__)
  safe = safe.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  safe = safe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  safe = safe.replace(/__(.*?)__/g, '<strong>$1</strong>');

  // 7. Process line-based markdown elements
  const lines = safe.split('\n');
  const formattedLines = lines.map(line => {
    const trimmed = line.trim();

    // Horizontal Rule: ---, ***, ___ (at least 3 characters)
    if (/^([-*_]\s*){3,}$/.test(trimmed)) {
      return '<hr class="faq-bot-hr" style="border:none;border-top:1px solid rgba(0,0,0,0.15);margin:0.5rem 0;" />';
    }

    // Headings: #, ##, ###, ####, etc.
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2].trim();
      const fontSize = level === 1 ? '1.08rem' : level === 2 ? '1.02rem' : '0.95rem';
      return `<div class="faq-bot-heading" style="font-weight:700;font-size:${fontSize};margin-top:0.5rem;margin-bottom:0.25rem;">${headingText}</div>`;
    }

    // Numbered / Ordered List: 1. item, 2. item
    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (orderedMatch) {
      const num = orderedMatch[1];
      const content = orderedMatch[2].trim();
      return `<li class="faq-bot-list-item" style="list-style-type:decimal;margin-left:1.25rem;margin-bottom:0.25rem;" value="${num}">${content}</li>`;
    }

    // Bullet list: * item, - item, + item, • item
    const bulletMatch = trimmed.match(/^[\*\-\+•]\s+(.+)$/);
    if (bulletMatch) {
      const content = bulletMatch[1].trim();
      return `<li class="faq-bot-list-item" style="list-style-type:disc;margin-left:1.25rem;margin-bottom:0.25rem;">${content}</li>`;
    }

    // Blockquote: &gt; quote
    if (trimmed.startsWith('&gt; ')) {
      return `<div style="border-left:3px solid var(--color-orange);padding-left:0.6rem;margin:0.4rem 0;opacity:0.9;">${trimmed.substring(5)}</div>`;
    }

    return line;
  });

  // 8. Join lines and normalize spacing
  let result = formattedLines.join('<br />');

  // Remove awkward <br /> around block elements (li, heading div, hr)
  result = result.replace(/(<br \/>\s*)+(<li)/g, '$2');
  result = result.replace(/(<\/li>)\s*(<br \/>)+/g, '$1');
  result = result.replace(/(<br \/>\s*)*(<div class="faq-bot-heading"[^>]*>)/g, '$2');
  result = result.replace(/(<\/div>)\s*(<br \/>)*/g, '$1');
  result = result.replace(/(<br \/>\s*)*(<hr[^>]*>)\s*(<br \/>)*/g, '$2');
  result = result.replace(/(<br \/>\s*){3,}/g, '<br /><br />');

  // 9. Convert inline italic *text* or _text_
  result = result.replace(/(?<!\*)\*([^\s\*](?:[^*]*?[^\s\*])?)\*(?!\*)/g, '<em>$1</em>');
  result = result.replace(/(?<!_)_([^\s_](?:[^_]*?[^\s_])?)_(?!_)/g, '<em>$1</em>');

  // 10. Clean up any remaining stray raw markdown characters
  result = result.replace(/^[ \t]*#+[ \t]*/gm, '');
  result = result.replace(/\*{1,3}/g, '');
  result = result.replace(/(?<!\w)_(?!\w)/g, '');

  return result;
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
    const response = await authFetch(`${getBackendUrl()}/api/llm/chat`, {
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
      if (response.status === 429) {
        throw new Error('429');
      }
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
    const fallbackMsg = error.message === '429'
      ? (getLang() === 'hi'
          ? 'आप बहुत तेज़ी से प्रश्न पूछ रहे हैं। कृपया कुछ क्षण प्रतीक्षा करें।'
          : 'You are sending messages too quickly. Please wait a moment before trying again.')
      : (t('faqAiUnavailable') ||
        (getLang() === 'hi'
          ? 'अभी AI से उत्तर प्राप्त नहीं हो पा रहा है। मैं आधार, PAN, पेंशन, छात्रवृत्ति, राशन कार्ड और आय प्रमाण पत्र जैसी सेवाओं में सहायता कर सकता हूँ। आप किसी सरकारी योजना के बारे में भी पूछ सकते हैं।'
          : 'I\'m unable to get an AI response right now. I can still help with supported services such as Aadhaar, PAN, Pension, Scholarship, Ration Card and Income Certificate. You can also try asking about a specific government scheme.'));

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
