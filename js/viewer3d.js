// 3D car viewer built with three.js. The body is the 2D side profile extruded to the car's
// width with rounded edges, with wheel arches cut out and glass, wheels, trim and styling
// parts added. Returns null when three.js or WebGL is unavailable, so the app can fall back to 2D.

const VIEWS = {
  '3/4':  { theta: 0.75, phi: 1.2 },
  side:   { theta: Math.PI / 2, phi: 1.45 },
  front:  { theta: 0, phi: 1.35 },
  rear:   { theta: Math.PI, phi: 1.3 },
  top:    { theta: Math.PI / 2, phi: 0.06 },
};

const TINT_GLASS = {
  clear: { color: 0x6f8797, opacity: 0.45 },
  light: { color: 0x1b2632, opacity: 0.78 },
  dark:  { color: 0x040608, opacity: 0.94 },
};

// Styling fields that only change a material, so they don't need the car rebuilt.
const MATERIAL_ONLY = new Set(['color', 'stripeColor', 'rimFinish', 'tint']);

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

  const paintProps = { metalness: 0.35, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.08 };
  const mats = {
    paint: new THREE.MeshPhysicalMaterial({ color: 0xc8341c, ...paintProps }),
    stripe: new THREE.MeshPhysicalMaterial({ color: 0xf2f2f2, ...paintProps, metalness: 0.1 }),
    gloss: new THREE.MeshPhysicalMaterial({ color: 0x0a0a0b, ...paintProps, metalness: 0.2 }),
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
    indicator: new THREE.MeshStandardMaterial({ color: 0x402000, emissive: 0xff8a1a, emissiveIntensity: 1, roughness: 0.3 }),
    mesh: new THREE.MeshStandardMaterial({ map: meshTexture(), metalness: 0.5, roughness: 0.5 }),
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

  // Diamond-mesh pattern for grilles.
  function meshTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    g.fillStyle = '#060607';
    g.fillRect(0, 0, 32, 32);
    g.strokeStyle = '#6a6d72';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, 16); g.lineTo(16, 0); g.lineTo(32, 16); g.lineTo(16, 32); g.closePath();
    g.stroke();
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(14, 2);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
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
  const box = (w, h, dep, material, x, y, z, parent) => add(new THREE.BoxGeometry(w, h, dep), material, x, y, z, parent);

  // A flat strip lying on one edge of the side profile, from z0 to z1 across the car.
  // Used for glass, stripes and roof panels.
  function strip(ax, ay, bx, by, z0, z1, offset, material, inset = 0.06) {
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy);
    let nx = dy / len, ny = -dx / len;
    if (ny < 0) { nx = -nx; ny = -ny; } // always face up and out
    const a = [ax + dx * inset + nx * offset, ay + dy * inset + ny * offset];
    const b = [bx - dx * inset + nx * offset, by - dy * inset + ny * offset];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      a[0], a[1], z0, b[0], b[1], z0, b[0], b[1], z1,
      a[0], a[1], z0, b[0], b[1], z1, a[0], a[1], z1,
    ], 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, material);
    m.material.side = THREE.DoubleSide;
    m.receiveShadow = true;
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
    const open = Boolean(prof.screen);

    // Ride height rises with off-road suspension and drops with stiffer springs.
    const lift = (susp.offroad - 0.5) * 0.06 - (d.stiffness - 50) / 100 * 0.03;
    const sill = Math.max(prof.clearance + lift, wheelR * 0.55);
    const X = (fx) => (fx - 0.5) * L;
    const Y = (fy) => sill + fy * (prof.height + lift - sill);
    const outline = prof.body3d || prof.body;
    const bevelT = 0.2, bevelS = 0.07;
    const depth = W - 2 * bevelT;
    const archR = wheelR * 1.1 + 0.03;

    // Height of the body's top surface at a point along its length, and its slope there.
    function topY(fx) {
      let best = -Infinity;
      for (let i = 0; i < outline.length - 1; i++) {
        const [x0, y0] = outline[i], [x1, y1] = outline[i + 1];
        if (x0 === x1 || fx < Math.min(x0, x1) || fx > Math.max(x0, x1)) continue;
        best = Math.max(best, y0 + ((fx - x0) / (x1 - x0)) * (y1 - y0));
      }
      return Y(best === -Infinity ? 0.5 : best) + bevelS;
    }
    const slope = (fx) => Math.atan2(topY(fx + 0.01) - topY(fx - 0.01), 0.02 * L);
    // A box resting on the top surface, tilted to follow it.
    const onTop = (w, h, dep, material, fx, z, lean = 0) => {
      const m = box(w, h, dep, material, X(fx), topY(fx) + h / 2 - 0.01, z);
      m.rotation.z = slope(fx) + lean;
      return m;
    };

    // --- Body shell: outline over the top, then back along the bottom with arches cut out.
    const shape = new THREE.Shape();
    shape.moveTo(X(outline[0][0]), Y(outline[0][1]));
    for (let i = 1; i < outline.length; i++) shape.lineTo(X(outline[i][0]), Y(outline[i][1]));
    for (const fx of [...prof.wheels].sort((a, b) => b - a)) {
      const dy = sill - wheelR;
      if (Math.abs(dy) >= archR) continue;
      const a0 = Math.asin(dy / archR);
      for (let k = 0; k <= 16; k++) {
        const t = a0 + ((Math.PI - 2 * a0) * k) / 16;
        shape.lineTo(X(fx) + archR * Math.cos(t), wheelR + archR * Math.sin(t));
      }
    }
    const shellGeo = new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: true, bevelThickness: bevelT, bevelSize: bevelS, bevelSegments: 8, curveSegments: 6,
    });
    shellGeo.translate(0, 0, -depth / 2);
    add(shellGeo, mats.paint, 0, 0, 0);

    // --- Glass.
    const glassShape = new THREE.Shape(prof.glass.map(([fx, fy]) => new THREE.Vector2(X(fx), Y(fy))));
    for (const side of [-1, 1]) {
      const m = add(new THREE.ShapeGeometry(glassShape), mats.glass, 0, 0, side * (W / 2 + 0.004));
      m.castShadow = false;
    }
    const glassEdges = new Set();
    for (const key of ['windshield', 'rearWindow']) {
      const idx = prof[key];
      if (!idx) continue;
      glassEdges.add(idx[0]);
      const [a, b] = [outline[idx[0]], outline[idx[1]]];
      strip(X(a[0]), Y(a[1]), X(b[0]), Y(b[1]), -depth / 2 + 0.02, depth / 2 - 0.02, bevelS + 0.006, mats.glass);
    }
    if (open) {
      const [a, b] = prof.screen;
      strip(X(a[0]), Y(a[1]) + bevelS, X(b[0]), Y(b[1]), -W / 2 + 0.12, W / 2 - 0.12, 0, mats.glass);
      box(0.05, 0.04, W - 0.2, mats.trim, X(b[0]), Y(b[1]), 0);
      // Cockpit floor and two seat backs.
      const top = Y(0.7) + bevelS + 0.004;
      const cockpit = add(new THREE.PlaneGeometry(L * 0.28, W - 0.4), mats.dark, X(0.44), top, 0);
      cockpit.rotation.x = -Math.PI / 2;
      for (const side of [-1, 1]) {
        const seat = box(0.12, 0.42, 0.48, mats.trim, X(0.37), top + 0.2, side * 0.36);
        seat.rotation.z = 0.18;
      }
    }
    if (d.body === 'pickup') {
      const bed = add(new THREE.PlaneGeometry(L * 0.34, W - 0.26), mats.dark, X(0.19), Y(0.6) + bevelS + 0.004, 0);
      bed.rotation.x = -Math.PI / 2;
    }

    // Mirrors at the front corner of the side glass.
    const [mfx, mfy] = prof.glass[prof.glass.length - 1];
    for (const side of [-1, 1]) box(0.1, 0.08, 0.14, mats.paint, X(mfx) - 0.06, Y(mfy) + 0.04, side * (W / 2 + 0.07));

    // --- Roof.
    const roofEdge = !open && prof.rearWindow && prof.windshield
      ? [outline[prof.rearWindow[1]], outline[prof.windshield[0]]] : null;
    if (roofEdge) {
      const [[rx0, ry0], [rx1, ry1]] = roofEdge;
      if (d.roof === 'black') {
        strip(X(rx0), Y(ry0), X(rx1), Y(ry1), -depth / 2 - 0.02, depth / 2 + 0.02, bevelS + 0.003, mats.gloss, 0);
      } else if (d.roof === 'sunroof') {
        const mid = (rx0 + rx1) / 2, half = (rx1 - rx0) * 0.22;
        strip(X(mid - half), Y(ry0), X(mid + half), Y(ry1), -0.42, 0.42, bevelS + 0.005, mats.glass, 0);
      } else if (d.roof === 'rack') {
        const len = (rx1 - rx0) * L * 0.9;
        const midX = (rx0 + rx1) / 2;
        for (const side of [-1, 1]) {
          const rail = box(len, 0.04, 0.04, mats.trim, X(midX), topY(midX) + 0.06, side * (depth / 2 - 0.05));
          rail.rotation.z = slope(midX);
          for (const t of [0.1, 0.9]) {
            const fx = rx0 + (rx1 - rx0) * t;
            box(0.04, 0.06, 0.04, mats.trim, X(fx), topY(fx) + 0.03, side * (depth / 2 - 0.05));
          }
        }
        for (const t of [0.25, 0.75]) {
          const fx = rx0 + (rx1 - rx0) * t;
          box(0.05, 0.03, depth - 0.02, mats.trim, X(fx), topY(fx) + 0.085, 0);
        }
      }
    }

    // --- Stripes: twin bands over the painted top surfaces, and/or a band along each flank.
    if (d.stripes === 'twin' || d.stripes === 'both') {
      const cockpit = open ? [0.3, 0.58] : null;
      for (let i = 0; i < outline.length - 1; i++) {
        if (glassEdges.has(i)) continue;
        let [[x0, y0], [x1, y1]] = [outline[i], outline[i + 1]];
        if (x0 === x1) continue;
        const pieces = [[x0, y0, x1, y1]];
        if (cockpit && Math.max(x0, x1) > cockpit[0] && Math.min(x0, x1) < cockpit[1]) {
          // Split the band around an open cockpit.
          pieces.length = 0;
          const yAt = (fx) => y0 + ((fx - x0) / (x1 - x0)) * (y1 - y0);
          if (x0 < cockpit[0]) pieces.push([x0, y0, cockpit[0], yAt(cockpit[0])]);
          if (x1 > cockpit[1]) pieces.push([cockpit[1], yAt(cockpit[1]), x1, y1]);
        }
        for (const [a0, b0, a1, b1] of pieces) {
          for (const side of [-1, 1]) {
            // A small negative inset stretches each piece so neighbouring pieces overlap at corners.
            const segLen = Math.hypot(X(a1) - X(a0), Y(b1) - Y(b0));
            strip(X(a0), Y(b0), X(a1), Y(b1), side * 0.09, side * 0.24, bevelS + 0.007, mats.stripe, -0.04 / segLen);
          }
        }
      }
    }
    if (d.stripes === 'side' || d.stripes === 'both') {
      const beltline = Y(Math.min(...prof.glass.map((p) => p[1])));
      const y = Math.max(beltline - 0.16, wheelR + archR + 0.05);
      let from = null, to = null;
      for (let fx = 0.02; fx <= 0.98; fx += 0.01) {
        if (topY(fx) - bevelS > y + 0.06) { from ??= fx; to = fx; }
      }
      if (from !== null) {
        for (const side of [-1, 1]) {
          const band = add(new THREE.PlaneGeometry((to - from) * L, 0.07), mats.stripe, X((from + to) / 2), y, side * (W / 2 + 0.003));
          band.rotation.y = side < 0 ? Math.PI : 0;
          band.castShadow = false;
        }
      }
    }

    // --- Hood.
    const hoodStart = open ? prof.screen[0][0] : outline[prof.windshield[1]][0];
    const hoodMid = (hoodStart + 0.97) / 2;
    if (d.hood === 'bulge') {
      onTop((0.97 - hoodStart) * L * 0.7, 0.06, 0.62, mats.paint, hoodMid, 0);
    } else if (d.hood === 'scoop') {
      onTop(0.36, 0.1, 0.42, mats.paint, hoodMid, 0);
      const mouth = box(0.02, 0.06, 0.32, mats.dark, X(hoodMid) + 0.185, topY(hoodMid) + 0.06, 0);
      mouth.rotation.z = slope(hoodMid);
    } else if (d.hood === 'vents') {
      for (const side of [-1, 1]) {
        for (let k = 0; k < 4; k++) {
          onTop(0.2, 0.012, 0.025, mats.dark, hoodMid - 0.02, side * (0.28 + k * 0.05));
        }
      }
    }

    // --- Front: lights and grille.
    const frontX = X(1) + bevelS;
    const rearX = X(0) - bevelS;
    for (const side of [-1, 1]) {
      const z = side * (W / 2 - 0.3);
      if (d.headlights === 'square') {
        box(0.06, 0.09, 0.34, mats.head, frontX - 0.01, Y(0.5) - 0.02, z);
      } else if (d.headlights === 'round') {
        const lamp = add(new THREE.CylinderGeometry(0.085, 0.085, 0.06, 24), mats.head, frontX - 0.01, Y(0.48), z);
        lamp.rotation.z = Math.PI / 2;
        const ring = add(new THREE.TorusGeometry(0.088, 0.014, 8, 24), mats.chrome, frontX + 0.02, Y(0.48), z);
        ring.rotation.y = Math.PI / 2;
      } else if (d.headlights === 'slim') {
        box(0.05, 0.045, 0.46, mats.head, frontX - 0.01, Y(0.52), side * (W / 2 - 0.34));
      } else if (d.headlights === 'popup') {
        const fx = 0.93;
        const pod = onTop(0.26, 0.12, 0.36, mats.paint, fx, z);
        const lens = box(0.02, 0.09, 0.3, mats.head, X(fx) + 0.135, topY(fx) + 0.055, z);
        lens.rotation.z = pod.rotation.z;
        box(0.04, 0.03, 0.3, mats.indicator, frontX - 0.005, Y(0.46), z);
      }
      box(0.05, 0.1, 0.36, mats.tail, rearX + 0.01, Y(0.5), side * (W / 2 - 0.26));
    }
    if (d.grille === 'slats') {
      box(0.04, 0.16, W * 0.46, mats.dark, frontX, Y(0.24), 0);
      for (const dy of [-0.05, 0, 0.05]) box(0.012, 0.014, W * 0.44, mats.chrome, frontX + 0.02, Y(0.24) + dy, 0);
    } else if (d.grille === 'mesh') {
      box(0.04, 0.17, W * 0.5, mats.mesh, frontX, Y(0.24), 0);
    } else if (d.grille === 'big') {
      box(0.04, 0.3, W * 0.56, mats.chrome, frontX, Y(0.28), 0);
      box(0.045, 0.24, W * 0.5, mats.dark, frontX + 0.002, Y(0.28), 0);
      for (let k = -3; k <= 3; k++) box(0.012, 0.24, 0.018, mats.chrome, frontX + 0.025, Y(0.28), k * W * 0.07);
    } else {
      box(0.04, 0.06, W * 0.6, mats.dark, frontX, Y(0.1), 0);
    }

    // --- Exhausts, one tip per few cylinders.
    const cyl = LAYOUTS[d.layout].cyl;
    const tips = cyl <= 4 ? [-0.3] : cyl <= 8 ? [-0.3, 0.3] : [-0.34, -0.24, 0.24, 0.34];
    for (const fz of tips) {
      const tip = add(new THREE.CylinderGeometry(0.035, 0.035, 0.14, 16), mats.chrome, rearX - 0.02, Math.max(0.12, sill + 0.04), fz * W);
      tip.rotation.z = Math.PI / 2;
    }

    // --- Spoiler: roof-mounted on hatchbacks, wagons and SUVs, on the boot lid otherwise.
    if (d.spoiler !== 'none') {
      const roofMount = ['hatch', 'wagon', 'suv'].includes(d.body);
      const fx = roofMount ? outline[prof.rearWindow[1]][0] + 0.02 : 0.03;
      const y0 = topY(fx);
      if (d.spoiler === 'lip') {
        const lip = box(0.1, 0.03, W - 0.3, mats.paint, X(fx) - 0.03, y0 + 0.01, 0);
        lip.rotation.z = -0.3;
      } else if (d.spoiler === 'ducktail') {
        const tail = box(0.24, 0.07, W - 0.25, mats.paint, X(fx) + 0.02, y0 + 0.02, 0);
        tail.rotation.z = -0.28;
      } else {
        const big = d.spoiler === 'bigWing';
        const height = (roofMount ? 0.08 : 0.24) + (big ? 0.14 : 0);
        const span = W * (big ? 1.0 : 0.9);
        for (const side of [-1, 1]) box(0.1, height, 0.03, mats.trim, X(fx) + 0.02, y0 + height / 2, side * 0.5);
        const wing = box(big ? 0.4 : 0.32, 0.03, span, mats.trim, X(fx), y0 + height + 0.01, 0);
        wing.rotation.z = -0.12;
        if (big) for (const side of [-1, 1]) box(0.44, 0.16, 0.02, mats.trim, X(fx), y0 + height, side * span / 2);
      }
    }

    // --- Body kit.
    const [rearWheel, frontWheel] = [...prof.wheels].sort((a, b) => a - b);
    if (d.bodykit === 'skirts') {
      const x0 = X(rearWheel) + archR, x1 = X(frontWheel) - archR;
      for (const side of [-1, 1]) box(x1 - x0, 0.07, 0.05, mats.trim, (x0 + x1) / 2, sill - bevelS + 0.03, side * (W / 2 - 0.02));
      box(0.22, 0.025, W * 0.92, mats.trim, frontX - 0.06, sill - bevelS - 0.012, 0);
      box(0.2, 0.06, W * 0.6, mats.trim, rearX + 0.08, sill - bevelS + 0.01, 0);
      for (let k = -2; k <= 2; k++) box(0.2, 0.08, 0.015, mats.trim, rearX + 0.06, sill - bevelS - 0.01, k * W * 0.12);
    } else if (d.bodykit === 'rally') {
      for (const fx of prof.wheels) {
        for (const side of [-1, 1]) box(0.012, 0.24, tireW + 0.06, mats.dark, X(fx) - archR * 0.95, 0.18, side * (W / 2 - tireW / 2));
      }
      for (let k = -1.5; k <= 1.5; k++) {
        const lamp = add(new THREE.CylinderGeometry(0.07, 0.07, 0.07, 20), mats.head, frontX + 0.05, Y(0.34), k * 0.3);
        lamp.rotation.z = Math.PI / 2;
      }
      box(0.03, 0.03, 1.25, mats.trim, frontX + 0.03, Y(0.34) - 0.08, 0);
    }

    // --- Wheels, brakes and the dark wheel wells behind them.
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
        buildRim(wheel, d.wheelStyle, rimR, face, side);
        if (caliperColor && d.wheelStyle !== 'steel' && d.wheelStyle !== 'dish') {
          const disc = add(new THREE.CylinderGeometry(rimR * 0.78, rimR * 0.78, 0.02, 32), mats.disc, 0, 0, face - side * 0.05, wheel);
          disc.rotation.x = Math.PI / 2;
          box(0.1, rimR * 0.55, 0.05, mats.caliper, fx > 0.5 ? -rimR * 0.62 : rimR * 0.62, rimR * 0.2, face - side * 0.04, wheel);
        }
      }
    }

    orbit.target.set(0, prof.height * 0.42, 0);
    orbit.dist = Math.max(6.2, L * 1.6);
  }

  // Rim face for each wheel design, built facing out from the car (z = face).
  function buildRim(wheel, style, rimR, face, side) {
    const disc = (radius, depth, material, z) => {
      const m = add(new THREE.CylinderGeometry(radius, radius, depth, 40), material, 0, 0, z, wheel);
      m.rotation.x = Math.PI / 2;
      return m;
    };
    const spoke = (length, width, x, y, angle, z = face) => {
      const m = box(length, width, 0.025, mats.rim, x, y, z, wheel);
      m.rotation.z = angle;
      return m;
    };
    const lip = add(new THREE.TorusGeometry(rimR - 0.012, 0.014, 8, 40), mats.rim, 0, 0, face, wheel);
    lip.castShadow = false;

    if (style === 'steel' || style === 'dish') {
      disc(rimR - 0.01, 0.02, mats.rim, face - side * 0.005);
      if (style === 'steel') {
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          disc(rimR * 0.1, 0.025, mats.dark, face).position.set(Math.cos(a) * rimR * 0.66, Math.sin(a) * rimR * 0.66, face);
        }
        disc(rimR * 0.45, 0.04, mats.chrome, face + side * 0.01);
      } else {
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          const slot = box(rimR * 0.34, 0.022, 0.03, mats.dark, Math.cos(a) * rimR * 0.62, Math.sin(a) * rimR * 0.62, face, wheel);
          slot.rotation.z = a + 0.35;
        }
        disc(rimR * 0.22, 0.03, mats.rim, face + side * 0.008);
      }
      return;
    }

    disc(rimR, 0.02, mats.dark, face - side * 0.01);
    if (style === 'fiveSpoke' || style === 'multiSpoke') {
      const n = style === 'fiveSpoke' ? 5 : 10;
      const width = style === 'fiveSpoke' ? 0.045 : 0.022;
      for (let s = 0; s < n; s++) {
        const a = (s / n) * Math.PI * 2;
        spoke(rimR * 0.95, width, Math.cos(a) * rimR * 0.47, Math.sin(a) * rimR * 0.47, a);
      }
    } else if (style === 'mesh') {
      // Chords offset from the centre cross each other to form a lattice.
      const offset = rimR * 0.45;
      const length = 2 * Math.sqrt(rimR ** 2 - offset ** 2) * 0.96;
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        spoke(length, 0.012, -Math.sin(a) * offset, Math.cos(a) * offset, a, face + side * (k % 2) * 0.006);
      }
    }
    disc(rimR * 0.18, 0.03, mats.chrome, face);
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
        const dTheta = ((goal.theta - orbit.theta) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
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
      mats.paint.roughness = d.material === 'carbon' ? 0.5 : 0.4;
      mats.stripe.color.set(d.stripeColor).convertSRGBToLinear();
      const finish = RIM_FINISHES[d.rimFinish];
      mats.rim.color.setHex(finish.color).convertSRGBToLinear();
      mats.rim.metalness = finish.metal;
      mats.rim.roughness = finish.rough;
      const tint = TINT_GLASS[d.tint];
      mats.glass.color.setHex(tint.color).convertSRGBToLinear();
      mats.glass.opacity = tint.opacity;

      const key = ['body', 'rim', 'tireWidth', 'suspension', 'stiffness', 'layout', 'brakes', ...Object.keys(STYLE_TABLES)]
        .filter((k) => !MATERIAL_ONLY.has(k))
        .map((k) => d[k]).join('|');
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
