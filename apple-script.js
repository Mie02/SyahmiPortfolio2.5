// =============================================
// APPLE AESTHETIC 3D PORTFOLIO — apple-script.js
// =============================================

gsap.registerPlugin(ScrollTrigger);

// ─── 1. LENIS SMOOTH SCROLL ───
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  direction: 'vertical',
  gestureDirection: 'vertical',
  smooth: true,
  mouseMultiplier: 1,
  smoothTouch: false,
  touchMultiplier: 2,
  infinite: false,
});

function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// Connect Lenis to ScrollTrigger
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time)=>{
  lenis.raf(time * 1000);
});
gsap.ticker.lagSmoothing(0, 0);

// ─── 2. THREE.JS FLOATING GEOMETRY ───
function initThreeJS() {
  const container = document.getElementById('webgl-container');
  if (!container) return;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050810, 0.018);

  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 0, 80);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // ── STAR LAYERS (3 depth layers) ──
  function createStarLayer(count, size, spread, zRange, opacity) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * spread;
      positions[i * 3 + 1] = (Math.random() - 0.5) * spread * 0.6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * zRange;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xC8D8F0,
      size: size,
      transparent: true,
      opacity: opacity,
      sizeAttenuation: true
    });
    return new THREE.Points(geometry, material);
  }

  const starLayerFar  = createStarLayer(1200, 0.15, 400, 300, 0.4);
  const starLayerMid  = createStarLayer(600,  0.3,  250, 200, 0.65);
  const starLayerNear = createStarLayer(120,  0.6,  150, 100, 0.9);
  // A few plasma-tinted accent stars
  const starAccent = createStarLayer(30, 0.8, 100, 80, 0.9);
  starAccent.material.color.set(0x00C6FF);

  scene.add(starLayerFar, starLayerMid, starLayerNear, starAccent);

  // ── NEBULA HAZE PLANE (replaces terrain) ──
  const nebulaGeo = new THREE.PlaneGeometry(300, 300, 1, 1);
  const nebulaMat = new THREE.MeshBasicMaterial({
    color: 0x1B3A6B,
    transparent: true,
    opacity: 0.04,
    side: THREE.DoubleSide
  });
  const nebulaPlane = new THREE.Mesh(nebulaGeo, nebulaMat);
  nebulaPlane.rotation.x = -Math.PI / 2;
  nebulaPlane.position.y = -40;
  scene.add(nebulaPlane);

  // ── MOUSE PARALLAX ──
  let mouseX = 0, mouseY = 0;
  document.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  // ── ANIMATION LOOP ──
  const clock = new THREE.Clock();
  let animId;
  function animate() {
    animId = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    // Subtle star drift
    starLayerFar.rotation.y  = t * 0.003;
    starLayerMid.rotation.y  = t * 0.005;
    starLayerNear.rotation.y = t * 0.008;
    starAccent.rotation.y    = t * 0.008;

    // Mouse parallax — each layer shifts differently
    starLayerFar.position.x  = mouseX * 1.5;
    starLayerFar.position.y  = -mouseY * 1.5;
    starLayerMid.position.x  = mouseX * 4;
    starLayerMid.position.y  = -mouseY * 4;
    starLayerNear.position.x = mouseX * 8;
    starLayerNear.position.y = -mouseY * 8;

    // Subtle nebula pulse
    nebulaMat.opacity = 0.03 + Math.sin(t * 0.4) * 0.015;

    renderer.render(scene, camera);
  }
  animate();

  // ── RESIZE ──
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// ─── 3. GSAP ANIMATIONS ───
function initAnimations() {
  // Reveal Up (Title, Subtitles)
  const reveals = document.querySelectorAll('.reveal-up');
  reveals.forEach(el => {
    gsap.fromTo(el, 
      { y: 50, opacity: 0, autoAlpha: 0 },
      { 
        y: 0, 
        opacity: 1, 
        autoAlpha: 1, 
        duration: 1, 
        ease: "power3.out",
        scrollTrigger: {
          trigger: el,
          start: "top 85%",
          toggleActions: "play none none reverse"
        }
      }
    );
  });

  // 3D Z-Axis Gallery Scroll
  const galleryCamera = document.getElementById('galleryCamera');
  if (galleryCamera) {
    gsap.to(galleryCamera, {
      z: 4500, // moves the camera forward through the 3D space
      ease: "none",
      scrollTrigger: {
        trigger: ".gallery-viewport",
        start: "top top",
        end: "+=3000",
        scrub: 1,
        pin: true,
        anticipatePin: 1
      }
    });

    // Plasma glow on gallery items on scroll reveal
    gsap.utils.toArray('.gallery-item').forEach((item, i) => {
      gsap.fromTo(item, 
        { opacity: 0, filter: 'brightness(0.3)' },
        {
          opacity: 1,
          filter: 'brightness(1)',
          duration: 0.8,
          scrollTrigger: { trigger: item, start: 'top 80%' },
          delay: i * 0.15
        }
      );
    });
  }

  // Sticky Navbar
  const nav = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  });

  // Hamburger Menu
  const btn = document.getElementById('hamburger');
  const menu = document.getElementById('mobileMenu');
  btn.addEventListener('click', () => {
    const isOpen = menu.classList.contains('open');
    if(isOpen) {
      menu.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    } else {
      menu.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    }
  });
}

// ─── 4. CUSTOM MAGNETIC CURSOR ───
function initCursor() {
  const cursorDot = document.getElementById('cursorDot');
  const cursorGlow = document.getElementById('cursorGlow');
  if (!cursorDot || !cursorGlow) return;

  if (window.matchMedia('(pointer: coarse)').matches) {
    cursorDot.style.display = 'none';
    cursorGlow.style.display = 'none';
    return;
  }

  let mouse = { x: window.innerWidth/2, y: window.innerHeight/2 };
  let pos = { x: window.innerWidth/2, y: window.innerHeight/2 };
  const speed = 0.15;

  window.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    cursorDot.style.left = mouse.x + 'px';
    cursorDot.style.top = mouse.y + 'px';
  });

  const xSet = gsap.quickSetter(cursorGlow, "x", "px");
  const ySet = gsap.quickSetter(cursorGlow, "y", "px");

  gsap.ticker.add(() => {
    pos.x += (mouse.x - pos.x) * speed;
    pos.y += (mouse.y - pos.y) * speed;
    xSet(pos.x - window.innerWidth/2);
    ySet(pos.y - window.innerHeight/2);
    // Since cursorGlow is translated by -50%, -50% in CSS, we just need to set left/top to mouse pos
    // Wait, the quickSetter sets transform X/Y. If CSS has left:0, top:0, transform: translate(-50%,-50%), 
    // we should just set left and top, or update the quickSetter.
  });

  // Fix: quickSetter is better for transform, but let's just use vanilla JS for glow left/top
  function updateGlow() {
    cursorGlow.style.left = pos.x + 'px';
    cursorGlow.style.top = pos.y + 'px';
    requestAnimationFrame(updateGlow);
  }
  updateGlow();

  const interactives = document.querySelectorAll('a, button');
  interactives.forEach(el => {
    el.addEventListener('mouseenter', () => document.body.classList.add('hover-active'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('hover-active'));
  });
}

// ─── INIT ───
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('year').textContent = new Date().getFullYear();
  initThreeJS();
  initAnimations();
  initCursor();
});
