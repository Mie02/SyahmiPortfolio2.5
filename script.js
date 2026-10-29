/* Shared classic entry point. Existing page interactions + one animation clock.
 * The procedural scene lives in space.js. Three r128 is conditionally loaded there.
 * Pagehide disposes scene/UI resources; the lifecycle pair restores BFCache pages.
 */
(function () {
  'use strict';
  const entryURL = document.currentScript.src;
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  let runtime = null;
  let enginePromise = null;
  let motionOptIn = false;
  try { motionOptIn = sessionStorage.getItem('syz-motion-enabled') === 'true'; } catch (_) {}
  if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
  function loadEngine() {
    if (window.SpaceFX) return Promise.resolve(window.SpaceFX);
    if (!enginePromise) enginePromise = new Promise(resolve => {
      const script = document.createElement('script');
      script.src = new URL('space.js', entryURL).href;
      script.async = true;
      script.onload = () => { script.onload = script.onerror = null; resolve(window.SpaceFX || null); };
      script.onerror = () => { script.onload = script.onerror = null; resolve(null); };
      document.head.appendChild(script);
    });
    return enginePromise;
  }
  function on(r, target, event, callback, options) {
    target.addEventListener(event, callback, options);
    r.cleanup.push(() => target.removeEventListener(event, callback, options));
  }
  function stopClock(r) {
    if (!r.clockRunning) return;
    if (gsap) gsap.ticker.remove(r.frame); else cancelAnimationFrame(r.rafId);
    r.clockRunning = false; r.lastTime = null;
  }
  function startClock(r) {
    if (r.disposed || r.reduced || document.hidden || r.clockRunning) return;
    r.clockRunning = true;
    if (gsap) gsap.ticker.add(r.frame); else r.rafId = requestAnimationFrame(r.nativeFrame);
  }
  function setupClock(r) {
    r.frame = () => {
      if (r.disposed || document.hidden || r.reduced) return;
      const now = performance.now();
      const delta = r.lastTime === null ? 16.67 : Math.min(now - r.lastTime, 50);
      r.lastTime = now;
      if (r.lenis) r.lenis.raf(now);
      if (r.cursor) {
        const ease = 1 - Math.exp(-delta / 95);
        r.cursor.x += (r.cursor.targetX - r.cursor.x) * ease;
        r.cursor.y += (r.cursor.targetY - r.cursor.y) * ease;
        r.cursor.glow.style.left = r.cursor.x + 'px';
        r.cursor.glow.style.top = r.cursor.y + 'px';
      }
      if (window.SpaceFX) window.SpaceFX.update(now);
    };
    r.nativeFrame = () => {
      if (!r.clockRunning) return;
      r.frame();
      if (r.clockRunning) r.rafId = requestAnimationFrame(r.nativeFrame);
    };
    on(r, document, 'visibilitychange', () => {
      document.body.classList.toggle('space-paused', document.hidden);
      if (document.hidden) {
        stopClock(r); if (r.lenis) r.lenis.stop(); if (window.SpaceFX) SpaceFX.pause();
      } else {
        if (r.lenis) r.lenis.start(); if (window.SpaceFX) SpaceFX.resume(); startClock(r);
      }
    });
    startClock(r);
  }
  function setupScrolling(r) {
    if (r.reduced || !window.Lenis) return;
    try {
      r.lenis = new window.Lenis({ duration: 1.2, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        direction: 'vertical', gestureDirection: 'vertical', smooth: true, mouseMultiplier: 1, smoothTouch: false, touchMultiplier: 2, infinite: false });
      if (ScrollTrigger) r.lenis.on('scroll', ScrollTrigger.update);
      if (gsap) gsap.ticker.lagSmoothing(0, 0);
    } catch (_) { r.lenis = null; }
  }
  function setupNavigation(r) {
    const nav = document.getElementById('navbar'), button = document.getElementById('hamburger'), menu = document.getElementById('mobileMenu');
    const mobile = matchMedia('(max-width: 768px)');
    const setMenu = (open, returnFocus) => {
      if (!menu || !button) return;
      r.menuOpen = open;
      menu.hidden = !open; menu.inert = !open;
      menu.classList.toggle('open', open);
      menu.setAttribute('aria-hidden', String(!open));
      button.setAttribute('aria-expanded', String(open));
      button.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.classList.toggle('menu-open', open);
      const main = document.getElementById('smooth-wrapper'), footer = document.querySelector('body > footer'), controls = document.querySelector('.space-controls');
      if (main) main.inert = open;
      if (footer) footer.inert = open;
      if (controls) controls.inert = open;
      if (open) { if (r.lenis) r.lenis.stop(); menu.querySelector('a').focus(); }
      else { if (r.lenis && !document.hidden) r.lenis.start(); if (returnFocus) button.focus(); }
      if (nav) nav.style.transform = '';
    };
    let previous = scrollY;
    const update = () => {
      if (!nav) return;
      nav.classList.toggle('scrolled', scrollY > 50);
      if (!r.home && !r.menuOpen && !nav.contains(document.activeElement)) nav.style.transform = scrollY > previous && scrollY > 80 ? 'translateY(-100%)' : 'translateY(0)';
      previous = scrollY;
    };
    on(r, window, 'scroll', update, { passive: true }); update();
    if (button && menu) {
      setMenu(false, false);
      on(r, button, 'click', () => setMenu(!r.menuOpen, false));
      on(r, document, 'keydown', event => {
        if (!r.menuOpen) return;
        if (event.key === 'Escape') { event.preventDefault(); setMenu(false, true); }
        if (event.key === 'Tab') {
          const links = Array.from(menu.querySelectorAll('a[href]'));
          const items = [button].concat(links), index = items.indexOf(document.activeElement);
          if (event.shiftKey && index <= 0) { event.preventDefault(); items[items.length - 1].focus(); }
          else if (!event.shiftKey && (index === items.length - 1 || index < 0)) { event.preventDefault(); button.focus(); }
        }
      });
      on(r, menu, 'click', event => {
        if (!event.target.closest('a[href]')) return;
        setMenu(false, false);
        document.getElementById('smooth-wrapper').focus({ preventScroll: true });
      });
      on(r, mobile, 'change', () => { if (!mobile.matches) setMenu(false, false); });
      r.cleanup.push(() => setMenu(false, false));
    }
    if (nav) on(r, nav, 'focusin', () => { nav.style.transform = ''; });
    const skip = document.querySelector('.skip-link'), main = document.getElementById('smooth-wrapper');
    if (skip && main) on(r, skip, 'click', event => {
      event.preventDefault(); setMenu(false, false); main.focus({ preventScroll: true });
      if (r.lenis && !r.reduced) r.lenis.scrollTo(0, { immediate: true }); else window.scrollTo(0, 0);
    });
  }
  function setupAnimations(r) {
    if (!gsap || !ScrollTrigger || r.reduced) return;
    document.documentElement.classList.add('has-reveal-animation');
    r.animationContext = gsap.context(() => {
      document.querySelectorAll('.reveal-up').forEach(element => {
        const heroPart = element.closest('.hero-copy');
        const introOrder = heroPart ? Array.from(heroPart.querySelectorAll('.reveal-up')).indexOf(element) : 0;
        gsap.fromTo(element, { y: heroPart ? 38 : 50, autoAlpha: 0, rotationX: heroPart ? 12 : 0 }, { y: 0, rotationX: 0, autoAlpha: 1, duration: 1.15, delay: introOrder * .12, ease: 'power3.out',
          scrollTrigger: { trigger: element, start: 'top 85%', toggleActions: 'play none none reverse' } });
      });
      const gallery = document.getElementById('galleryCamera');
      if (gallery) {
        const section = document.getElementById('projects-showcase');
        r.galleryMedia = gsap.matchMedia();
        r.galleryMedia.add('(min-width: 1024px)', () => {
          if (r.galleryKeyboard) return;
          section.classList.add('gallery-spatial');
          gsap.to(gallery, { z: 4500, rotationZ: 2.2, ease: 'none', scrollTrigger: {
            trigger: section, start: 'top top', end: 'bottom bottom', scrub: 0.6, invalidateOnRefresh: true
          } });
          const projectCards = Array.from(gallery.querySelectorAll('.gallery-item'));
          projectCards.forEach((card,i) => {
            gsap.fromTo(card, { rotationY: i % 2 ? -14 : 14 }, { rotationY: 0, ease: 'none', scrollTrigger: {
              trigger: section, start: () => 'top+=' + (section.offsetHeight - innerHeight) * Math.max(0,(i-.65)/3) + ' top',
              end: () => 'top+=' + (section.offsetHeight - innerHeight) * Math.min(1,(i+.25)/3) + ' top', scrub: .6, invalidateOnRefresh: true
            } });
          });
          return () => section.classList.remove('gallery-spatial');
        });
        // Focusing a project reveals every card in normal document order.
        on(r, gallery, 'focusin', event => {
          if (!section.classList.contains('gallery-spatial')) return;
          r.galleryKeyboard = true; r.galleryMedia.revert();
          ScrollTrigger.refresh();
          event.target.scrollIntoView({ block: 'center', behavior: 'auto' });
          if (r.lenis) r.lenis.resize();
        });
      }
      const track = document.getElementById('horizontalTrack');
      if (track) {
        const distance = () => track.scrollWidth - innerWidth + innerWidth * 0.1;
        gsap.to(track, { x: () => -distance(), ease: 'none', scrollTrigger: { trigger: '.projects-pin-section', start: 'top top', end: () => '+=' + distance(), scrub: 1, pin: true, anticipatePin: 1, invalidateOnRefresh: true } });
      }
    });
  }
  function setupCursor(r) {
    const fine = matchMedia('(hover: hover) and (pointer: fine)');
    if (r.reduced) return;
    const dot = document.getElementById('cursorDot'), glow = document.getElementById('cursorGlow');
    if (!dot || !glow) return;
    const sync = () => {
      const enabled = fine.matches;
      document.body.classList.toggle('custom-cursor-ready', enabled);
      if (!enabled) { r.cursor = null; document.body.classList.remove('hover-active'); }
      else r.cursor = { glow, x: innerWidth / 2, y: innerHeight / 2, targetX: innerWidth / 2, targetY: innerHeight / 2 };
    };
    on(r, fine, 'change', sync); sync();
    on(r, window, 'pointermove', event => {
      if (!r.cursor) return;
      r.cursor.targetX = event.clientX; r.cursor.targetY = event.clientY;
      dot.style.left = event.clientX + 'px'; dot.style.top = event.clientY + 'px';
    }, { passive: true });
    on(r, document, 'pointerover', event => {
      document.body.classList.toggle('hover-active', Boolean(event.target.closest('a,button,.zoomable')));
    }, { passive: true });
    on(r, document, 'pointerout', event => {
      if (!event.relatedTarget || !event.relatedTarget.closest || !event.relatedTarget.closest('a,button,.zoomable')) document.body.classList.remove('hover-active');
    }, { passive: true });
  }
  function setupLightbox(r) {
    if (r.home) return;
    const lightbox = document.createElement('div'); lightbox.className = 'lightbox'; lightbox.id = 'lightbox';
    lightbox.setAttribute('role', 'dialog'); lightbox.setAttribute('aria-modal', 'true'); lightbox.setAttribute('aria-label', 'Image preview');
    lightbox.hidden = true; lightbox.inert = true;
    lightbox.innerHTML = '<button class="lightbox-close" aria-label="Close">&times;</button><img id="lightbox-img" width="1" height="1" alt="Zoomed image">';
    document.body.appendChild(lightbox); r.cleanup.push(() => lightbox.remove());
    const large = lightbox.querySelector('img');
    let timer, opener;
    const closeButton = lightbox.querySelector('button');
    const unlock = () => { document.getElementById('smooth-wrapper').inert = false; document.getElementById('navbar').inert = false; document.querySelector('body > footer').inert = false; const controls = document.querySelector('.space-controls'); if (controls) controls.inert = false; };
    r.cleanup.push(() => { clearTimeout(timer); unlock(); });
    const close = () => {
      lightbox.classList.remove('active'); lightbox.hidden = true; lightbox.inert = true; clearTimeout(timer); unlock();
      if (r.lenis && !document.hidden) r.lenis.start();
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
      large.removeAttribute('src');
    };
    on(r, lightbox, 'click', event => { if (event.target !== large) close(); });
    on(r, document, 'keydown', event => {
      if (!lightbox.classList.contains('active')) return;
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key === 'Tab') { event.preventDefault(); closeButton.focus(); }
    });
    document.querySelectorAll('main img').forEach(image => {
      if (image.closest('a') || image.closest('.project-img-wrapper')) return;
      image.classList.add('zoomable');
      const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'image-preview-trigger';
      trigger.setAttribute('aria-label', 'Enlarge image: ' + image.alt); trigger.setAttribute('aria-haspopup', 'dialog');
      const picture = image.closest('picture') || image;
      picture.before(trigger); trigger.appendChild(picture);
      r.cleanup.push(() => { trigger.before(picture); trigger.remove(); });
      on(r, trigger, 'click', () => {
        clearTimeout(timer); large.width = image.naturalWidth || Number(image.getAttribute('width')) || 1;
        large.height = image.naturalHeight || Number(image.getAttribute('height')) || 1;
        large.src = image.currentSrc || image.src; large.alt = image.alt; opener = trigger;
        lightbox.hidden = false; lightbox.inert = false; lightbox.classList.add('active'); closeButton.focus();
        document.getElementById('smooth-wrapper').inert = true; document.getElementById('navbar').inert = true;
        document.querySelector('body > footer').inert = true;
        const controls = document.querySelector('.space-controls'); if (controls) controls.inert = true;
        if (r.lenis) r.lenis.stop();
      });
    });
  }
  function setupHover(r) {
    if (r.reduced) return;
    const fine = matchMedia('(hover: hover) and (pointer: fine)');
    document.querySelectorAll('.stat-card,.fancy-skill-card,.project-card').forEach(card => {
      card.classList.add('depth-card');
      const reset = () => { card.classList.remove('depth-active'); card.style.removeProperty('--tilt-x'); card.style.removeProperty('--tilt-y'); };
      on(r, card, 'pointermove', event => {
        if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
        const rect = card.getBoundingClientRect();
        const x = Math.max(-.5,Math.min(.5,(event.clientX - rect.left) / rect.width - .5));
        const y = Math.max(-.5,Math.min(.5,(event.clientY - rect.top) / rect.height - .5));
        card.classList.add('depth-active');
        card.style.setProperty('--tilt-x', (-y * 10).toFixed(2) + 'deg');
        card.style.setProperty('--tilt-y', (x * 12).toFixed(2) + 'deg');
      }, { passive: true });
      on(r, card, 'pointerleave', reset); on(r, card, 'pointercancel', reset);
      on(r, card, 'focusin', reset); on(r, fine, 'change', reset);
      r.cleanup.push(() => { reset(); card.classList.remove('depth-card'); });
    });
  }
  function setupProjectFilters(r) {
    const grid = document.getElementById('project-grid');
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll('[data-project-tags]'));
    const buttons = Array.from(document.querySelectorAll('[data-filter]'));
    const status = document.getElementById('project-filter-status');
    const keys = buttons.map(button => button.dataset.filter);
    let active = 'all', measuredWidth = 0;
    const apply = key => {
      active = keys.includes(key) ? key : 'all';
      let count = 0;
      cards.forEach(card => {
        const visible = active === 'all' || card.dataset.projectTags.split(/\s+/).includes(active);
        card.hidden = !visible; card.inert = !visible;
        if (visible) count++;
      });
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === active)));
      status.textContent = count + (count === 1 ? ' project' : ' projects');
      grid.dataset.activeFilter = active;
      if (ScrollTrigger) ScrollTrigger.refresh();
    };
    const measure = () => {
      if (r.disposed) return;
      cards.forEach(card => { card.hidden = false; card.inert = false; });
      grid.style.minHeight = '';
      const height = grid.getBoundingClientRect().height;
      grid.style.minHeight = Math.ceil(height) + 'px';
      measuredWidth = grid.getBoundingClientRect().width;
      apply(active);
      if (r.lenis) r.lenis.resize();
    };
    buttons.forEach(button => on(r, button, 'click', () => {
      apply(button.dataset.filter);
      try { history.pushState(null, '', '#' + active); } catch (_) {}
    }));
    const readHash = () => {
      const key = location.hash.slice(1).toLowerCase();
      if (keys.includes(key)) apply(key); else if (!key) apply('all');
    };
    if (keys.includes(location.hash.slice(1).toLowerCase())) active = location.hash.slice(1).toLowerCase();
    measure();
    on(r, window, 'hashchange', readHash); on(r, window, 'popstate', readHash);
    if (window.ResizeObserver) {
      const observer = new ResizeObserver(() => {
        if (Math.abs(grid.getBoundingClientRect().width - measuredWidth) > 1) measure();
      });
      observer.observe(grid); r.cleanup.push(() => observer.disconnect());
    } else on(r, window, 'resize', measure, { passive: true });
    if (document.fonts) document.fonts.ready.then(() => { if (!r.disposed) measure(); });
    r.cleanup.push(() => {
      cards.forEach(card => { card.hidden = false; card.inert = false; }); grid.style.minHeight = '';
    });
  }
  function setupCopyEmail(r) {
    const button = document.getElementById('copy-email');
    if (!button) return;
    const status = document.getElementById('copy-email-status');
    const fallback = document.getElementById('email-copy-fallback'), field = document.getElementById('email-copy-value');
    button.disabled = false;
    const legacyCopy = value => {
      const buffer = document.createElement('textarea'); buffer.value = value; buffer.readOnly = true;
      buffer.className = 'clipboard-buffer'; document.body.appendChild(buffer); buffer.select();
      let copied = false;
      try { copied = Boolean(document.execCommand && document.execCommand('copy')); } catch (_) {}
      buffer.remove(); return copied;
    };
    on(r, button, 'click', async () => {
      button.disabled = true; status.textContent = ''; fallback.hidden = true;
      let copied = false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(button.dataset.email); copied = true;
        }
      } catch (_) {}
      if (r.disposed) return;
      if (!copied) copied = legacyCopy(button.dataset.email);
      button.disabled = false;
      if (copied) { status.textContent = 'Email address copied.'; button.focus({ preventScroll: true }); }
      else {
        fallback.hidden = false; field.focus(); field.select();
        status.textContent = 'Copy this selected email address.';
      }
    });
    r.cleanup.push(() => { button.disabled = false; status.textContent = ''; fallback.hidden = true; });
  }
  function dispose() {
    const r = runtime; if (!r || r.disposed) return;
    r.disposed = true; stopClock(r);
    if (window.SpaceFX) SpaceFX.dispose();
    if (r.galleryMedia) r.galleryMedia.revert();
    if (r.animationContext) r.animationContext.revert();
    if (r.lenis) r.lenis.destroy();
    r.cleanup.splice(0).forEach(remove => remove());
    document.documentElement.classList.remove('has-reveal-animation','reduced-motion');
    document.body.classList.remove('custom-cursor-ready','hover-active','space-paused');
  }
  async function init() {
    if (runtime && !runtime.disposed) dispose();
    const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
    const r = { reduced: reducedQuery.matches && !motionOptIn, home: document.body.dataset.page === 'home', disposed: false,
      cleanup: [], lenis: null, cursor: null, clockRunning: false, lastTime: null, animationContext: null };
    runtime = r;
    document.documentElement.classList.toggle('motion-opt-in', motionOptIn);
    document.documentElement.classList.toggle('reduced-motion', r.reduced);
    const year = document.getElementById('year'); if (year) year.textContent = new Date().getFullYear();
    setupScrolling(r); setupNavigation(r); setupLightbox(r); setupHover(r); setupCursor(r);
    setupProjectFilters(r); setupCopyEmail(r);
    try { setupAnimations(r); }
    catch (_) { if (r.animationContext) r.animationContext.revert(); document.documentElement.classList.remove('has-reveal-animation'); }
    // Gallery mode and font layout can change the document after Lenis measures it.
    if (r.lenis) {
      r.lenis.resize();
      if (window.ResizeObserver) {
        const observer = new ResizeObserver(() => { if (!r.disposed) r.lenis.resize(); });
        observer.observe(document.body); r.cleanup.push(() => observer.disconnect());
      }
    }
    setupClock(r);
    on(r, reducedQuery, 'change', () => init());
    on(r, window, 'portfolio:enable-motion', () => {
      motionOptIn = true;
      try { sessionStorage.setItem('syz-motion-enabled', 'true'); } catch (_) {}
      init();
    });
    const engine = await loadEngine(); if (r.disposed || !engine) return;
    await engine.init({ lenis: r.lenis });
    if (!r.disposed && ScrollTrigger) ScrollTrigger.refresh();
    if (!r.disposed && r.lenis) r.lenis.resize();
  }
  // This lifecycle pair survives pagehide solely for BFCache recovery.
  window.addEventListener('pagehide', dispose);
  window.addEventListener('pageshow', event => { if (event.persisted) init(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
  window.PortfolioRuntime = Object.freeze({ getStatus: () => ({ running: Boolean(runtime && runtime.clockRunning),
    reducedMotion: Boolean(runtime && runtime.reduced), listeners: runtime ? runtime.cleanup.length : 0,
    clock: gsap ? 'gsap' : 'native-rAF', lenis: Boolean(runtime && runtime.lenis), cursor: Boolean(runtime && runtime.cursor),
    menuOpen: Boolean(runtime && runtime.menuOpen), disposed: !runtime || runtime.disposed }) });
})();
