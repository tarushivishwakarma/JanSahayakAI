/**
 * voice.js – Web Speech API voice input helper
 * Usage: import { initVoice, startListening, stopListening } from './voice.js';
 */

let recognition = null;
let isListening = false;
let onResultCallback = null;
let onEndCallback = null;
let currentLang = 'en-US';

/** Initialize speech recognition */
export function initVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    console.warn('⚠️ Web Speech API not supported in this browser');
    return false;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    if (onResultCallback) onResultCallback(transcript);
    isListening = false;
  };

  recognition.onerror = (event) => {
    console.warn('Speech recognition error:', event.error);
    isListening = false;
    if (onEndCallback) onEndCallback();
  };

  recognition.onend = () => {
    isListening = false;
    if (onEndCallback) onEndCallback();
  };

  return true;
}

/** Set language for recognition */
export function setVoiceLang(lang) {
  currentLang = lang === 'hi' ? 'hi-IN' : 'en-US';
  if (recognition) recognition.lang = currentLang;
}

/** Check if voice is available */
export function isVoiceSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/** Start listening */
export function startListening(onResult, onEnd) {
  if (!recognition) {
    const ok = initVoice();
    if (!ok) return false;
  }

  if (isListening) {
    stopListening();
    return false;
  }

  onResultCallback = onResult;
  onEndCallback = onEnd;
  recognition.lang = currentLang;

  try {
    recognition.start();
    isListening = true;
    return true;
  } catch (e) {
    console.warn('Could not start speech recognition:', e);
    return false;
  }
}

/** Stop listening */
export function stopListening() {
  if (recognition && isListening) {
    recognition.stop();
    isListening = false;
  }
}

/** Check if currently listening */
export function getIsListening() {
  return isListening;
}

/**
 * Text-to-speech: speak a message aloud
 * @param {string} text
 * @param {string} lang - 'en' or 'hi'
 */
export function speak(text, lang = 'en') {
  if (!window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-US';
  utterance.rate = 0.9;
  utterance.pitch = 1;
  window.speechSynthesis.cancel(); // Stop any ongoing speech
  window.speechSynthesis.speak(utterance);
}
