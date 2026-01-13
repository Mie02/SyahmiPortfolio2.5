// -------------------------
// Helpers
// -------------------------
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// -------------------------
// Parallax (SAFE)
// -------------------------
window.addEventListener("scroll", () => {
  const hero = $(".hero");
  if (!hero) return;
  const y = window.scrollY || 0;
  hero.style.transform = `translateY(${y * 0.2}px)`;
});

// -------------------------
// DOM Ready
// -------------------------
document.addEventListener("DOMContentLoaded", () => {
  // footer year
  const y = $("#year");
  if (y) y.textContent = new Date().getFullYear();

  // typing effect
  const roles = [
    "Unity Developer",
    "Motion Graphics Editor",
    "OpenGL 3D Builder",
    "Computer Animation Learner",
    "Blender Workshop Creator",
  ];
  const el = $("#typeText");
  if (el) typeLoop(el, roles);

  // carousel
  initCarousel();

  // scroll reveal (FIXED: uses 'active' to match your CSS)
  initReveal();

  // cursor glow safe
  initCursorGlow();
});

// -------------------------
// Typing loop
// -------------------------
function typeLoop(el, items) {
  let i = 0, j = 0, deleting = false;

  function tick() {
    const word = items[i];
    el.textContent = word.slice(0, j);

    if (!deleting) {
      j++;
      if (j > word.length) {
        deleting = true;
        setTimeout(tick, 900);
        return;
      }
    } else {
      j--;
      if (j === 0) {
        deleting = false;
        i = (i + 1) % items.length;
      }
    }

    setTimeout(tick, deleting ? 40 : 55);
  }

  tick();
}

// -------------------------
// Reveal
// -------------------------
function initReveal() {
  const reveals = $$(".reveal");
  if (!reveals.length) return;

  if (!("IntersectionObserver" in window)) {
    reveals.forEach((r) => r.classList.add("active"));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add("active");
      });
    },
    { threshold: 0.12 }
  );

  reveals.forEach((r) => io.observe(r));
}

// -------------------------
// Carousel
// -------------------------
function initCarousel() {
  const carousel = $("#carousel");
  const dotsWrap = $("#dots");
  if (!carousel || !dotsWrap) return;

  const slides = Array.from(carousel.querySelectorAll(".slide"));
  if (!slides.length) return;

  dotsWrap.innerHTML = "";

  slides.forEach((_, idx) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "dot" + (idx === 0 ? " active" : "");
    b.addEventListener("click", () => go(idx));
    dotsWrap.appendChild(b);
  });

  const dots = Array.from(dotsWrap.querySelectorAll(".dot"));
  let current = 0;
  let timer = setInterval(next, 3500);

  function go(idx) {
    slides[current].classList.remove("active");
    dots[current].classList.remove("active");

    current = idx;

    slides[current].classList.add("active");
    dots[current].classList.add("active");

    reset();
  }

  function next() {
    go((current + 1) % slides.length);
  }

  function reset() {
    clearInterval(timer);
    timer = setInterval(next, 3500);
  }

  carousel.addEventListener("mouseenter", () => clearInterval(timer));
  carousel.addEventListener("mouseleave", reset);
}

// -------------------------
// Cursor glow (SAFE)
// -------------------------
function initCursorGlow() {
  const glow = $("#cursorGlow");
  if (!glow) return;

  document.addEventListener("mousemove", (e) => {
    glow.style.left = e.clientX + "px";
    glow.style.top = e.clientY + "px";
  });
}

// -------------------------
// Image zoom (Lightbox)
// - Click any .zoomable image OR img[data-modal="img"]
// - Close: click outside, X button, or Esc
// -------------------------
(function initLightbox(){
  // If a page doesn't include the lightbox markup, inject it automatically.
  if (!document.getElementById("lightbox")) {
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div id="lightbox" class="lightbox" aria-hidden="true">
        <button class="lightboxClose" id="lightboxClose" aria-label="Close (Esc)">×</button>
        <img id="lightboxImg" alt="Zoomed image" />
        <div class="lightboxHint">Click outside / press Esc to close</div>
      </div>`;
    document.body.appendChild(wrap.firstElementChild);
  }

  const lb = document.getElementById("lightbox");
  const lbImg = document.getElementById("lightboxImg");
  const btn = document.getElementById("lightboxClose");

  function open(src){
    if(!lb || !lbImg) return;
    lbImg.src = src;
    lb.style.display = "flex";
    lb.setAttribute("aria-hidden", "false");
    document.body.classList.add("noScroll");
  }

  function close(){
    if(!lb) return;
    lb.style.display = "none";
    lb.setAttribute("aria-hidden", "true");
    document.body.classList.remove("noScroll");
    if(lbImg) lbImg.src = "";
  }

  document.addEventListener("click", (e) => {
    const t = e.target;
    if(!(t instanceof HTMLElement)) return;

    const isZoomable = t.classList.contains("zoomable");
    const isModalImg = t.tagName === "IMG" && t.getAttribute("data-modal") === "img";
    if(isZoomable || isModalImg){
      const src = (t instanceof HTMLImageElement) ? (t.dataset.zoom || t.currentSrc || t.src) : "";
      if(src) open(src);
    }
  });

  // Close on background click
  lb?.addEventListener("click", (e) => {
    if(e.target === lb) close();
  });

  // Prevent closing when clicking the image
  lbImg?.addEventListener("click", (e) => e.stopPropagation());

  btn?.addEventListener("click", (e) => { e.preventDefault(); close(); });

  document.addEventListener("keydown", (e) => {
    if(e.key === "Escape") close();
  });

  // Fallback: if any image fails to load, swap to placeholder
  document.querySelectorAll('img').forEach((img) => {
    img.addEventListener("error", () => {
      if(img.dataset.fallbackApplied) return;
      img.dataset.fallbackApplied = "1";
      // try a local placeholder
      img.src = img.src.includes("/images/") || img.src.includes("images/")
        ? img.src.replace(/images\/[^/]+$/, "images/placeholder.png")
        : "images/placeholder.png";
    });
  });
})();
