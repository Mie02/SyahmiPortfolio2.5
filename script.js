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

// ─── 2. THREE.JS INTERACTIVE TERRAIN ───
function initThreeJS() {
  const container = document.getElementById('webgl-container');
  if (!container) return;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.04);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 5, 20); // Look down slightly at the terrain

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0x2997ff, 3);
  dirLight.position.set(10, 20, 10);
  scene.add(dirLight);

  const pointLight = new THREE.PointLight(0xff0055, 3, 100);
  pointLight.position.set(-10, 10, -10);
  scene.add(pointLight);

  // Wavy Terrain Geometry
  const geometry = new THREE.PlaneGeometry(150, 150, 80, 80);
  
  // Solid base
  const solidMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x050505,
    metalness: 0.9,
    roughness: 0.4,
    clearcoat: 1.0,
    clearcoatRoughness: 0.2
  });
  const planeSolid = new THREE.Mesh(geometry, solidMaterial);
  
  // Wireframe glowing grid on top
  const wireMaterial = new THREE.MeshBasicMaterial({
    color: 0x0a4488,
    wireframe: true,
    transparent: true,
    opacity: 0.25
  });
  const planeWire = new THREE.Mesh(geometry, wireMaterial);
  planeSolid.add(planeWire);

  planeSolid.rotation.x = -Math.PI / 2;
  planeSolid.position.y = -8;
  scene.add(planeSolid);

  // Buffer references
  const positionAttribute = geometry.attributes.position;

  // Mouse Interaction
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let targetPoint = new THREE.Vector3(0, -1000, 0); // Far away initially
  let currentPoint = new THREE.Vector3(0, -1000, 0);

  document.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();

    // Raycast to find mouse position on plane
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(planeSolid);
    if (intersects.length > 0) {
      targetPoint.copy(intersects[0].point);
    }
    // Lerp current point to target point for smooth ripples
    currentPoint.lerp(targetPoint, 0.05);

    // Update vertices for wave and ripple effect
    for (let i = 0; i < positionAttribute.count; i++) {
      const vx = positionAttribute.getX(i);
      const vy = positionAttribute.getY(i);
      
      // Basic wave math
      const wave1 = Math.sin(vx * 0.1 + elapsedTime) * 1.5;
      const wave2 = Math.cos(vy * 0.1 + elapsedTime * 0.8) * 1.5;
      
      // Interactive Ripple math
      const worldX = vx;
      const worldZ = -vy;
      const dist = Math.sqrt(Math.pow(worldX - currentPoint.x, 2) + Math.pow(worldZ - currentPoint.z, 2));
      
      let ripple = 0;
      if (dist < 20) {
        // Create a ripple burst outward from the mouse
        ripple = Math.cos(dist * 1.2 - elapsedTime * 6) * (20 - dist) * 0.2;
      }

      positionAttribute.setZ(i, wave1 + wave2 + ripple);
    }
    
    positionAttribute.needsUpdate = true;
    geometry.computeVertexNormals(); // Update lighting based on new waves

    // Gentle camera pan based on mouse
    camera.position.x += (mouse.x * 3 - camera.position.x) * 0.02;
    camera.lookAt(0, -3, 0);

    renderer.render(scene, camera);
  }
  animate();

  // Scroll link to move camera through the terrain
  ScrollTrigger.create({
    trigger: document.body,
    start: "top top",
    end: "bottom bottom",
    scrub: 1,
    onUpdate: (self) => {
      camera.position.z = 20 - (self.progress * 35);
      camera.position.y = 5 - (self.progress * 6);
      camera.lookAt(0, -3, 0);
    }
  });

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

  // Horizontal Scroll for Projects
  const horizontalTrack = document.getElementById('horizontalTrack');
  if (horizontalTrack) {
    const wrap = document.querySelector('.horizontal-scroll-container');
    const scrollWidth = horizontalTrack.scrollWidth - window.innerWidth + window.innerWidth * 0.1;

    gsap.to(horizontalTrack, {
      x: () => -scrollWidth + "px",
      ease: "none",
      scrollTrigger: {
        trigger: ".projects-pin-section",
        start: "top top",
        end: () => "+=" + scrollWidth,
        scrub: 1,
        pin: true,
        anticipatePin: 1
      }
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

// ─── 5. IMAGE LIGHTBOX (ZOOM) ───
function initLightbox() {
  // Create lightbox HTML if it doesn't exist
  let lightbox = document.getElementById('lightbox');
  if (!lightbox) {
    lightbox = document.createElement('div');
    lightbox.className = 'lightbox';
    lightbox.id = 'lightbox';
    lightbox.innerHTML = `
      <button class="lightbox-close" aria-label="Close">&times;</button>
      <img id="lightbox-img" src="" alt="Zoomed image">
    `;
    document.body.appendChild(lightbox);
  }

  const lightboxImg = document.getElementById('lightbox-img');
  const closeBtn = lightbox.querySelector('.lightbox-close');

  function closeLightbox() {
    lightbox.classList.remove('active');
    setTimeout(() => {
      lightboxImg.src = '';
    }, 300);
  }

  lightbox.addEventListener('click', (e) => {
    if (e.target !== lightboxImg) {
      closeLightbox();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.classList.contains('active')) {
      closeLightbox();
    }
  });

  // Select all images on the page that should be zoomable
  const images = document.querySelectorAll('img');
  images.forEach(img => {
    // Exclude images inside project cards (which are links) or other non-zoomable contexts
    if (!img.closest('a') && !img.closest('.project-img-wrapper')) {
      img.classList.add('zoomable');
      img.addEventListener('click', () => {
        lightboxImg.src = img.src;
        lightboxImg.alt = img.alt;
        lightbox.classList.add('active');
      });
      // Add hover effect for custom cursor if active
      img.addEventListener('mouseenter', () => document.body.classList.add('hover-active'));
      img.addEventListener('mouseleave', () => document.body.classList.remove('hover-active'));
    }
  });
}

// ── PLASMA HOVER GLOW on stat cards ──
function initPlasmaGlow() {
  document.querySelectorAll('.stat-card, .fancy-skill-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.background = `
        radial-gradient(circle at ${x}px ${y}px,
          rgba(0,198,255,0.06) 0%,
          rgba(12,26,46,0.6) 60%)
      `;
    });
    card.addEventListener('mouseleave', () => {
      card.style.background = 'var(--glass-bg)';
    });
  });
}

// ── NAV hide-on-scroll-down / show-on-scroll-up ──
function initNavScroll() {
  let lastScrollY = 0;
  const navbar = document.getElementById('navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      const currentY = window.scrollY;
      if (currentY > lastScrollY && currentY > 80) {
        navbar.style.transform = 'translateY(-100%)';
      } else {
        navbar.style.transform = 'translateY(0)';
      }
      lastScrollY = currentY;
    }, { passive: true });
  }
}

// ─── INIT ───
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('year').textContent = new Date().getFullYear();
  initThreeJS();
  initAnimations();
  initCursor();
  initLightbox();
  initPlasmaGlow();
  initNavScroll();
});
