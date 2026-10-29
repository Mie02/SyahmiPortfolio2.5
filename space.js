/* Deep Space Observatory — procedural Three.js r128 scene, classic script.
 * CONFIG: counts are maximum allocations; quality steps only reduce draw counts.
 * Colours use the existing CSS tokens, with the values below as fallbacks.
 * init({ lenis }), update(nowMs), pause(), resume(), dispose(), getStatus().
 * script.js owns the single GSAP ticker / native-rAF fallback. This file owns no loop.
 * No textures, models, post-processing addons, or image requests are used.
 */
(function () {
  'use strict';
  const CONFIG = Object.freeze({
    stars: { desktop: 6000, mobile: 2000, lite: 1400, ratios: [0.55, 0.30, 0.15] },
    asteroids: { desktop: 240, mobile: 96 },
    ring: { desktop: 620, mobile: 240 },
    pixelRatio: { desktop: 2, mobile: 1 },
    nebula: { planes: 3, octaves: 5, maxChannel: 0.16 },
    shootingStar: { minDelay: 6, maxDelay: 12, duration: 0.85 },
    warp: { departureMs: 480, arrivalMs: 480 },
    quality: { sampleFrames: 60, thresholdMs: 20, maxLevel: 4 },
    colours: { void: '#050810', nebula: '#0C1A2E', aurora: '#1B3A6B', plasma: '#00C6FF', stellar: '#7B61FF', stardust: '#C8D8F0', supernova: '#FF6B6B' },
    threeURL: 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
  });
  const QUALITY_KEY = 'syz-space-quality-v1';
  const ARRIVAL_KEY = 'syz-space-arrival-v1';
  let current = null;
  let threePromise = null;
  let memoryQuality = 0;
  const clamp = (x, low, high) => Math.max(low, Math.min(high, x));
  const mean = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

  function savedQuality() {
    try { memoryQuality = Math.max(memoryQuality, clamp(Number(sessionStorage.getItem(QUALITY_KEY)) || 0, 0, 4)); } catch (_) {}
    return memoryQuality;
  }
  function saveQuality(level) {
    memoryQuality = Math.max(memoryQuality, level);
    try { sessionStorage.setItem(QUALITY_KEY, String(memoryQuality)); } catch (_) {}
  }
  function consumeArrival() {
    try {
      const stamp = Number(sessionStorage.getItem(ARRIVAL_KEY));
      sessionStorage.removeItem(ARRIVAL_KEY);
      return stamp > 0 && Date.now() - stamp < 15000;
    } catch (_) { return false; }
  }
  function loadThree() {
    if (window.THREE) return Promise.resolve(window.THREE);
    if (!threePromise) threePromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = CONFIG.threeURL;
      script.async = true;
      script.dataset.spaceDependency = 'three-r128';
      let timer;
      const finish = error => {
        clearTimeout(timer);
        script.onload = script.onerror = null;
        if (error) reject(error); else resolve(window.THREE);
      };
      script.onload = () => finish(window.THREE ? null : new Error('Three unavailable'));
      script.onerror = () => finish(new Error('Three unavailable'));
      timer = setTimeout(() => finish(new Error('Three timed out')), 12000);
      document.head.appendChild(script);
    });
    return threePromise;
  }

  const NOISE = `
    float hash3(vec3 p) { p = fract(p * 0.3183099 + vec3(0.13,0.37,0.71)); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
    float noise3(vec3 p) {
      vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
      return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
                 mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);
    }
    float fbm(vec3 p, int octaves) {
      float value=0.0, amplitude=0.5;
      for(int i=0;i<5;i++) { if(i>=octaves) break; value+=amplitude*noise3(p); p=p*2.03+vec3(11.3,7.1,3.7); amplitude*=0.5; }
      return value;
    }
  `;
  const QUAD_VERTEX = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
  const STAR_VERTEX = `
    attribute float aSize; attribute float aPhase; attribute float aFrequency; attribute vec3 aColour;
    uniform float uTime, uDpr, uWarp, uGravity; uniform vec2 uPointer;
    varying vec3 vColour; varying float vTwinkle; varying vec2 vDirection;
    void main() {
      vec4 mv=modelViewMatrix*vec4(position,1.0);
      vec4 clip=projectionMatrix*mv;
      vec2 screen=clip.xy/clip.w;
      vec2 delta=uPointer-screen;
      clip.xy+=delta*exp(-dot(delta,delta)*8.0)*uGravity*clip.w;
      clip.xy*=1.0+uWarp*0.18;
      gl_Position=clip;
      gl_PointSize=clamp(aSize*uDpr*(64.0/max(10.0,-mv.z)),1.0,5.5)*(1.0+uWarp*8.0);
      vDirection=normalize(screen+vec2(0.001));
      vColour=aColour;
      vTwinkle=0.84+0.16*sin(6.2831853*aFrequency*uTime+aPhase);
    }
  `;
  const STAR_FRAGMENT = `
    uniform float uOpacity, uWarp; varying vec3 vColour; varying float vTwinkle; varying vec2 vDirection;
    void main() {
      vec2 p=(gl_PointCoord-0.5)*2.0;
      vec2 q=vec2(dot(p,vDirection),dot(p,vec2(-vDirection.y,vDirection.x)));
      q.y*=1.0+uWarp*8.0;
      float core=exp(-dot(q,q)*5.5);
      float halo=exp(-dot(q,q)*2.0)*0.12;
      float alpha=(core+halo)*uOpacity*vTwinkle;
      if(alpha<0.008) discard;
      gl_FragColor=vec4(vColour,alpha);
    }
  `;

  function createState(options) {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches && !document.documentElement.classList.contains('motion-opt-in');
    const mobile = matchMedia('(max-width: 768px)').matches;
    const lowEnd = (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4) ||
      (navigator.deviceMemory > 0 && navigator.deviceMemory <= 4) || Boolean(navigator.connection && navigator.connection.saveData);
    const mode = ['hero', 'lite', 'off'].includes(document.body.dataset.space) ? document.body.dataset.space : 'off';
    return {
      mode, reduced, mobile, lowEnd, compact: mobile || lowEnd, lenis: options.lenis || null,
      disposed: false, ready: false, lost: false, inView: true, manualPause: false, hidden: document.hidden,
      reason: mode === 'off' ? 'off' : 'loading', quality: savedQuality(), elapsed: 0, lastTime: null,
      frames: 0, samples: [], rolling: [], history: [], restores: 0, seed: 128042,
      geometry: new Set(), materials: new Set(), meshes: new Set(), listeners: [], gpuListeners: [], observers: [],
      stars: [], nebula: [], sections: [], ownedIds: [], scroll: { value: 0 }, anchors: [],
      pointer: { x: 0, y: 0 }, damped: { x: 0, y: 0 }, uniforms: [],
      renderer: null, scene: null, camera: null, canvas: null, context: null,
      planet: null, surface: null, belt: null, ring: null, galaxy: null, shooting: null,
      orbit: { x: -0.16, y: 0, targetX: -0.16, targetY: 0, dragging: false, pointerId: null },
      orbitals: [], satellites: [], corridor: [], scenePaused: false,
      nextShot: 6 + Math.random() * 6, shotStart: null, shots: 0, warp: null, warpTimer: null,
      arrived: consumeArrival(), lastHUD: '', width: innerWidth, height: innerHeight,
      baseStars: mode === 'lite' ? CONFIG.stars.lite : (mobile || lowEnd ? CONFIG.stars.mobile : CONFIG.stars.desktop),
      baseAsteroids: mobile || lowEnd ? CONFIG.asteroids.mobile : CONFIG.asteroids.desktop,
      baseDpr: Math.min(devicePixelRatio || 1, mobile || lowEnd ? CONFIG.pixelRatio.mobile : CONFIG.pixelRatio.desktop)
    };
  }
  function listen(s, target, event, fn, options) {
    target.addEventListener(event, fn, options);
    s.listeners.push(() => target.removeEventListener(event, fn, options));
  }
  function listenGPU(s, event, fn) {
    const canvas = s.canvas;
    canvas.addEventListener(event, fn);
    s.gpuListeners.push(() => canvas.removeEventListener(event, fn));
  }
  function random(s) {
    s.seed = (1664525 * s.seed + 1013904223) >>> 0;
    return s.seed / 4294967296;
  }
  function geometry(s, value) { s.geometry.add(value); return value; }
  function material(s, value) { s.materials.add(value); return value; }
  function colours(s) {
    const tokens = getComputedStyle(document.documentElement);
    return Object.fromEntries(Object.entries(CONFIG.colours).map(([name, fallback]) => [name,
      new s.THREE.Color(tokens.getPropertyValue('--' + name).trim() || fallback)]));
  }

  function buildStars(s) {
    const T = s.THREE;
    const layers = [
      { z: -165, depth: 75, spread: 330, opacity: 0.50, size: 1.8, parallax: 0.45 },
      { z: -90, depth: 55, spread: 210, opacity: 0.65, size: 1.65, parallax: 1.15 },
      { z: -26, depth: 36, spread: 115, opacity: 0.82, size: 1.25, parallax: 2.1 }
    ];
    let assigned = 0;
    layers.forEach((layer, index) => {
      const count = index === 2 ? s.baseStars - assigned : Math.floor(s.baseStars * CONFIG.stars.ratios[index]);
      assigned += count;
      const positions = new Float32Array(count * 3), colours = new Float32Array(count * 3);
      const sizes = new Float32Array(count), phases = new Float32Array(count), frequencies = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        positions[i * 3] = (random(s) - 0.5) * layer.spread;
        positions[i * 3 + 1] = (random(s) - 0.5) * layer.spread * 0.75;
        positions[i * 3 + 2] = layer.z + random(s) * layer.depth;
        const warm = random(s), tint = new T.Color().setRGB(0.70 + warm * 0.30, 0.82 + warm * 0.05, 1.0 - warm * 0.31);
        tint.toArray(colours, i * 3);
        sizes[i] = layer.size * (0.55 + random(s));
        phases[i] = random(s) * Math.PI * 2;
        frequencies[i] = 0.08 + random(s) * 0.24; // 0.08–0.32 Hz, amplitude never reaches zero.
      }
      const geo = geometry(s, new T.BufferGeometry());
      geo.setAttribute('position', new T.BufferAttribute(positions, 3));
      geo.setAttribute('aColour', new T.BufferAttribute(colours, 3));
      geo.setAttribute('aSize', new T.BufferAttribute(sizes, 1));
      geo.setAttribute('aPhase', new T.BufferAttribute(phases, 1));
      geo.setAttribute('aFrequency', new T.BufferAttribute(frequencies, 1));
      const uniforms = { uTime: { value: 0 }, uDpr: { value: s.baseDpr }, uWarp: { value: 0 },
        uGravity: { value: index === 2 ? 0.045 : 0 }, uPointer: { value: new T.Vector2() }, uOpacity: { value: layer.opacity } };
      const mat = material(s, new T.ShaderMaterial({ uniforms, vertexShader: STAR_VERTEX, fragmentShader: STAR_FRAGMENT,
        transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
      const points = new T.Points(geo, mat);
      points.frustumCulled = false;
      points.renderOrder = 1;
      s.scene.add(points);
      s.stars.push({ points, uniforms, count, parallax: layer.parallax });
    });
  }

  function buildNebula(s) {
    const T = s.THREE, c = s.colours;
    const fragment = `
      varying vec2 vUv; uniform float uTime, uSeed, uCap; uniform int uOctaves;
      uniform vec3 uAurora, uStellar, uPlasma, uAccent;
      ${NOISE}
      void main() {
        vec2 uv=(vUv-0.5)*2.0;
        vec3 p=vec3(uv*2.1+vec2(uTime*0.007,-uTime*0.004),uSeed);
        float haze=fbm(p+vec3(fbm(p+3.7,uOctaves)),uOctaves);
        float filaments=fbm(p*2.0+vec3(haze*1.7),uOctaves);
        float cloud=smoothstep(0.30,0.77,haze)*(1.0-smoothstep(0.15,1.3,length(uv*vec2(0.8,1.0))));
        vec3 colour=mix(uAurora,uStellar,smoothstep(0.25,0.8,filaments));
        colour=mix(colour,uPlasma,pow(filaments,3.0)*0.45);
        colour=mix(colour,uAccent,pow(haze,8.0)*0.18);
        gl_FragColor=vec4(min(colour*0.42,vec3(uCap)),cloud*0.55);
      }
    `;
    const planeCount = s.mode === 'lite' ? 2 : CONFIG.nebula.planes;
    for (let i = 0; i < planeCount; i++) {
      const uniforms = { uTime: { value: 0 }, uSeed: { value: i * 4.9 + 2.0 }, uOctaves: { value: CONFIG.nebula.octaves },
        uCap: { value: CONFIG.nebula.maxChannel }, uAurora: { value: c.aurora }, uStellar: { value: c.stellar },
        uPlasma: { value: c.plasma }, uAccent: { value: c.supernova } };
      const mat = material(s, new T.ShaderMaterial({ uniforms, vertexShader: QUAD_VERTEX, fragmentShader: fragment,
        transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
      const mesh = new T.Mesh(geometry(s, new T.PlaneGeometry(240, 160)), mat);
      mesh.position.set((i - 1) * 30, (i % 2 ? -1 : 1) * 12, -140 + i * 28);
      mesh.rotation.z = i * 0.65;
      mesh.renderOrder = 0;
      s.scene.add(mesh);
      s.nebula.push({ mesh, uniforms });
    }
  }

  function buildPlanet(s) {
    const T = s.THREE, c = s.colours;
    const group = new T.Group();
    const sphere = geometry(s, new T.SphereGeometry(1, s.compact ? 40 : 64, s.compact ? 24 : 40));
    const mat = material(s, new T.ShaderMaterial({
      uniforms: { uAurora: { value: c.aurora }, uStellar: { value: c.stellar }, uPlasma: { value: c.plasma } },
      vertexShader: `varying vec3 vPosition,vNormal; void main(){vPosition=position;vNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `varying vec3 vPosition,vNormal; uniform vec3 uAurora,uStellar,uPlasma;
        ${NOISE}
        void main(){
          vec3 p=normalize(vPosition);
          float terrain=fbm(p*4.8+vec3(fbm(p*2.8,5)*1.8),5);
          float detail=fbm(p*24.0,3);
          float land=smoothstep(0.39,0.65,terrain);
          vec3 surface=mix(uAurora*0.75,uStellar*0.85,land);
          surface=mix(surface,uPlasma*0.75,smoothstep(0.54,0.73,detail));
          float light=max(0.0,dot(normalize(vNormal),normalize(vec3(-0.7,0.45,1.0))));
          float terminator=smoothstep(0.0,0.38,light);
          surface*=0.22+terminator*(0.85+detail*0.45);
          float coast=pow(1.0-abs(terrain-0.5)*2.0,28.0)*0.25;
          float latitude=1.0-smoothstep(0.012,0.025,abs(sin(asin(p.y)*18.0)));
          float longitude=1.0-smoothstep(0.012,0.025,abs(sin(atan(p.z,p.x)*18.0)));
          gl_FragColor=vec4(surface+uPlasma*(coast+(latitude+longitude)*0.055),1.0);
        }`
    }));
    s.surface = new T.Mesh(sphere, mat);
    s.surface.renderOrder = 3;
    group.add(s.surface);
    const atmosphere = material(s, new T.ShaderMaterial({
      uniforms: { uColour: { value: c.plasma } },
      vertexShader: `varying vec3 vNormal,vView; void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);vNormal=normalize(normalMatrix*normal);vView=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `varying vec3 vNormal,vView;uniform vec3 uColour;void main(){float rim=pow(1.0-abs(dot(normalize(vNormal),normalize(vView))),2.4);gl_FragColor=vec4(uColour,rim*0.55);}`,
      side: T.BackSide, transparent: true, blending: T.AdditiveBlending, depthWrite: false
    }));
    const shell = new T.Mesh(sphere, atmosphere);
    shell.scale.setScalar(1.085);
    shell.renderOrder = 4;
    group.add(shell);
    const ringCount = s.compact ? CONFIG.ring.mobile : CONFIG.ring.desktop;
    const positions = new Float32Array(ringCount * 3);
    for (let i = 0; i < ringCount; i++) {
      const angle = random(s) * Math.PI * 2, radius = 1.42 + random(s) * 0.16;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = (random(s) - 0.5) * 0.02;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    const ringGeo = geometry(s, new T.BufferGeometry());
    ringGeo.setAttribute('position', new T.BufferAttribute(positions, 3));
    const ringMat = material(s, new T.PointsMaterial({ color: c.plasma, size: 0.018, transparent: true, opacity: 0.45, depthWrite: false, blending: T.AdditiveBlending }));
    s.ring = new T.Points(ringGeo, ringMat);
    s.ring.rotation.x = 0.48;
    s.ring.rotation.z = -0.20;
    s.ring.userData.baseCount = ringCount;
    group.add(s.ring);
    const asteroidGeo = geometry(s, new T.IcosahedronGeometry(1, 0));
    const asteroidMat = material(s, new T.MeshLambertMaterial({ color: c.stardust.clone().multiplyScalar(0.34) }));
    const belt = new T.InstancedMesh(asteroidGeo, asteroidMat, s.baseAsteroids);
    const dummy = new T.Object3D();
    for (let i = 0; i < s.baseAsteroids; i++) {
      const angle = random(s) * Math.PI * 2, radius = 1.78 + random(s) * 0.27;
      dummy.position.set(Math.cos(angle) * radius, (random(s) - 0.5) * 0.10, Math.sin(angle) * radius);
      dummy.rotation.set(random(s) * 6, random(s) * 6, random(s) * 6);
      const size = 0.009 + random(s) * 0.025;
      dummy.scale.set(size, size * (0.6 + random(s)), size * (0.6 + random(s)));
      dummy.updateMatrix();
      belt.setMatrixAt(i, dummy.matrix);
    }
    belt.instanceMatrix.needsUpdate = true;
    belt.rotation.x = 0.48;
    belt.rotation.z = -0.20;
    s.meshes.add(belt);
    s.belt = belt;
    group.add(belt);
    // Solid, lit rings and small satellites make occlusion and perspective legible.
    const railMat = material(s, new T.MeshStandardMaterial({ color: c.aurora,
      metalness: 0.65, roughness: 0.32, emissive: c.plasma, emissiveIntensity: 0.18 }));
    const cyanMat = material(s, new T.MeshBasicMaterial({ color: c.plasma }));
    const violetMat = material(s, new T.MeshBasicMaterial({ color: c.stellar }));
    const railGeo = geometry(s, new T.TorusGeometry(1.50, 0.023, 6, s.compact ? 72 : 120));
    const filamentGeo = geometry(s, new T.TorusGeometry(1.54, 0.006, 4, s.compact ? 72 : 120));
    for (let i = 0; i < 3; i++) {
      const orbit = new T.Group();
      orbit.rotation.set(0.85 + i * 0.65, i * 0.68, -0.32 + i * 0.55);
      orbit.scale.setScalar(1 + i * 0.15);
      orbit.add(new T.Mesh(railGeo, railMat), new T.Mesh(filamentGeo, i === 1 ? violetMat : cyanMat));
      const satellite = new T.Group();
      const core = new T.Mesh(geometry(s, new T.OctahedronGeometry(0.085)), cyanMat);
      const housing = new T.Mesh(geometry(s, new T.BoxGeometry(0.18, 0.08, 0.12)), railMat);
      satellite.add(core, housing); orbit.add(satellite);
      s.satellites.push(satellite); s.orbitals.push(orbit); group.add(orbit);
    }
    const light = new T.DirectionalLight(c.plasma, 1.3);
    light.position.set(-3, 5, 8);
    s.scene.add(light, new T.AmbientLight(c.stellar, 0.45));
    s.scene.add(group);
    s.planet = group;
  }

  function buildLife(s) {
    const T = s.THREE;
    // A camera-facing procedural quad is the galaxy sprite; it has no texture.
    const galaxyMat = material(s, new T.ShaderMaterial({ uniforms: { uColour: { value: s.colours.stellar } }, vertexShader: QUAD_VERTEX,
      fragmentShader: `varying vec2 vUv;uniform vec3 uColour;void main(){vec2 p=(vUv-0.5)*2.0;p.y*=2.8;float r=length(p);float a=atan(p.y,p.x);float arms=pow(0.5+0.5*sin(a*2.0+log(r+0.05)*5.0),5.0);float core=exp(-r*r*70.0);float glow=exp(-r*5.0)*(0.18+arms*0.8)+core;gl_FragColor=vec4(mix(uColour,vec3(0.8,0.86,0.95),core),glow*0.22);}`,
      transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
    s.galaxy = new T.Mesh(geometry(s, new T.PlaneGeometry(44, 32)), galaxyMat);
    s.galaxy.position.set(-57, 28, -130);
    s.galaxy.rotation.z = -0.35;
    s.scene.add(s.galaxy);
    const trailMat = material(s, new T.ShaderMaterial({ uniforms: { uOpacity: { value: 0 }, uColour: { value: s.colours.stardust } }, vertexShader: QUAD_VERTEX,
      fragmentShader: `varying vec2 vUv;uniform float uOpacity;uniform vec3 uColour;void main(){float tail=pow(vUv.x,3.0);float core=exp(-pow((vUv.y-0.5)*12.0,2.0));gl_FragColor=vec4(uColour,tail*core*uOpacity);}`,
      transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
    s.shooting = new T.Mesh(geometry(s, new T.PlaneGeometry(6, 0.13)), trailMat);
    s.shooting.visible = false;
    s.shooting.rotation.z = -0.35;
    s.scene.add(s.shooting);
    // A geometric tunnel sits behind the spatial project gallery, with no extra renderer.
    for (let i = 0; i < (s.compact ? 4 : 7); i++) {
      const points = [];
      for (let j = 0; j < 64; j++) {
        const a = j / 64 * Math.PI * 2;
        points.push(new T.Vector3(Math.cos(a) * 19, Math.sin(a) * 19, 0));
      }
      const line = new T.LineLoop(geometry(s, new T.BufferGeometry().setFromPoints(points)),
        material(s, new T.LineBasicMaterial({ color: i % 2 ? s.colours.stellar : s.colours.plasma, transparent: true, opacity: 0, depthWrite: false })));
      s.scene.add(line); s.corridor.push(line);
    }
  }

  function buildScene(s) {
    s.seed = 128042;
    s.scene = new s.THREE.Scene();
    s.camera = new s.THREE.PerspectiveCamera(52, s.width / s.height, 0.1, 500);
    s.camera.position.set(0, 0, 44);
    s.colours = colours(s);
    s.path = new s.THREE.CatmullRomCurve3([
      new s.THREE.Vector3(0, 0, 44), new s.THREE.Vector3(1.3, -0.4, 39),
      new s.THREE.Vector3(-1.8, 1.0, 31), new s.THREE.Vector3(0, 1.8, 24)
    ]);
    s.pathPoint = new s.THREE.Vector3();
    buildStars(s);
    buildNebula(s);
    if (s.mode === 'hero') { buildPlanet(s); buildLife(s); }
    applyQuality(s);
  }
  function applyQuality(s) {
    if (!s.renderer) return;
    const ratio = s.quality >= 1 ? Math.max(0.75, s.baseDpr * 0.65) : s.baseDpr;
    s.renderer.setPixelRatio(ratio);
    s.renderer.setSize(s.width, s.height, false);
    s.stars.forEach(layer => {
      layer.points.geometry.setDrawRange(0, Math.floor(layer.count * (s.quality >= 2 ? 0.55 : 1)));
      layer.uniforms.uDpr.value = ratio;
    });
    s.nebula.forEach(layer => { layer.uniforms.uOctaves.value = s.quality >= 3 ? 3 : CONFIG.nebula.octaves; });
    if (s.ring) s.ring.geometry.setDrawRange(0, Math.floor(s.ring.userData.baseCount * (s.quality >= 2 ? 0.6 : 1)));
    if (s.belt) s.belt.count = Math.floor(s.baseAsteroids * (s.quality >= 4 ? 0.4 : 1));
  }
  function recordFrame(s, delta) {
    s.rolling.push(delta);
    if (s.rolling.length > 120) s.rolling.shift();
    s.samples.push(delta);
    if (s.samples.length === CONFIG.quality.sampleFrames) {
      const average = mean(s.samples);
      s.history.push({ level: s.quality, frames: s.samples.length, averageMs: average });
      if (s.history.length > 12) s.history.shift();
      s.samples = [];
      if (average > CONFIG.quality.thresholdMs && s.quality < CONFIG.quality.maxLevel) {
        s.quality++;
        saveQuality(s.quality);
        applyQuality(s);
      }
    }
  }

  function buildHUD(s) {
    const sections = Array.from(document.querySelectorAll('main section'));
    const labels = s.mode === 'hero' ? ['Hero', 'Expertise', 'Selected Works', 'Contact'] : null;
    sections.forEach((element, i) => {
      if (!element.id) { element.id = 'space-section-' + (i + 1); s.ownedIds.push(element); }
      const heading = element.querySelector('h1,h2');
      const label = labels ? labels[i] : (heading ? heading.innerText.replace(/\s+/g, ' ').trim() : 'Section ' + (i + 1));
      if (label) s.sections.push({ element, label, offset: 0 });
    });
    const controls = document.createElement('div'); controls.className = 'space-controls';
    const hud = document.createElement('div'); hud.className = 'space-hud'; hud.setAttribute('aria-hidden', 'true');
    const navigation = document.createElement('nav'); navigation.className = 'space-hud-navigation';
    navigation.setAttribute('aria-label', 'Section navigation');
    const rail = document.createElement('div');
    rail.className = 'space-hud-rail';
    rail.setAttribute('aria-hidden', 'true');
    hud.appendChild(rail);
    s.sections.forEach((section, i) => {
      const link = document.createElement('a');
      link.className = 'space-waypoint';
      link.href = '#' + section.element.id;
      link.setAttribute('aria-label', 'Go to ' + section.label);
      link.dataset.label = section.label;
      link.style.top = (i / Math.max(1, s.sections.length - 1) * 100) + '%';
      listen(s, link, 'click', event => {
        event.preventDefault();
        if (s.lenis && !s.reduced) s.lenis.scrollTo(section.element, { offset: -90, duration: 0.9 });
        else window.scrollTo({ top: Math.max(0, section.element.getBoundingClientRect().top + scrollY - 90), behavior: s.reduced ? 'auto' : 'smooth' });
        // Project filters own that page's hash; waypoints still scroll normally.
        try { if (!document.getElementById('project-grid')) history.replaceState(null, '', '#' + section.element.id); } catch (_) {}
      });
      navigation.appendChild(link);
      section.link = link;
    });
    const readout = document.createElement('div');
    readout.className = 'space-hud-readout';
    readout.setAttribute('aria-live', 'off');
    hud.appendChild(readout);
    controls.append(hud, navigation); document.body.appendChild(controls);
    s.hud = controls; s.readout = readout;
    s.transition = document.createElement('div'); s.transition.className = 'space-transition';
    s.transition.setAttribute('aria-hidden', 'true'); document.body.appendChild(s.transition);
  }
  function measure(s) {
    if (s.disposed) return;
    s.width = innerWidth; s.height = innerHeight;
    s.maxScroll = Math.max(1, document.documentElement.scrollHeight - s.height);
    s.sections.forEach(section => { section.offset = section.element.getBoundingClientRect().top + scrollY; });
    s.anchors = s.sections.map(section => clamp(section.offset / s.maxScroll, 0, 1));
    if (s.anchor) {
      const rect = s.anchor.getBoundingClientRect();
      s.anchorBox = { x: rect.left, y: rect.top + scrollY, width: rect.width, height: rect.height };
    }
    const gallery = document.getElementById('projects-showcase');
    if (gallery) { const rect = gallery.getBoundingClientRect(); s.galleryBox = { y: rect.top + scrollY, height: rect.height, spatial: gallery.classList.contains('gallery-spatial') }; }
    if (s.camera) {
      s.camera.aspect = s.width / s.height;
      s.camera.updateProjectionMatrix();
      const dpr = s.renderer.getPixelRatio();
      if (s.canvas.width !== Math.floor(s.width * dpr) || s.canvas.height !== Math.floor(s.height * dpr)) {
        s.renderer.setSize(s.width, s.height, false);
      }
    }
    updateHUD(s);
  }
  function updateHUD(s) {
    if (!s.hud || s.disposed) return;
    const progress = clamp(scrollY / (s.maxScroll || 1), 0, 1);
    if (!s.scrollTween) s.scroll.value = progress;
    let active = 0;
    s.sections.forEach((section, i) => { if (scrollY + s.height * 0.35 >= section.offset) active = i; });
    const label = s.sections[active] ? s.sections[active].label : '';
    const key = label + ' · ' + Math.round(progress * 100) + '%';
    s.hud.style.setProperty('--space-progress', String(progress));
    if (key !== s.lastHUD) {
      s.readout.textContent = key;
      s.sections.forEach((section, i) => {
        if (i === active) section.link.setAttribute('aria-current', 'location');
        else section.link.removeAttribute('aria-current');
      });
      s.lastHUD = key;
    }
  }
  function setupScroll(s) {
    if (window.gsap && window.ScrollTrigger && !s.reduced) {
      s.scrollTween = gsap.to(s.scroll, { value: 1, ease: 'none', scrollTrigger: {
        trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.8, invalidateOnRefresh: true
      } });
      const refresh = () => measure(s);
      ScrollTrigger.addEventListener('refresh', refresh);
      s.listeners.push(() => ScrollTrigger.removeEventListener('refresh', refresh));
    }
    listen(s, window, 'scroll', () => {
      updateHUD(s);
      if (s.ready && !s.lost && (s.reduced || s.scenePaused)) render(s, performance.now(), 0);
    }, { passive: true });
  }
  function cameraPhase(s) {
    if (s.mode !== 'hero' || s.anchors.length < 4) return s.scroll.value;
    const p = s.scroll.value;
    for (let i = 0; i < 3; i++) {
      if (p <= s.anchors[i + 1]) return (i + clamp((p - s.anchors[i]) / Math.max(0.001, s.anchors[i + 1] - s.anchors[i]), 0, 1)) / 3;
    }
    return 1;
  }
  function updateScene(s, delta) {
    const T = s.THREE, phase = cameraPhase(s);
    s.path.getPoint(clamp(phase, 0, 1), s.pathPoint);
    s.camera.position.copy(s.pathPoint);
    const fov = 52 + Math.sin(phase * Math.PI) * 2.4;
    if (Math.abs(s.camera.fov - fov) > 0.01) { s.camera.fov = fov; s.camera.updateProjectionMatrix(); }
    const ease = 1 - Math.exp(-delta * 3.6);
    s.damped.x += (s.pointer.x - s.damped.x) * ease;
    s.damped.y += (s.pointer.y - s.damped.y) * ease;
    s.stars.forEach((layer, i) => {
      layer.uniforms.uTime.value = s.elapsed;
      layer.uniforms.uPointer.value.set(s.damped.x, s.damped.y);
      layer.points.position.set(s.damped.x * layer.parallax, s.damped.y * layer.parallax, 0);
      layer.points.rotation.z = s.elapsed * (0.00035 + i * 0.00012);
    });
    s.nebula.forEach(layer => { layer.uniforms.uTime.value = s.elapsed; });
    const intro = s.reduced ? 1 : 1 - Math.pow(1 - clamp(s.elapsed / 2.2, 0, 1), 3);
    if (s.galleryBox) {
      const box = s.galleryBox;
      const enter = clamp((scrollY - box.y + s.height) / s.height, 0, 1);
      const leave = clamp((box.y + box.height - scrollY) / s.height, 0, 1);
      s.corridor.forEach((ring,i) => {
        ring.visible = box.spatial && enter > 0 && leave > 0;
        ring.material.opacity = Math.min(enter,leave) * .20;
        ring.position.set(s.camera.position.x,s.camera.position.y,s.camera.position.z - 28 - ((i * 22 - phase * 150) % 154 + 154) % 154);
        ring.rotation.set(.10 * Math.sin(phase * 6), .13 * Math.cos(phase * 6), i * .12 + phase);
      });
    }
    if (s.planet && s.anchorBox) {
      const box = s.anchorBox, depth = -6;
      const halfHeight = Math.tan(T.MathUtils.degToRad(s.camera.fov * 0.5)) * (s.camera.position.z - depth);
      const x = (box.x + box.width * 0.5) / s.width * 2 - 1;
      const y = 1 - ((box.y - scrollY + box.height * 0.5) / s.height * 2);
      s.planet.position.set(s.camera.position.x + x * halfHeight * s.camera.aspect, s.camera.position.y + y * halfHeight, depth);
      const radius = box.width / s.height * halfHeight * 0.46;
      s.planet.scale.setScalar(radius * (.65 + intro * .35));
      s.ring.material.size = Math.max(0.025, radius * 0.025);
      const orbitEase = s.reduced || s.scenePaused ? 1 : 1 - Math.exp(-delta * 9);
      s.orbit.x += (s.orbit.targetX - s.orbit.x) * orbitEase;
      s.orbit.y += (s.orbit.targetY - s.orbit.y) * orbitEase;
      const heroTravel = clamp(scrollY / Math.max(1,box.y + box.height),0,1);
      s.planet.rotation.set(s.orbit.x + s.damped.y * 0.045 + heroTravel * .35, s.orbit.y + (1 - intro) * 2.2 + heroTravel * .85, -0.12 + s.damped.x * -0.035);
      s.surface.rotation.y = s.elapsed * 0.035 + phase * 0.18;
      s.belt.rotation.y = s.elapsed * 0.018;
      s.ring.rotation.y = s.elapsed * 0.012;
      s.orbitals.forEach((orbital, i) => {
        const assemble = s.reduced ? 1 : 1 - Math.pow(1 - clamp((s.elapsed - i * .18) / 1.8,0,1),3);
        orbital.scale.setScalar((1 + i * .15) * (1.65 - assemble * .65));
        orbital.rotation.z = -0.32 + i * 0.55 + s.elapsed * (i === 1 ? -0.025 : 0.025);
        const angle = s.elapsed * (0.14 + i * 0.04) + i * 2.1;
        s.satellites[i].position.set(Math.cos(angle) * 1.50, Math.sin(angle) * 1.50, 0);
        s.satellites[i].rotation.z = angle;
      });
      s.planet.visible = box.y - scrollY + box.height > -40 && box.y - scrollY < s.height + 40;
      const outerRadius = radius * 2.12 / (halfHeight * 2) * s.height;
      s.planetBounds = { left: box.x + box.width * 0.5 - outerRadius, right: box.x + box.width * 0.5 + outerRadius,
        top: box.y - scrollY + box.height * 0.5 - outerRadius, bottom: box.y - scrollY + box.height * 0.5 + outerRadius };
    }
    if (s.shooting && !s.reduced) {
      if (s.shotStart === null && s.elapsed >= s.nextShot && !s.warp) {
        s.shotStart = s.elapsed; s.shots++;
        s.shotOrigin = { x: -25 + random(s) * 30, y: 8 + random(s) * 15 };
      }
      if (s.shotStart !== null) {
        const p = (s.elapsed - s.shotStart) / CONFIG.shootingStar.duration;
        if (p >= 1) {
          s.nextShot = s.shotStart + CONFIG.shootingStar.minDelay + random(s) * (CONFIG.shootingStar.maxDelay - CONFIG.shootingStar.minDelay);
          s.shooting.visible = false; s.shotStart = null;
        } else {
          s.shooting.visible = true;
          s.shooting.position.set(s.shotOrigin.x + p * 25, s.shotOrigin.y - p * 9, -22);
          s.shooting.material.uniforms.uOpacity.value = Math.sin(p * Math.PI) * 0.65;
        }
      }
    }
  }

  function clearWarp(s) {
    clearTimeout(s.warpTimer); s.warpTimer = null; s.warp = null;
    document.documentElement.classList.remove('space-warp-out', 'space-warp-in');
    document.documentElement.style.removeProperty('--space-page-opacity');
    document.documentElement.style.removeProperty('--space-warp-amount');
    s.stars.forEach(layer => { layer.uniforms.uWarp.value = 0; });
  }
  function navigate(s) {
    if (!s.warp || s.warp.type !== 'out') return;
    const destination = s.warp.url;
    try { sessionStorage.setItem(ARRIVAL_KEY, String(Date.now())); } catch (_) {}
    clearWarp(s);
    window.location.assign(destination);
  }
  function setupWarp(s) {
    listen(s, document, 'click', event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
      let target;
      try { target = new URL(link.href, location.href); } catch (_) { return; }
      if (!['http:', 'https:', 'file:'].includes(target.protocol) || target.origin !== location.origin || !/\.html$/i.test(target.pathname)) return;
      if (target.pathname === location.pathname && target.search === location.search) return;
      if (s.reduced || !s.ready || s.lost || s.hidden || !s.inView || s.manualPause || s.scenePaused) return;
      event.preventDefault();
      if (s.warp && s.warp.type === 'out') return;
      clearWarp(s);
      s.warp = { type: 'out', start: performance.now(), duration: CONFIG.warp.departureMs, url: target.href };
      document.documentElement.classList.add('space-warp-out');
      // Navigation is bounded independently of render cadence or an off-screen canvas.
      s.warpTimer = setTimeout(() => navigate(s), CONFIG.warp.departureMs);
    });
  }
  function updateWarp(s, now) {
    if (!s.warp) return;
    const p = clamp((now - s.warp.start) / s.warp.duration, 0, 1);
    const amount = s.warp.type === 'out' ? p * p : Math.pow(1 - p, 2);
    s.stars.forEach(layer => { layer.uniforms.uWarp.value = amount; });
    document.documentElement.style.setProperty('--space-warp-amount', String(amount));
    s.camera.fov += amount * 20; s.camera.updateProjectionMatrix();
    document.documentElement.style.setProperty('--space-page-opacity', String(s.warp.type === 'out' ? 1 - Math.pow(p, 3) : 1 - amount * 0.40));
    if (p >= 1) { if (s.warp.type === 'out') navigate(s); else clearWarp(s); }
  }
  function render(s, now, delta) {
    updateScene(s, delta);
    updateWarp(s, now);
    s.renderer.render(s.scene, s.camera);
    s.frames++;
  }
  function clearScene(s) {
    s.meshes.forEach(mesh => { if (mesh.dispose) mesh.dispose(); }); s.meshes.clear();
    s.geometry.forEach(value => value.dispose()); s.geometry.clear();
    s.materials.forEach(value => value.dispose()); s.materials.clear();
    if (s.scene) s.scene.clear();
    s.stars = []; s.nebula = []; s.orbitals = []; s.satellites = []; s.corridor = [];
    s.planet = s.surface = s.ring = s.belt = s.galaxy = s.shooting = null;
    s.shotStart = null;
  }
  function releaseGPU(s) {
    s.gpuListeners.splice(0).forEach(remove => remove());
    clearScene(s);
    if (s.renderer) { s.renderer.dispose(); s.renderer = null; }
    if (s.context && !s.context.isContextLost()) {
      const extension = s.context.getExtension('WEBGL_lose_context');
      if (extension) extension.loseContext();
    }
    if (s.canvas) s.canvas.remove();
    s.canvas = s.context = s.camera = s.scene = null;
    s.ready = false;
    document.body.classList.remove('space-rendered');
  }
  function fallback(s, reason) {
    s.reason = reason; s.ready = false; s.lastTime = null;
    document.body.classList.remove('space-rendered');
    syncOrbitControls(s);
    if (s.warp && s.warp.type === 'out') navigate(s); else clearWarp(s);
  }

  function syncOrbitControls(s) {
    if (!s.stage) return;
    const controls = document.querySelector('.orbital-controls');
    controls.hidden = !s.ready;
    if (s.ready) s.stage.tabIndex = 0; else s.stage.removeAttribute('tabindex');
    const help = document.getElementById('orbital-help');
    help.textContent = s.ready ? 'Drag to rotate · use arrow keys when focused' :
      s.reason === 'loading' ? 'Interactive orbit · loading 3D' : 'Static orbit preview · 3D is unavailable';
    const pause = controls.querySelector('[data-orbit="pause"]');
    pause.disabled = false;
    pause.textContent = s.reduced ? 'Enable motion' : s.scenePaused ? 'Resume motion' : 'Pause motion';
    pause.setAttribute('aria-pressed', String(s.scenePaused));
    s.stage.dataset.rotation = s.orbit.targetY.toFixed(3);
  }
  function setupOrbitControls(s) {
    s.stage = document.getElementById('orbital-stage');
    if (!s.stage) return;
    syncOrbitControls(s);
    const redraw = () => {
      syncOrbitControls(s);
      if (s.ready && !s.lost && (s.reduced || s.scenePaused)) render(s, performance.now(), 0);
    };
    const rotate = (x, y) => {
      if (!s.ready) return;
      s.orbit.targetX = clamp(s.orbit.targetX + x, -1.1, 1.1);
      s.orbit.targetY += y;
      redraw();
    };
    const reset = () => { s.orbit.targetX = -0.16; s.orbit.targetY = 0; redraw(); };
    listen(s, s.stage, 'pointerdown', event => {
      if (!s.ready || event.button !== 0 || s.orbit.dragging) return;
      s.orbit.dragging = true; s.orbit.pointerId = event.pointerId;
      s.orbit.lastX = event.clientX; s.orbit.lastY = event.clientY;
      s.stage.setPointerCapture(event.pointerId);
      s.stage.classList.add('is-dragging');
      if (event.pointerType === 'mouse') s.stage.focus({ preventScroll: true });
    });
    listen(s, s.stage, 'pointermove', event => {
      if (!s.orbit.dragging || event.pointerId !== s.orbit.pointerId) return;
      const dx = event.clientX - s.orbit.lastX, dy = event.clientY - s.orbit.lastY;
      s.orbit.lastX = event.clientX; s.orbit.lastY = event.clientY;
      rotate(event.pointerType === 'touch' ? 0 : dy * 0.007, dx * 0.008);
    });
    const endDrag = event => {
      if (event.pointerId !== s.orbit.pointerId) return;
      s.orbit.dragging = false; s.orbit.pointerId = null; s.stage.classList.remove('is-dragging');
      if (s.stage.hasPointerCapture(event.pointerId)) s.stage.releasePointerCapture(event.pointerId);
    };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(event => listen(s, s.stage, event, endDrag));
    listen(s, s.stage, 'keydown', event => {
      const directions = { ArrowLeft: [0,-0.22], ArrowRight: [0,0.22], ArrowUp: [-0.16,0], ArrowDown: [0.16,0] };
      if (directions[event.key]) { event.preventDefault(); rotate(...directions[event.key]); }
      else if (event.key === 'Home') { event.preventDefault(); reset(); }
    });
    document.querySelectorAll('[data-orbit]').forEach(button => listen(s, button, 'click', () => {
      if (button.dataset.orbit === 'left') rotate(0,-0.30);
      if (button.dataset.orbit === 'right') rotate(0,0.30);
      if (button.dataset.orbit === 'reset') reset();
      if (button.dataset.orbit === 'pause') {
        if (s.reduced) { window.dispatchEvent(new CustomEvent('portfolio:enable-motion')); return; }
        s.scenePaused = !s.scenePaused; s.lastTime = null; redraw();
      }
    }));
  }

  async function init(options) {
    if (current && !current.disposed) dispose();
    const s = createState(options || {});
    current = s;
    if (s.mode === 'off') return getStatus();
    s.container = document.getElementById('webgl-container');
    if (!s.container) { s.reason = 'missing-container'; return getStatus(); }
    document.body.classList.add('space-enabled');
    buildHUD(s);
    if (s.mode === 'hero') {
      const hero = document.querySelector('main .hero');
      const stage = document.getElementById('orbital-stage');
      if (stage) s.anchor = stage;
      else if (hero) {
        s.anchor = document.createElement('div'); s.anchor.className = 'space-planet-anchor'; s.anchor.setAttribute('aria-hidden', 'true');
        s.ownsAnchor = true;
        hero.appendChild(s.anchor);
      }
    }
    setupOrbitControls(s);
    measure(s); setupScroll(s); setupWarp(s);
    listen(s, document, 'visibilitychange', () => {
      s.hidden = document.hidden; s.lastTime = null; syncPause(s);
      if (s.hidden && s.warp && s.warp.type === 'out') navigate(s);
    });
    listen(s, window, 'resize', () => {
      measure(s);
      const nowSmall = matchMedia('(max-width: 768px)').matches;
      if (s.mode === 'lite' && nowSmall && s.ready) { releaseGPU(s); fallback(s, 'mobile-lite'); }
      if (nowSmall && !s.compact && s.ready) {
        s.compact = true; s.baseDpr = Math.min(s.baseDpr, CONFIG.pixelRatio.mobile);
        if (s.mode === 'hero') {
          s.baseStars = Math.min(s.baseStars, CONFIG.stars.mobile);
          s.baseAsteroids = Math.min(s.baseAsteroids, CONFIG.asteroids.mobile);
          clearScene(s); buildScene(s);
        }
        applyQuality(s);
      }
      if (s.ready && s.reduced && !s.lost) render(s, performance.now(), 0);
    }, { passive: true });
    listen(s, window, 'pagehide', () => { if (current === s) dispose(); });
    if (window.IntersectionObserver) {
      const observer = new IntersectionObserver(entries => {
        s.inView = entries.some(entry => entry.isIntersecting);
        s.lastTime = null; syncPause(s);
        if (!s.inView && s.warp && s.warp.type === 'out') navigate(s);
      });
      observer.observe(s.container); s.observers.push(observer);
    }
    if (window.ResizeObserver) {
      const observer = new ResizeObserver(() => measure(s));
      observer.observe(document.body); s.observers.push(observer);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!s.disposed) measure(s); });
    if (!s.reduced) {
      const pointer = event => {
        s.pointer.x = clamp(event.clientX / innerWidth * 2 - 1, -1, 1);
        s.pointer.y = clamp(1 - event.clientY / innerHeight * 2, -1, 1);
      };
      listen(s, window, 'pointermove', pointer, { passive: true });
      listen(s, window, 'pointerdown', pointer, { passive: true });
      listen(s, window, 'touchmove', event => { if (event.touches[0]) pointer(event.touches[0]); }, { passive: true });
    }
    if (s.mode === 'lite' && (s.mobile || s.lowEnd)) { fallback(s, s.mobile ? 'mobile-lite' : 'low-end-lite'); return getStatus(); }
    const canvas = document.createElement('canvas');
    canvas.className = 'space-canvas'; canvas.setAttribute('aria-hidden', 'true');
    const attributes = { alpha: true, antialias: false, depth: true, stencil: false, powerPreference: 'low-power' };
    try { s.context = canvas.getContext('webgl2', attributes) || canvas.getContext('webgl', attributes); } catch (_) {}
    if (!s.context) { fallback(s, 'webgl-unavailable'); return getStatus(); }
    s.canvas = canvas;
    try {
      s.THREE = await loadThree();
      if (s.disposed) return getStatus();
      s.renderer = new s.THREE.WebGLRenderer({ canvas, context: s.context, alpha: true, antialias: false });
      s.renderer.setClearColor(0x050810, 0);
      s.container.appendChild(canvas);
      buildScene(s);
      measure(s);
      // Three's own restore handler was registered by the renderer first.
      listenGPU(s, 'webglcontextlost', event => {
        event.preventDefault(); s.lost = true; s.lastTime = null;
        fallback(s, 'context-lost');
      });
      listenGPU(s, 'webglcontextrestored', () => {
        if (s.disposed) return;
        try {
          clearScene(s); buildScene(s); measure(s);
          s.lost = false; s.ready = true; s.reason = 'webgl'; s.lastTime = null; s.restores++;
          s.nextShot = s.elapsed + CONFIG.shootingStar.minDelay;
          document.body.classList.add('space-rendered');
          syncOrbitControls(s);
          render(s, performance.now(), 0);
        } catch (_) { releaseGPU(s); fallback(s, 'restore-failed'); }
      });
      s.ready = true; s.reason = 'webgl';
      if (s.arrived && !s.reduced) {
        s.warp = { type: 'in', start: performance.now(), duration: CONFIG.warp.arrivalMs };
        document.documentElement.classList.add('space-warp-in');
      }
      render(s, performance.now(), 0);
      document.body.classList.add('space-rendered');
      syncOrbitControls(s);
    } catch (_) { releaseGPU(s); fallback(s, 'webgl-unavailable'); }
    return getStatus();
  }
  function update(now) {
    const s = current;
    if (!s || s.disposed) return;
    if (!s.ready || s.reduced || s.lost || s.hidden || !s.inView || s.manualPause || s.scenePaused) { s.lastTime = null; return; }
    const delta = s.lastTime === null ? 0 : Math.max(0, now - s.lastTime);
    s.lastTime = now;
    if (delta > 0) recordFrame(s, delta);
    s.elapsed += delta / 1000;
    render(s, now, Math.min(delta, 50) / 1000);
  }
  function syncPause(s) { document.body.classList.toggle('space-paused', s.hidden || !s.inView || s.manualPause); }
  function pause() { if (current) { current.manualPause = true; current.lastTime = null; syncPause(current); } }
  function resume() { if (current && !current.disposed) { current.manualPause = false; current.lastTime = null; syncPause(current); } }
  function dispose() {
    const s = current;
    if (!s || s.disposed) return;
    s.disposed = true; s.reason = 'disposed'; s.lastTime = null;
    clearWarp(s);
    if (s.scrollTween) { if (s.scrollTween.scrollTrigger) s.scrollTween.scrollTrigger.kill(); s.scrollTween.kill(); s.scrollTween = null; }
    s.listeners.splice(0).forEach(remove => remove());
    s.observers.splice(0).forEach(observer => observer.disconnect());
    releaseGPU(s);
    if (s.hud) s.hud.remove();
    if (s.transition) s.transition.remove();
    if (s.anchor && s.ownsAnchor) s.anchor.remove();
    if (s.stage) { s.stage.classList.remove('is-dragging'); s.stage.removeAttribute('tabindex'); syncOrbitControls(s); }
    s.ownedIds.forEach(element => element.removeAttribute('id'));
    document.body.classList.remove('space-enabled');
  }
  function getStatus() {
    const s = current;
    if (!s) return { mode: 'off', reason: 'not-initialized' };
    return {
      mode: s.mode, reason: s.reason, ready: s.ready, disposed: s.disposed, reducedMotion: s.reduced,
      mobile: s.mobile, lowEnd: s.lowEnd, contextLost: s.lost, contextRestores: s.restores,
      paused: s.hidden || !s.inView || s.manualPause, frames: s.frames, qualityLevel: s.quality,
      pixelRatio: s.renderer ? s.renderer.getPixelRatio() : 0,
      stars: s.stars.map(layer => layer.points.geometry.drawRange.count),
      nebulaPlanes: s.nebula.length, nebulaOctaves: s.nebula[0] ? s.nebula[0].uniforms.uOctaves.value : 0,
      asteroids: s.belt ? s.belt.count : 0, planet: Boolean(s.planet), atmosphere: Boolean(s.planet),
      ring: Boolean(s.ring), galaxy: Boolean(s.galaxy), shootingStarActive: Boolean(s.shooting && s.shooting.visible), shootingStarsEmitted: s.shots,
      pointer: Object.assign({}, s.damped), camera: s.camera ? { x: s.camera.position.x, y: s.camera.position.y, z: s.camera.position.z, fov: s.camera.fov } : null,
      planetBounds: s.planetBounds || null, warp: s.warp ? s.warp.type : null,
      orbitalRings: s.orbitals.length, satellites: s.satellites.length, scenePaused: s.scenePaused,
      corridorRings: s.corridor.length, corridorVisible: s.corridor.some(ring => ring.visible), elapsed: s.elapsed,
      rotation: { x: s.orbit.x, y: s.orbit.y, targetX: s.orbit.targetX, targetY: s.orbit.targetY, dragging: s.orbit.dragging },
      averageFrameMs: mean(s.rolling), qualitySamples: s.history.slice(),
      resources: { geometries: s.geometry.size, materials: s.materials.size, textures: 0, listeners: s.listeners.length + s.gpuListeners.length, observers: s.observers.length },
      hudWaypoints: s.disposed ? 0 : s.sections.length
    };
  }
  window.SpaceFX = Object.freeze({ CONFIG, init, update, pause, resume, dispose, getStatus });
})();
