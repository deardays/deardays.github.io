document.addEventListener('DOMContentLoaded', function() {
  initAOS();
  initCounterAnimation();
  initSmoothScroll();
  loadDynamicContent();
});

function initAOS() {
  if (typeof AOS !== 'undefined') {
    AOS.init({
      duration: 800,
      easing: 'ease-out-cubic',
      once: true,
      offset: 50,
      disable: window.innerWidth < 768 ? 'mobile' : false
    });
  }
}

function initCounterAnimation() {
  const counters = document.querySelectorAll('[data-counter]');
  if (counters.length === 0) return;

  const observerOptions = {
    threshold: 0.5,
    rootMargin: '0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !entry.target.dataset.animated) {
        animateCounter(entry.target);
        entry.target.dataset.animated = 'true';
      }
    });
  }, observerOptions);

  counters.forEach(counter => observer.observe(counter));
}

function animateCounter(element) {
  const target = parseInt(element.dataset.counter, 10);
  const duration = parseInt(element.dataset.duration, 10) || 2000;
  const suffix = element.dataset.suffix || '';
  const startTime = performance.now();

  function updateCounter(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeOutQuart = 1 - Math.pow(1 - progress, 4);
    const current = Math.floor(easeOutQuart * target);

    element.textContent = current.toLocaleString() + suffix;

    if (progress < 1) {
      requestAnimationFrame(updateCounter);
    } else {
      element.textContent = target.toLocaleString() + suffix;
    }
  }

  requestAnimationFrame(updateCounter);
}

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
}

function loadDynamicContent() {
  if (typeof SITE_CONFIG === 'undefined') return;

  const footerBusinessInfo = document.getElementById('footer-business-info');
  if (footerBusinessInfo && SITE_CONFIG.businessInfo) {
    const info = SITE_CONFIG.businessInfo;
    const isKorean = document.documentElement.lang === 'ko';
    
    footerBusinessInfo.innerHTML = `
      <p>${isKorean ? info.companyName : info.companyNameEn}</p>
      <p>${isKorean ? '대표' : 'CEO'}: ${isKorean ? info.ceo : info.ceoEn}</p>
      <p>${isKorean ? '사업자등록번호' : 'Business No'}: ${info.businessNumber}</p>
      <p>${isKorean ? info.address : info.addressEn}</p>
      <p>${isKorean ? '연락처' : 'Contact'}: ${info.phone} | ${info.email}</p>
    `;
  }

  const ctaButtons = document.querySelectorAll('[data-kakao-cta]');
  ctaButtons.forEach(button => {
    if (SITE_CONFIG.kakaoTalkUrl) {
      button.href = SITE_CONFIG.kakaoTalkUrl;
    }
  });

  const counterElements = document.querySelectorAll('[data-stat-key]');
  counterElements.forEach(el => {
    const key = el.dataset.statKey;
    if (SITE_CONFIG.stats && SITE_CONFIG.stats[key] !== undefined) {
      el.dataset.counter = SITE_CONFIG.stats[key];
    }
  });
}

function trackEvent(eventName, eventParams) {
  if (typeof gtag !== 'undefined') {
    gtag('event', eventName, eventParams);
  }
}

document.addEventListener('click', function(e) {
  const ctaButton = e.target.closest('[data-kakao-cta]');
  if (ctaButton) {
    trackEvent('cta_click', {
      event_category: 'engagement',
      event_label: 'kakao_consultation'
    });
  }

  const langToggle = e.target.closest('[data-lang-toggle]');
  if (langToggle) {
    trackEvent('language_change', {
      event_category: 'engagement',
      event_label: langToggle.dataset.langToggle
    });
  }
});
