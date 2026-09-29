// 3D car viewer built with three.js. The body is the 2D side profile extruded to the car's
// width with rounded edges, with wheel arches cut out and glass, wheels and trim added.
// Returns null when three.js or WebGL is unavailable, so the app can fall back to 2D.

const VIEWS = {
  '3/4':  { theta: 0.75, phi: 1.2 },
  side:   { theta: Math.PI / 2, phi: 1.45 },
  front:  { theta: 0, phi: 1.35 },
  rear:   { theta: Math.PI, phi: 1.3 },
  top:    { theta: Math.PI / 2, phi: 0.06 },
};

function createViewer(host) {
  if (!window.THREE) return null;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.className = 'viewer3d';
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Your car in 3D. Drag to rotate, scroll to zoom, arrow keys to turn.');
  host.prepend(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 2, 0.1, 100);

  // Reflections come from a simple studio: a soft grey dome with three light panels.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(buildStudio(), 0.04).texture;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a40, 0.35));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(3, 8, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 64), new THREE.ShadowMaterial({ opacity: 0.28 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const mats = {
    paint: new THREE.MeshPhysicalMaterial({ color: 0xc8341c, metalness: 0.35, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.08 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x0c131b, metalness: 0.3, roughness: 0.04, transparent: true, opacity: 0.88, side: THREE.DoubleSide }),
    tire: new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.92 }),
    rim: new THREE.MeshStandardMaterial({ color: 0xc9cdd3, metalness: 1, roughness: 0.22 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.75 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x1d1f23, metalness: 0.3, roughness: 0.45 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xe8e8e8, metalness: 1, roughness: 0.12 }),
    disc: new THREE.MeshStandardMaterial({ color: 0x6d6f73, metalness: 0.8, roughness: 0.4 }),
    head: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0c8, emissiveIntensity: 1.2, roughness: 0.2 }),
    tail: new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xd0180e, emissiveIntensity: 1.1, roughness: 0.3 }),
    caliper: new THREE.MeshStandardMaterial({ color: 0xc62222, roughness: 0.4 }),
  };

  const car = new THREE.Group();
  scene.add(car);

  // Camera orbit state.
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const orbit = { theta: VIEWS['3/4'].theta, phi: VIEWS['3/4'].phi, dist: 8, target: new THREE.Vector3(0, 0.6, 0) };
  let goal = null; // view being animated to
  let autoRotate = !reduceMotion;
  let dirty = true;
  let geometryKey = '';
  let onAutoRotateChange = () => {};

  function buildStudio() {
    const studio = new THREE.Scene();
    const dome = new THREE.SphereGeometry(20, 32, 16);
    const pos = dome.attributes.position;
    const colors = [];
    for (let i = 0; i < pos.count; i++) {
      const c = new THREE.Color().setHSL(0.6, 0.08, 0.2 + 0.5 * Math.max(0, pos.getY(i) / 20));
      colors.push(c.r, c.g, c.b);
    }
    dome.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    studio.add(new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const panel = (w, h, x, y, z, level) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(level, level, level), side: THREE.DoubleSide }));
      m.position.set(x, y, z);
      m.lookAt(0, 0, 0);
      studio.add(m);
    };
    panel(14, 5, 0, 12, 0, 1.6);
    panel(8, 4, 12, 4, 7, 1.3);
    panel(8, 4, -12, 4, -7, 0.9);
    return studio;
  }

  function clearCar() {
    car.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    car.clear();
  }

  function add(geometry, material, x, y, z, parent = car) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  // A flat quad along one edge of the side profile, spanning the car's width.
  function edgeQuad(ax, ay, bx, by, halfWidth, offset, material) {
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy);
    let nx = dy / len, ny = -dx / len;
    if (ny < 0) { nx = -nx; ny = -ny; } // glass always faces up and out
    const inset = 0.06;
    const a = [ax + dx * inset + nx * offset, ay + dy * inset + ny * offset];
    const b = [bx - dx * inset + nx * offset, by - dy * inset + ny * offset];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      a[0], a[1], -halfWidth, b[0], b[1], -halfWidth, b[0], b[1], halfWidth,
      a[0], a[1], -halfWidth, b[0], b[1], halfWidth, a[0], a[1], halfWidth,
    ], 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, material);
    car.add(m);
    return m;
  }

  function buildCar(d, r) {
    clearCar();
    const body = BODIES[d.body];
    const prof = PROFILES[d.body];
    const susp = SUSPENSIONS[d.suspension];
    const L = body.length;
    const W = prof.width;
    const wheelR = r.wheelRadius;
    const tireW = d.tireWidth / 1000;
    const rimR = d.rim * 0.0127;

    // Ride height rises with off-road suspension and drops with stiffer springs.
    const lift = (susp.offroad - 0.5) * 0.06 - (d.stiffness - 50) / 100 * 0.03;
    const sill = Math.max(prof.clearance + lift, wheelR * 0.55);
    const X = (fx) => (fx - 0.5) * L;
    const Y = (fy) => sill + fy * (prof.height + lift - sill);

    // Body shell: outline over the top, then back along the bottom with arches cut out.
    const outline = prof.body3d || prof.body;
    const shape = new THREE.Shape();
    shape.moveTo(X(outline[0][0]), Y(outline[0][1]));
    for (let i = 1; i < outline.length; i++) shape.lineTo(X(outline[i][0]), Y(outline[i][1]));
    const archR = wheelR * 1.1 + 0.03;
    for (const fx of [...prof.wheels].sort((a, b) => b - a)) {
      const dy = sill - wheelR;
      if (Math.abs(dy) >= archR) continue;
      const a0 = Math.asin(dy / archR);
      for (let k = 0; k <= 16; k++) {
        const t = a0 + ((Math.PI - 2 * a0) * k) / 16;
        shape.lineTo(X(fx) + archR * Math.cos(t), wheelR + archR * Math.sin(t));
      }
    }
    const bevelT = 0.2, bevelS = 0.07;
    const depth = W - 2 * bevelT;
    const shellGeo = new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: true, bevelThickness: bevelT, bevelSize: bevelS, bevelSegments: 8, curveSegments: 6,
    });
    shellGeo.translate(0, 0, -depth / 2);
    add(shellGeo, mats.paint, 0, 0, 0);

    // Side windows sit just proud of the flanks; the windscreen and rear window follow the roof line.
    const glassShape = new THREE.Shape(prof.glass.map(([fx, fy]) => new THREE.Vector2(X(fx), Y(fy))));
    for (const side of [-1, 1]) {
      const g = new THREE.ShapeGeometry(glassShape);
      const m = add(g, mats.glass, 0, 0, side * (W / 2 + 0.004));
      m.castShadow = false;
    }
    for (const key of ['windshield', 'rearWindow']) {
      const idx = prof[key];
      if (!idx) continue;
      const [a, b] = [outline[idx[0]], outline[idx[1]]];
      edgeQuad(X(a[0]), Y(a[1]), X(b[0]), Y(b[1]), depth / 2 - 0.02, bevelS + 0.006, mats.glass);
    }
    if (prof.screen) {
      const [a, b] = prof.screen;
      edgeQuad(X(a[0]), Y(a[1]) + bevelS, X(b[0]), Y(b[1]), W / 2 - 0.12, 0, mats.glass);
      add(new THREE.BoxGeometry(0.05, 0.04, W - 0.2), mats.trim, X(b[0]), Y(b[1]), 0);
      // Cockpit floor and two seat backs.
      const top = Y(0.7) + bevelS + 0.004;
      const cockpit = add(new THREE.PlaneGeometry(L * 0.28, W - 0.4), mats.dark, X(0.44), top, 0);
      cockpit.rotation.x = -Math.PI / 2;
      for (const side of [-1, 1]) {
        const seat = add(new THREE.BoxGeometry(0.12, 0.42, 0.48), mats.trim, X(0.37), top + 0.2, side * 0.36);
        seat.rotation.z = 0.18;
      }
    }
    if (d.body === 'pickup') {
      const bed = add(new THREE.PlaneGeometry(L * 0.34, W - 0.26), mats.dark, X(0.19), Y(0.6) + bevelS + 0.004, 0);
      bed.rotation.x = -Math.PI / 2;
    }

    // Mirrors at the front corner of the side glass.
    const [mfx, mfy] = prof.glass[prof.glass.length - 1];
    for (const side of [-1, 1]) {
      add(new THREE.BoxGeometry(0.1, 0.08, 0.14), mats.paint, X(mfx) - 0.06, Y(mfy) + 0.04, side * (W / 2 + 0.07));
    }

    // Lights, grille and exhausts.
    const frontX = X(1) + bevelS;
    const rearX = X(0) - bevelS;
    for (const side of [-1, 1]) {
      add(new THREE.BoxGeometry(0.06, 0.09, 0.34), mats.head, frontX - 0.01, Y(0.5) - 0.02, side * (W / 2 - 0.3));
      add(new THREE.BoxGeometry(0.05, 0.1, 0.36), mats.tail, rearX + 0.01, Y(0.5), side * (W / 2 - 0.26));
    }
    add(new THREE.BoxGeometry(0.04, 0.16, W * 0.46), mats.trim, frontX, Y(0.24), 0);
    const cyl = LAYOUTS[d.layout].cyl;
    const tips = cyl <= 4 ? [-0.3] : cyl <= 8 ? [-0.3, 0.3] : [-0.34, -0.24, 0.24, 0.34];
    for (const fz of tips) {
      const tip = add(new THREE.CylinderGeometry(0.035, 0.035, 0.14, 16), mats.chrome, rearX - 0.02, Math.max(0.12, sill + 0.04), fz * W);
      tip.rotation.z = Math.PI / 2;
    }

    // Rear wing for cars on semi-slick tyres.
    if (d.tires === 'semi' && d.body !== 'pickup') {
      const y0 = Y(outline[1][1]) + bevelS;
      for (const side of [-1, 1]) add(new THREE.BoxGeometry(0.1, 0.26, 0.03), mats.trim, X(0.05), y0 + 0.13, side * 0.5);
      const wing = add(new THREE.BoxGeometry(0.34, 0.03, W * 0.92), mats.trim, X(0.04), y0 + 0.27, 0);
      wing.rotation.z = 0.12;
    }

    // Wheels, brakes and the dark wheel wells behind them.
    const caliperColor = { ceramic: 0xf2c200, vented: 0xc62222, disc: 0x55585d, discdrum: 0x55585d }[d.brakes];
    if (caliperColor) mats.caliper.color.setHex(caliperColor);
    const trackZ = W / 2 - tireW / 2 + 0.02;
    for (const fx of prof.wheels) {
      const well = add(new THREE.CylinderGeometry(archR * 0.97, archR * 0.97, W - 0.12, 24), mats.dark, X(fx), wheelR, 0);
      well.rotation.x = Math.PI / 2;
      well.castShadow = false;
      for (const side of [-1, 1]) {
        const wheel = new THREE.Group();
        wheel.position.set(X(fx), wheelR, side * trackZ);
        car.add(wheel);
        const tire = add(new THREE.CylinderGeometry(wheelR, wheelR, tireW, 40), mats.tire, 0, 0, 0, wheel);
        tire.rotation.x = Math.PI / 2;
        const face = side * (tireW / 2 + 0.002);
        const rimDisc = add(new THREE.CylinderGeometry(rimR, rimR, 0.02, 40), mats.dark, 0, 0, face - side * 0.01, wheel);
        rimDisc.rotation.x = Math.PI / 2;
        const lip = add(new THREE.TorusGeometry(rimR - 0.012, 0.014, 8, 40), mats.rim, 0, 0, face, wheel);
        lip.castShadow = false;
        for (let s = 0; s < 5; s++) {
          const spoke = add(new THREE.BoxGeometry(rimR * 0.95, 0.045, 0.025), mats.rim, 0, 0, face, wheel);
          const a = (s / 5) * Math.PI * 2;
          spoke.rotation.z = a;
          spoke.position.x = Math.cos(a) * rimR * 0.47;
          spoke.position.y = Math.sin(a) * rimR * 0.47;
        }
        const hub = add(new THREE.CylinderGeometry(rimR * 0.18, rimR * 0.18, 0.03, 20), mats.chrome, 0, 0, face, wheel);
        hub.rotation.x = Math.PI / 2;
        if (caliperColor) {
          const disc = add(new THREE.CylinderGeometry(rimR * 0.78, rimR * 0.78, 0.02, 32), mats.disc, 0, 0, face - side * 0.05, wheel);
          disc.rotation.x = Math.PI / 2;
          add(new THREE.BoxGeometry(0.1, rimR * 0.55, 0.05), mats.caliper,
            fx > 0.5 ? -rimR * 0.62 : rimR * 0.62, rimR * 0.2, face - side * 0.04, wheel);
        }
      }
    }

    orbit.target.set(0, prof.height * 0.42, 0);
    orbit.dist = Math.max(6.2, L * 1.6);
    sun.shadow.camera.updateProjectionMatrix();
  }

  // --- Camera control -------------------------------------------------------

  function placeCamera() {
    const { theta, phi, dist, target } = orbit;
    camera.position.set(
      target.x + dist * Math.sin(phi) * Math.cos(theta),
      target.y + dist * Math.cos(phi),
      target.z + dist * Math.sin(phi) * Math.sin(theta));
    camera.lookAt(target);
  }

  function stopAutoRotate() {
    if (autoRotate) {
      autoRotate = false;
      onAutoRotateChange(false);
    }
  }

  const pointers = new Map();
  let pinchDist = 0;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    goal = null;
    stopAutoRotate();
  });
  canvas.addEventListener('pointermove', (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    if (pointers.size === 1) {
      orbit.theta += (e.clientX - prev.x) * 0.008;
      orbit.phi = Math.min(1.52, Math.max(0.06, orbit.phi - (e.clientY - prev.y) * 0.006));
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist) zoom(pinchDist / dist);
      pinchDist = dist;
    }
    dirty = true;
  });
  const release = (e) => {
    pointers.delete(e.pointerId);
    pinchDist = 0;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoom(1 + Math.sign(e.deltaY) * 0.08);
  }, { passive: false });
  canvas.addEventListener('keydown', (e) => {
    const step = { ArrowLeft: [-0.15, 0], ArrowRight: [0.15, 0], ArrowUp: [0, -0.08], ArrowDown: [0, 0.08] }[e.key];
    if (!step) return;
    e.preventDefault();
    stopAutoRotate();
    goal = null;
    orbit.theta += step[0];
    orbit.phi = Math.min(1.52, Math.max(0.06, orbit.phi + step[1]));
    dirty = true;
  });

  function zoom(factor) {
    orbit.dist = Math.min(16, Math.max(3.5, orbit.dist * factor));
    dirty = true;
  }

  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    dirty = true;
  }
  new ResizeObserver(resize).observe(host);

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!canvas.hidden) {
      if (autoRotate) { orbit.theta += dt * 0.3; dirty = true; }
      if (goal) {
        // Take the short way round to the requested view.
        let dTheta = ((goal.theta - orbit.theta) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        const k = 1 - Math.exp(-dt * 7);
        orbit.theta += dTheta * k;
        orbit.phi += (goal.phi - orbit.phi) * k;
        if (Math.abs(dTheta) < 0.002 && Math.abs(goal.phi - orbit.phi) < 0.002) goal = null;
        dirty = true;
      }
      if (dirty) {
        placeCamera();
        renderer.render(scene, camera);
        dirty = false;
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    canvas,
    update(d, r) {
      mats.paint.color.set(d.color).convertSRGBToLinear();
      mats.paint.roughness = d.material === 'carbon' ? 0.5 : 0.35;
      const key = [d.body, d.rim, d.tireWidth, d.tires, d.suspension, d.stiffness, d.layout, d.brakes].join('|');
      if (key !== geometryKey) {
        geometryKey = key;
        buildCar(d, r);
      }
      dirty = true;
    },
    setView(name) {
      if (!VIEWS[name]) return;
      goal = VIEWS[name];
      stopAutoRotate();
    },
    setAutoRotate(on) {
      autoRotate = on;
      goal = null;
      dirty = true;
    },
    get autoRotate() { return autoRotate; },
    onAutoRotateChange(fn) { onAutoRotateChange = fn; },
    resize,
  };
}
