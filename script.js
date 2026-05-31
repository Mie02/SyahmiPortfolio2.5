// =============================================
// Helpers
// =============================================
const $ = (s, ctx = document) => ctx.querySelector(s);
const $$ = (s, ctx = document) => Array.from(ctx.querySelectorAll(s));

// =============================================
// DOM Ready
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  setYear();
  initNav();
  initHamburger();
  initTyping();
  initCarousel();
  initReveal();
  initCursorGlow();
  initLightbox();
  initImageFallback();
});

// =============================================
// Footer year
// =============================================
function setYear() {
  const el = $('#year');
  if (el) el.textContent = new Date().getFullYear();
}

// =============================================
// Sticky nav
// =============================================
function initNav() {
  const nav = $('#navbar');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 60);
  }, { passive: true });
}

// =============================================
// Hamburger / Mobile Menu
// =============================================
function initHamburger() {
  const btn  = $('#hamburger');
  const menu = $('#mobileMenu');
  if (!btn || !menu) return;

  btn.addEventListener('click', () => {
    const open = btn.classList.toggle('open');
    menu.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open);
    menu.setAttribute('aria-hidden', !open);
  });

  // Close on any mobile link click
  $$('a', menu).forEach(a => {
    a.addEventListener('click', () => {
      btn.classList.remove('open');
      menu.classList.remove('open');
      btn.setAttribute('aria-expanded', false);
      menu.setAttribute('aria-hidden', true);
    });
  });
}

// =============================================
// Typing / Typewriter effect
// =============================================
function initTyping() {
  const el = $('#typeText');
  if (!el) return;

  const roles = [
    'Unity Developer',
    'Motion Graphics Editor',
    'OpenGL 3D Builder',
    'Computer Animator',
    'Blender Workshop Creator',
  ];

  let i = 0, j = 0, deleting = false;

  function tick() {
    const word = roles[i];
    el.textContent = word.slice(0, j);

    if (!deleting) {
      j++;
      if (j > word.length) {
        deleting = true;
        setTimeout(tick, 1100);
        return;
      }
    } else {
      j--;
      if (j === 0) {
        deleting = false;
        i = (i + 1) % roles.length;
      }
    }
    setTimeout(tick, deleting ? 38 : 60);
  }
  tick();
}

// =============================================
// Carousel
// =============================================
function initCarousel() {
  const carousel = $('#carousel');
  const dotsWrap = $('#dots');
  if (!carousel || !dotsWrap) return;

  const slides = $$('.slide', carousel);
  if (!slides.length) return;

  dotsWrap.innerHTML = '';
  slides.forEach((_, idx) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dot' + (idx === 0 ? ' active' : '');
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-label', `Slide ${idx + 1}`);
    b.addEventListener('click', () => go(idx));
    dotsWrap.appendChild(b);
  });

  const dots = $$('.dot', dotsWrap);
  let current = 0;
  let timer = setInterval(next, 4000);

  function go(idx) {
    slides[current].classList.remove('active');
    dots[current].classList.remove('active');
    current = idx;
    slides[current].classList.add('active');
    dots[current].classList.add('active');
    reset();
  }

  function next() { go((current + 1) % slides.length); }
  function prev() { go((current - 1 + slides.length) % slides.length); }
  function reset() { clearInterval(timer); timer = setInterval(next, 4000); }

  carousel.addEventListener('mouseenter', () => clearInterval(timer));
  carousel.addEventListener('mouseleave', reset);

  const btnNext = $('#carouselNext');
  const btnPrev = $('#carouselPrev');
  if (btnNext) { btnNext.addEventListener('click', next); btnNext.addEventListener('click', reset); }
  if (btnPrev) { btnPrev.addEventListener('click', prev); btnPrev.addEventListener('click', reset); }

  // Touch swipe
  let touchStartX = 0;
  carousel.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].clientX; }, { passive: true });
  carousel.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) { dx < 0 ? next() : prev(); reset(); }
  });
}

// =============================================
// Scroll Reveal
// =============================================
function initReveal() {
  const elements = $$('.reveal');
  if (!elements.length) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    elements.forEach(el => el.classList.add('active'));
    return;
  }

  if (!('IntersectionObserver' in window)) {
    elements.forEach(el => el.classList.add('active'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('active');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  elements.forEach(el => io.observe(el));
}

// =============================================
// Cursor Glow
// =============================================
function initCursorGlow() {
  const glow = $('#cursorGlow');
  if (!glow) return;

  // Disable on touch devices
  if (window.matchMedia('(pointer: coarse)').matches) {
    glow.style.display = 'none';
    return;
  }

  document.addEventListener('mousemove', e => {
    glow.style.left = e.clientX + 'px';
    glow.style.top  = e.clientY + 'px';
  }, { passive: true });
}

// =============================================
// Lightbox (image zoom)
// =============================================
function initLightbox() {
  let lb    = $('#lightbox');
  let lbImg = $('#lightboxImg');
  let lbClose = $('#lightboxClose');

  // Auto-inject if markup not present
  if (!lb) {
    const div = document.createElement('div');
    div.innerHTML = `
      <div id="lightbox" class="lightbox" aria-hidden="true" role="dialog" aria-modal="true">
        <button class="lightboxClose" id="lightboxClose" aria-label="Close (Esc)">&times;</button>
        <img id="lightboxImg" alt="Zoomed image" />
        <div class="lightboxHint">Click outside or press Esc to close</div>
      </div>`;
    document.body.appendChild(div.firstElementChild);
    lb      = $('#lightbox');
    lbImg   = $('#lightboxImg');
    lbClose = $('#lightboxClose');
  }

  function open(src, alt) {
    if (!lb || !lbImg) return;
    lbImg.src = src;
    lbImg.alt = alt || 'Zoomed image';
    lb.style.display = 'flex';
    lb.setAttribute('aria-hidden', 'false');
    document.body.classList.add('noScroll');
    lbClose && lbClose.focus();
  }

  function close() {
    if (!lb) return;
    lb.style.display = 'none';
    lb.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('noScroll');
    if (lbImg) lbImg.src = '';
  }

  document.addEventListener('click', e => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.classList.contains('zoomable') || t.getAttribute('data-modal') === 'img') {
      const src = (t instanceof HTMLImageElement) ? (t.dataset.zoom || t.currentSrc || t.src) : '';
      if (src) open(src, t.alt);
    }
  });

  lb?.addEventListener('click', e => { if (e.target === lb) close(); });
  lbImg?.addEventListener('click', e => e.stopPropagation());
  lbClose?.addEventListener('click', e => { e.preventDefault(); close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

// =============================================
// Image fallback
// =============================================
function initImageFallback() {
  $$('img').forEach(img => {
    img.addEventListener('error', () => {
      if (img.dataset.fallbackApplied) return;
      img.dataset.fallbackApplied = '1';
      img.src = img.src.includes('images/')
        ? img.src.replace(/images\/[^/]+$/, 'images/placeholder.png')
        : 'images/placeholder.png';
    });
  });
}
