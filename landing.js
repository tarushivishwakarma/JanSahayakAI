/**
 * landing.js – Landing page animations and interactions
 */
import { t } from './i18n.js';

export function initLanding({ onStartChat, onTryDemo, onGoServices }) {
  // CTA button listeners
  document.getElementById('hero-start-chat')?.addEventListener('click', onStartChat);
  document.getElementById('hero-try-demo')?.addEventListener('click', onTryDemo);
  document.getElementById('hero-services-btn')?.addEventListener('click', onGoServices);

  // Animate stats counter
  animateCounters();
}

function animateCounters() {
  // Only if IntersectionObserver is available (modern browsers)
  const statsEls = document.querySelectorAll('.hero-stat .num');
  if (!statsEls.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const finalText = el.textContent;
        const num = parseInt(finalText.replace(/\D/g, ''));
        if (!isNaN(num) && num > 0) {
          countUp(el, 0, num, finalText);
        }
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  statsEls.forEach(el => observer.observe(el));
}

function countUp(el, start, end, originalText) {
  const duration = 1200;
  const suffix = originalText.replace(/[\d]/g, '');
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const current = Math.floor(eased * (end - start) + start);
    el.textContent = current + suffix;
    if (progress < 1) requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}
