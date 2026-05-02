// ── Helpers ──────────────────────────────────────────────
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

// ── DOMContentLoaded ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Footer year
  const y = $('#year');
  if (y) y.textContent = new Date().getFullYear();

  // Typing effect
  const roles = [
    'Unity Developer',
    'Motion Graphics Editor',
    'OpenGL 3D Builder',
    'Computer Animator',
    'Blender Creator',
  ];
  const el = $('#typeText');
  if (el) typeLoop(el, roles);

  // Carousel
  initCarousel();

  // Scroll reveal
  initReveal();

  // Cursor glow
  initCursorGlow();

  // Lightbox
  initLightbox();

  // Active nav
  markActiveNav();
});

// ── Typing ────────────────────────────────────────────────
function typeLoop(el, items) {
  let i = 0, j = 0, deleting = false;
  function tick() {
    const word = items[i];
    el.textContent = word.slice(0, j);
    if (!deleting) {
      j++;
      if (j > word.length) { deleting = true; setTimeout(tick, 1000); return; }
    } else {
      j--;
      if (j === 0) { deleting = false; i = (i + 1) % items.length; }
    }
    setTimeout(tick, deleting ? 36 : 52);
  }
  tick();
}

// ── Reveal ────────────────────────────────────────────────
function initReveal() {
  const reveals = $$('.reveal');
  if (!reveals.length) return;
  if (!('IntersectionObserver' in window)) {
    reveals.forEach(r => r.classList.add('active')); return;
  }
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('active'); });
  }, { threshold: 0.10 });
  reveals.forEach(r => io.observe(r));
}

// ── Carousel ──────────────────────────────────────────────
function initCarousel() {
  const wrap = $('#carousel');
  const track = $('#carouselTrack');
  const dotsWrap = $('#dots');
  const prevBtn = $('#carouselPrev');
  const nextBtn = $('#carouselNext');
  if (!wrap || !track || !dotsWrap) return;

  const slides = $$('.slide', track) || Array.from(track.children);
  if (!slides.length) return;

  let current = 0;
  let timer = setInterval(next, 4000);

  dotsWrap.innerHTML = '';
  slides.forEach((_, idx) => {
    const b = document.createElement('button');
    b.className = 'dot' + (idx === 0 ? ' active' : '');
    b.setAttribute('aria-label', 'Slide ' + (idx + 1));
    b.addEventListener('click', () => go(idx));
    dotsWrap.appendChild(b);
  });
  const dots = $$('.dot', dotsWrap);

  function go(idx) {
    current = idx;
    track.style.transform = `translateX(-${idx * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    reset();
  }
  function next() { go((current + 1) % slides.length); }
  function reset() { clearInterval(timer); timer = setInterval(next, 4000); }

  if (prevBtn) prevBtn.addEventListener('click', () => go((current - 1 + slides.length) % slides.length));
  if (nextBtn) nextBtn.addEventListener('click', next);
  wrap.addEventListener('mouseenter', () => clearInterval(timer));
  wrap.addEventListener('mouseleave', reset);
}

// ── Cursor Glow ───────────────────────────────────────────
function initCursorGlow() {
  const glow = $('#cursorGlow');
  if (!glow) return;
  let lx = 0, ly = 0, x = 0, y = 0;
  document.addEventListener('mousemove', e => { x = e.clientX; y = e.clientY; });
  function frame() {
    lx += (x - lx) * 0.08;
    ly += (y - ly) * 0.08;
    glow.style.left = lx + 'px';
    glow.style.top  = ly + 'px';
    requestAnimationFrame(frame);
  }
  frame();
}

// ── Lightbox ──────────────────────────────────────────────
function initLightbox() {
  if (!document.getElementById('lightbox')) {
    const d = document.createElement('div');
    d.innerHTML = `
      <div id="lightbox" class="lightbox" aria-hidden="true">
        <button class="lightboxClose" id="lightboxClose" aria-label="Close">×</button>
        <img id="lightboxImg" alt="Zoomed image">
        <div class="lightboxHint">Click outside or press Esc to close</div>
      </div>`;
    document.body.appendChild(d.firstElementChild);
  }
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lightboxImg');
  const btn = document.getElementById('lightboxClose');

  function open(src) {
    lbImg.src = src;
    lb.style.display = 'flex';
    lb.setAttribute('aria-hidden', 'false');
    document.body.classList.add('noScroll');
  }
  function close() {
    lb.style.display = 'none';
    lb.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('noScroll');
    lbImg.src = '';
  }

  document.addEventListener('click', e => {
    const t = e.target;
    if (t.classList.contains('zoomable') && t.tagName === 'IMG') {
      open(t.dataset.zoom || t.currentSrc || t.src);
    }
  });
  lb?.addEventListener('click', e => { if (e.target === lb) close(); });
  btn?.addEventListener('click', e => { e.preventDefault(); close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  // Fallback for broken images
  document.querySelectorAll('img').forEach(img => {
    img.addEventListener('error', () => {
      if (img.dataset.fallbackApplied) return;
      img.dataset.fallbackApplied = '1';
      img.src = 'images/placeholder.png';
    });
  });
}

// ── Mark active nav link ───────────────────────────────────
function markActiveNav() {
  const path = location.pathname.split('/').pop() || 'index.html';
  $$('.nav-links a').forEach(a => {
    const href = a.getAttribute('href').split('/').pop();
    if (href === path) a.classList.add('active');
  });
}
