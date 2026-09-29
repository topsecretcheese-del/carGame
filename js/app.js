// UI: design controls, car preview, dyno chart, market fit and garage.

const TABLES = {
  body: BODIES, material: MATERIALS, layout: LAYOUTS, block: BLOCKS, head: HEADS,
  fuel: FUEL_SYSTEMS, aspiration: ASPIRATIONS, gearbox: GEARBOXES, drivetrain: DRIVETRAINS,
  suspension: SUSPENSIONS, tires: TIRES, brakes: BRAKES, interior: INTERIORS, safety: SAFETY,
};

// ---------------------------------------------------------------------------
// Saved state (browser storage can be unavailable, so every access is guarded)

const STORAGE_KEY = 'carBuilder.v1';
function loadStore() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}
function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ current: design, units, garage, tab: activeTab, view: viewMode }));
  } catch { /* storage unavailable; the app still works for this session */ }
}

// Keeps only known fields with valid values, filling the rest from the default design.
function sanitize(d) {
  const out = { ...DEFAULT_DESIGN };
  if (!d || typeof d !== 'object') return out;
  for (const key of Object.keys(DEFAULT_DESIGN)) {
    const v = d[key];
    if (TABLES[key]) { if (v in TABLES[key]) out[key] = v; }
    else if (typeof v === typeof DEFAULT_DESIGN[key]) out[key] = v;
  }
  return out;
}

const stored = loadStore();
let design = sanitize(stored.current);
let units = stored.units === 'imperial' ? 'imperial' : 'metric';
let garage = Array.isArray(stored.garage) ? stored.garage.filter((c) => c && c.design) : [];
let activeTab = stored.tab || 'body';
let result = simulate(design);
let viewMode = stored.view === '2d' ? '2d' : '3d';

// ---------------------------------------------------------------------------
// Unit formatting

const metric = () => units === 'metric';
const fmt = {
  hp: (kw) => Math.round(kw * 1.341),
  torque: (nm) => (metric() ? Math.round(nm) : Math.round(nm * 0.7376)),
  torqueUnit: () => (metric() ? 'Nm' : 'lb-ft'),
  mass: (kg) => (metric() ? Math.round(kg) : Math.round(kg * 2.2046)),
  massUnit: () => (metric() ? 'kg' : 'lb'),
  speed: (ms) => (metric() ? Math.round(ms * 3.6) : Math.round(ms * 2.2369)),
  speedUnit: () => (metric() ? 'km/h' : 'mph'),
  money: (n) => '$' + Math.round(n).toLocaleString('en-US'),
};

// ---------------------------------------------------------------------------
// Control definitions, grouped into tabs

const select = (key, label, extra = {}) => ({ type: 'select', key, label, ...extra });
const range = (key, label, min, max, step, format, extra = {}) => ({ type: 'range', key, label, min, max, step, format, ...extra });

const TABS = [
  { id: 'body', label: 'Body', controls: [
    select('body', 'Body style', { hint: (d) => `${BODIES[d.body].seats} seats · drag coefficient ${BODIES[d.body].cd.toFixed(2)}` }),
    select('material', 'Chassis material', { hint: () => 'Lighter materials cost more but help every performance figure.' }),
    { type: 'color', key: 'color', label: 'Paint' },
  ] },
  { id: 'engine', label: 'Engine', controls: [
    select('layout', 'Cylinder layout'),
    select('block', 'Block material'),
    select('head', 'Valvetrain', { hint: (d) => `Valvetrain rev ceiling about ${HEADS[d.head].rpm.toLocaleString()} rpm.` }),
    select('fuel', 'Fuel system'),
    select('aspiration', 'Aspiration'),
    range('boost', 'Boost pressure', 0.2, 1.8, 0.05,
      (v) => (metric() ? `${v.toFixed(2)} bar` : `${(v * 14.5).toFixed(1)} psi`),
      { show: (d) => d.aspiration !== 'na' }),
    range('bore', 'Bore', 60, 108, 1, (v) => `${v} mm`),
    range('stroke', 'Stroke', 55, 110, 1, (v) => `${v} mm`,
      { hint: (d, r) => `Displacement ${r.engine.displacement.toFixed(2)} L. Short strokes rev higher; long strokes make low-end torque.` }),
    range('compression', 'Compression ratio', 7.5, 13.5, 0.1, (v) => `${v.toFixed(1)}:1`,
      { hint: () => 'Higher is more efficient, until the engine starts to knock.' }),
    range('cam', 'Cam profile', 0, 100, 1, (v) => `${v}`, { ends: ['Mild, torquey', 'Wild, peaky'] }),
    range('revLimit', 'Rev limit', 4000, 10000, 100, (v) => `${v.toLocaleString()} rpm`,
      { hint: (d, r) => `Safe limit for this build: ${(Math.floor(r.engine.safeRpm / 100) * 100).toLocaleString()} rpm.` }),
  ] },
  { id: 'drivetrain', label: 'Drivetrain', controls: [
    select('drivetrain', 'Driven wheels'),
    select('gearbox', 'Gearbox', { hint: (d, r) => 'Ratios: ' + r.ratios.map((g) => g.toFixed(2)).join(' · ') }),
    range('finalDrive', 'Final drive', 2.5, 5.0, 0.05, (v) => `${v.toFixed(2)}:1`,
      { ends: ['Tall: top speed, economy', 'Short: acceleration'],
        hint: (d, r) => `Top gear at ${metric() ? '100 km/h' : '62 mph'}: ${Math.round((100 / 3.6 / r.wheelRadius) * r.ratios[r.ratios.length - 1] * d.finalDrive * 60 / (2 * Math.PI)).toLocaleString()} rpm.` }),
  ] },
  { id: 'chassis', label: 'Chassis', controls: [
    select('suspension', 'Suspension'),
    range('stiffness', 'Spring & damper rate', 0, 100, 1, (v) => `${v}`, { ends: ['Soft, comfortable', 'Stiff, sharp'] }),
    select('tires', 'Tyre compound'),
    range('tireWidth', 'Tyre width', 155, 335, 10, (v) => `${v} mm`),
    range('rim', 'Wheel size', 13, 21, 1, (v) => `${v} in`),
    select('brakes', 'Brakes'),
  ] },
  { id: 'interior', label: 'Interior', controls: [
    select('interior', 'Interior trim'),
    select('safety', 'Safety equipment'),
  ] },
];

// ---------------------------------------------------------------------------
// DOM

const $ = (id) => document.getElementById(id);
const els = {
  name: $('car-name'), price: $('price'), save: $('save'), reset: $('reset'),
  metric: $('units-metric'), imperial: $('units-imperial'),
  tabs: $('tabs'), panel: $('panel'), figures: $('figures'), warnings: $('warnings'),
  summary: $('engine-summary'), segments: $('segments'), ratings: $('ratings'),
  garage: $('garage-list'), preview: $('preview'), viewer: $('viewer'), viewButtons: $('view-buttons'),
  autoRotate: $('auto-rotate'), viewModeBtn: $('view-mode'), viewerHint: $('viewer-hint'), dyno: $('dyno'), torqueLegend: $('torque-legend'),
};
let panelControls = [];

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  Object.assign(el, props);
  for (const c of children) if (c != null) el.append(c);
  return el;
}

function buildTabs() {
  els.tabs.replaceChildren(...TABS.map((t) => {
    const b = h('button', { type: 'button', textContent: t.label, id: `tab-${t.id}` });
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(t.id === activeTab));
    b.addEventListener('click', () => {
      activeTab = t.id;
      buildTabs();
      buildPanel();
      persist();
    });
    return b;
  }));
}

function buildPanel() {
  const tab = TABS.find((t) => t.id === activeTab) || TABS[0];
  activeTab = tab.id;
  panelControls = tab.controls.map((c) => {
    const id = `ctl-${c.key}`;
    const output = c.type === 'range' ? h('output', { htmlFor: id }) : null;
    const label = h('label', { htmlFor: id }, h('span', { textContent: c.label }), output);
    let input;
    if (c.type === 'select') {
      input = h('select', { id });
      for (const [value, part] of Object.entries(TABLES[c.key])) input.append(h('option', { value, textContent: part.name }));
    } else if (c.type === 'range') {
      input = h('input', { id, type: 'range', min: c.min, max: c.max, step: c.step });
    } else {
      input = h('input', { id, type: 'color' });
    }
    input.addEventListener('input', () => {
      design[c.key] = c.type === 'range' ? Number(input.value) : input.value;
      refresh();
    });
    const ends = c.ends ? h('div', { className: 'ends' }, h('span', { textContent: c.ends[0] }), h('span', { textContent: c.ends[1] })) : null;
    const hint = h('div', { className: 'hint' });
    const wrap = h('div', { className: 'control' }, label, input, ends, hint);
    return { def: c, wrap, input, output, hint };
  });
  els.panel.replaceChildren(...panelControls.map((p) => p.wrap));
  syncPanel();
}

function syncPanel() {
  for (const { def, wrap, input, output, hint } of panelControls) {
    wrap.hidden = def.show ? !def.show(design) : false;
    if (input.value !== String(design[def.key])) input.value = design[def.key];
    if (output) output.textContent = def.format(design[def.key]);
    const text = def.hint ? def.hint(design, result) : '';
    hint.textContent = text;
    hint.hidden = !text;
  }
}

// ---------------------------------------------------------------------------
// Readouts

function renderFigures() {
  const r = result, e = r.engine;
  const m = metric();
  const accel = m ? r.t100 : r.t60;
  const braking = m ? r.braking100 : ((26.82 ** 2) / (2 * r.brakeG * 9.81)) * 3.281;
  const figures = [
    ['Power', fmt.hp(e.peakPower), 'hp'],
    ['Torque', fmt.torque(e.peakTorque), fmt.torqueUnit()],
    ['Weight', fmt.mass(r.mass).toLocaleString(), fmt.massUnit()],
    [m ? '0–100 km/h' : '0–60 mph', accel ? accel.toFixed(1) : '—', 's'],
    ['Quarter mile', r.tQuarter ? r.tQuarter.toFixed(1) : '—', 's'],
    ['Top speed', fmt.speed(r.topSpeed), fmt.speedUnit()],
    ['Cornering', r.lateralG.toFixed(2), 'g'],
    [m ? 'Brake 100–0' : 'Brake 60–0', Math.round(braking), m ? 'm' : 'ft'],
    ['Fuel use', m ? r.economy.toFixed(1) : (235.2 / r.economy).toFixed(1), m ? 'L/100km' : 'mpg'],
    ['Build cost', fmt.money(r.cost), ''],
  ];
  els.figures.replaceChildren(...figures.map(([label, value, unit]) =>
    h('div', {}, h('dt', { textContent: label }), h('dd', {}, String(value), unit ? h('small', { textContent: unit }) : null))));

  const layout = LAYOUTS[design.layout];
  const asp = { na: '', turbo: ' turbo', twin: ' twin-turbo' }[design.aspiration];
  els.summary.textContent =
    `${e.displacement.toFixed(1)} L ${layout.name}${asp} ${HEADS[design.head].name.split(' ')[0]} · ` +
    `${fmt.hp(e.peakPower)} hp @ ${e.peakPowerRpm.toLocaleString()} rpm · ` +
    `${fmt.torque(e.peakTorque)} ${fmt.torqueUnit()} @ ${e.peakTorqueRpm.toLocaleString()} rpm · ` +
    `${GEARBOXES[design.gearbox].name}, ${DRIVETRAINS[design.drivetrain].name.toLowerCase()}`;

  const warnings = [...e.warnings];
  if (r.topRpm >= e.revLimit * 0.97) warnings.push('Top speed is capped by the rev limiter in top gear. A taller (lower) final drive would go faster.');
  if (design.drivetrain === 'fwd' && fmt.hp(e.peakPower) > 300) warnings.push('The front wheels struggle to put this much power down. Consider rear- or all-wheel drive.');
  if (r.brakeG < r.lateralG * 0.85) warnings.push('The brakes are weak for this much grip. Upgrade them to stop shorter.');
  els.warnings.replaceChildren(...warnings.map((w) => h('li', { textContent: w })));

  els.price.textContent = fmt.money(r.price);
  els.torqueLegend.textContent = `Torque (${fmt.torqueUnit()})`;
}

function meter(name, value, kind, verdict) {
  const fill = h('div', { className: `fill ${kind}` });
  fill.style.width = `${Math.round(value)}%`;
  const row = h('div', { className: 'meter' },
    h('span', { className: 'name', textContent: name }),
    h('div', { className: 'bar' }, fill),
    h('span', { className: 'val', textContent: Math.round(value) }));
  if (verdict) row.append(h('span', { className: 'verdict', textContent: verdict }));
  return row;
}
const band = (v) => (v >= 70 ? 'good' : v >= 45 ? 'mid' : 'low');

function renderMarket() {
  const segs = Object.entries(result.segments);
  const best = segs.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  els.segments.replaceChildren(...segs.map(([key, v]) => {
    const verdict = key === best ? 'Best fit for this car' : v >= 70 ? 'Strong seller' : v >= 55 ? 'Some interest' : 'Buyers will pass';
    return meter(SEGMENTS[key].name, v, band(v), verdict);
  }));
  const names = {
    performance: 'Performance', handling: 'Handling', comfort: 'Comfort', economy: 'Economy',
    practicality: 'Practicality', reliability: 'Reliability', safety: 'Safety', prestige: 'Prestige',
    utility: 'Utility', affordability: 'Affordability',
  };
  els.ratings.replaceChildren(...Object.entries(result.ratings).map(([k, v]) => meter(names[k], v, 'plain')));
}

function renderGarage() {
  if (!garage.length) {
    els.garage.replaceChildren(h('li', { className: 'empty', textContent: 'No saved cars yet. Press "Save to garage" to keep this design and compare it later.' }));
    return;
  }
  els.garage.replaceChildren(...garage.map((car, i) => {
    const r = simulate(sanitize(car.design));
    const accel = metric() ? r.t100 : r.t60;
    const dot = h('span', { className: 'dot' });
    dot.style.background = car.design.color;
    const load = h('button', { type: 'button', textContent: 'Load' });
    load.addEventListener('click', () => {
      design = sanitize(car.design);
      els.name.value = design.name;
      buildPanel();
      refresh();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    const del = h('button', { type: 'button', textContent: 'Delete' });
    del.addEventListener('click', () => {
      garage.splice(i, 1);
      persist();
      renderGarage();
    });
    return h('li', {},
      dot,
      h('span', { className: 'gname', textContent: car.design.name || 'Unnamed' }),
      h('span', { className: 'gstats', textContent:
        `${fmt.hp(r.engine.peakPower)} hp · ${accel ? accel.toFixed(1) : '—'} s ${metric() ? '0–100' : '0–60'} · ` +
        `${fmt.speed(r.topSpeed)} ${fmt.speedUnit()} · ${fmt.money(r.price)}` }),
      h('span', { className: 'gbtns' }, load, del));
  }));
}

// ---------------------------------------------------------------------------
// Canvas drawing

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function drawPreview() {
  const cv = els.preview, ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const body = BODIES[design.body], prof = PROFILES[design.body];
  const ppm = (W - 200) / 5.6; // pixels per metre
  const len = body.length * ppm;
  const x0 = (W - len) / 2;
  const groundY = H - 80;
  const r = result.wheelRadius * ppm;
  const sillY = groundY - Math.max(prof.clearance * ppm, r * 0.55);
  const roofY = groundY - prof.height * ppm;
  const P = ([fx, fy]) => [x0 + fx * len, sillY - fy * (sillY - roofY)];
  const path = (pts) => {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(...P(p)) : ctx.moveTo(...P(p))));
    ctx.closePath();
  };

  ctx.fillStyle = css('--preview-bg');
  ctx.fillRect(0, 0, W, H);

  // Floor grid gives a sense of scale: one tick per metre.
  ctx.strokeStyle = css('--ground');
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 2;
  for (let m = 0; m <= 6; m++) {
    const x = (W - 6 * ppm) / 2 + m * ppm;
    ctx.beginPath(); ctx.moveTo(x, groundY); ctx.lineTo(x, groundY + 14); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Shadow.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.beginPath();
  ctx.ellipse(x0 + len / 2, groundY + 4, len * 0.55, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body with a shaded lower half.
  path(prof.body);
  ctx.fillStyle = design.color;
  ctx.fill();
  ctx.save();
  ctx.clip();
  const shade = ctx.createLinearGradient(0, roofY, 0, sillY);
  shade.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
  shade.addColorStop(0.55, 'rgba(255, 255, 255, 0)');
  shade.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, roofY, W, sillY - roofY);
  if (design.material === 'carbon') {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.lineWidth = 2;
    for (let x = -H; x < W; x += 12) { ctx.beginPath(); ctx.moveTo(x, sillY); ctx.lineTo(x + H, sillY - H); ctx.stroke(); }
  }
  ctx.restore();

  // Glass and door line.
  path(prof.glass);
  ctx.fillStyle = 'rgba(28, 40, 54, 0.85)';
  ctx.fill();
  const [gx0] = P(prof.glass[0]), [gx1] = P(prof.glass[prof.glass.length - 1]);
  const doorX = (gx0 + gx1) / 2;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(doorX, P(prof.glass[0])[1]);
  ctx.lineTo(doorX, sillY - 6);
  ctx.stroke();

  // Lights.
  const [hx, hy] = P([0.985, 0.5]);
  ctx.fillStyle = '#fff1bf';
  ctx.beginPath(); ctx.ellipse(hx, hy, 9, 12, 0, 0, Math.PI * 2); ctx.fill();
  const [tx, ty] = P([0.01, 0.55]);
  ctx.fillStyle = '#d2261a';
  ctx.fillRect(tx - 3, ty - 12, 10, 24);

  // Rear wing for cars on semi-slicks.
  if (design.tires === 'semi' && design.body !== 'pickup') {
    const [wx, wy] = P([0.03, prof.body[1][1] + 0.04]);
    ctx.fillStyle = css('--ink');
    ctx.fillRect(wx + 18, wy - 34, 6, 34);
    ctx.fillRect(wx - 10, wy - 40, 90, 9);
  }

  // Wheel arches, then wheels.
  for (const fx of prof.wheels) {
    const cx = x0 + fx * len;
    ctx.fillStyle = css('--preview-bg');
    ctx.beginPath(); ctx.arc(cx, groundY - r, r * 1.14, Math.PI, 0); ctx.fill();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath(); ctx.arc(cx, groundY - r, r * 1.14, Math.PI, 0); ctx.fill();
  }
  ctx.strokeStyle = css('--ground');
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(40, groundY); ctx.lineTo(W - 40, groundY); ctx.stroke();

  const rimR = design.rim * 0.0127 * ppm;
  for (const fx of prof.wheels) {
    const cx = x0 + fx * len, cy = groundY - r;
    ctx.fillStyle = '#1c1d20';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b9bec5';
    ctx.beginPath(); ctx.arc(cx, cy, rimR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#7d838b';
    ctx.lineWidth = rimR * 0.18;
    for (let s = 0; s < 5; s++) {
      const a = (s / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * rimR * 0.85, cy + Math.sin(a) * rimR * 0.85);
      ctx.stroke();
    }
    ctx.fillStyle = '#4b5058';
    ctx.beginPath(); ctx.arc(cx, cy, rimR * 0.2, 0, Math.PI * 2); ctx.fill();
  }

  // Caption.
  ctx.fillStyle = css('--muted');
  ctx.font = '500 22px "IBM Plex Mono", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const lengthText = metric() ? `${body.length.toFixed(2)} m` : `${(body.length * 3.281).toFixed(1)} ft`;
  ctx.fillText(`${body.name.toUpperCase()} · ${MATERIALS[design.material].name.toLowerCase()} · ${lengthText} long`, 40, 44);
}

function niceMax(v) {
  const raw = v / 5;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw);
  return step * 5;
}

function drawDyno() {
  const cv = els.dyno, ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const L = 90, R = 90, T = 24, B = 64;
  const e = result.engine;
  const curve = e.curve;
  const hpMax = niceMax(Math.max(...curve.map((p) => fmt.hp(p.power))) * 1.05);
  const tqMax = niceMax(Math.max(...curve.map((p) => fmt.torque(p.torque))) * 1.05);
  const rpmMax = Math.ceil(e.revLimit / 1000) * 1000;
  const X = (rpm) => L + (rpm / rpmMax) * (W - L - R);
  const Yp = (hp) => H - B - (hp / hpMax) * (H - T - B);
  const Yt = (tq) => H - B - (tq / tqMax) * (H - T - B);

  const ink = css('--ink'), muted = css('--muted'), line = css('--line');
  const power = css('--accent'), torque = css('--torque'), bad = css('--bad');
  ctx.clearRect(0, 0, W, H);
  ctx.font = '400 20px "IBM Plex Mono", monospace';
  ctx.lineWidth = 1.5;

  // Grid and axis labels.
  ctx.strokeStyle = line;
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 5; i++) {
    const y = H - B - (i / 5) * (H - T - B);
    ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(W - R, y); ctx.stroke();
    ctx.fillStyle = power; ctx.textAlign = 'right';
    ctx.fillText(Math.round((hpMax * i) / 5), L - 12, y);
    ctx.fillStyle = torque; ctx.textAlign = 'left';
    ctx.fillText(Math.round((tqMax * i) / 5), W - R + 12, y);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = muted;
  for (let rpm = 0; rpm <= rpmMax; rpm += 1000) {
    const x = X(rpm);
    ctx.strokeStyle = line;
    ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, H - B); ctx.stroke();
    ctx.fillText(rpm / 1000, x, H - B + 12);
  }
  ctx.fillText('rpm × 1000', (L + W - R) / 2, H - B + 38);

  // Safe-rev line, if the limit is set beyond it.
  if (e.safeRpm < e.revLimit) {
    ctx.strokeStyle = bad;
    ctx.setLineDash([8, 8]);
    ctx.beginPath(); ctx.moveTo(X(e.safeRpm), T); ctx.lineTo(X(e.safeRpm), H - B); ctx.stroke();
    ctx.setLineDash([]);
  }

  const plot = (color, y) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    curve.forEach((p, i) => (i ? ctx.lineTo(X(p.rpm), y(p)) : ctx.moveTo(X(p.rpm), y(p))));
    ctx.stroke();
  };
  plot(torque, (p) => Yt(fmt.torque(p.torque)));
  plot(power, (p) => Yp(fmt.hp(p.power)));

  // Peak markers.
  const mark = (color, x, y, text, above) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ink;
    ctx.font = '500 20px "IBM Plex Mono", monospace';
    ctx.textAlign = x > W - R - 160 ? 'right' : 'center';
    ctx.textBaseline = above ? 'bottom' : 'top';
    ctx.fillText(text, x, y + (above ? -12 : 12));
  };
  mark(power, X(e.peakPowerRpm), Yp(fmt.hp(e.peakPower)), `${fmt.hp(e.peakPower)} hp`, Yp(fmt.hp(e.peakPower)) > T + 40);
  mark(torque, X(e.peakTorqueRpm), Yt(fmt.torque(e.peakTorque)), `${fmt.torque(e.peakTorque)} ${fmt.torqueUnit()}`,
    Yt(fmt.torque(e.peakTorque)) > T + 40 && Math.abs(Yt(fmt.torque(e.peakTorque)) - Yp(fmt.hp(e.peakPower))) > 40);
}

// ---------------------------------------------------------------------------
// Wiring

// ---------------------------------------------------------------------------
// Preview: 3D viewer when available, otherwise the 2D side drawing

const viewer = typeof createViewer === 'function' ? createViewer(els.viewer) : null;
if (!viewer) viewMode = '2d';

function renderPreview() {
  if (viewMode === '3d') viewer.update(design, result);
  else drawPreview();
}

function setViewMode(mode) {
  viewMode = viewer ? mode : '2d';
  const is3d = viewMode === '3d';
  els.preview.hidden = is3d;
  if (viewer) viewer.canvas.hidden = !is3d;
  els.viewButtons.hidden = !is3d;
  els.autoRotate.parentElement.hidden = !is3d;
  els.viewerHint.hidden = !is3d;
  els.viewModeBtn.hidden = !viewer;
  els.viewModeBtn.textContent = is3d ? '2D drawing' : '3D view';
  renderPreview();
  if (viewer && is3d) viewer.resize();
  persist();
}

if (viewer) {
  const labels = { '3/4': '¾', side: 'Side', front: 'Front', rear: 'Rear', top: 'Top' };
  els.viewButtons.replaceChildren(...Object.keys(VIEWS).map((name) => {
    const b = h('button', { type: 'button', textContent: labels[name], title: `${name === '3/4' ? 'Three-quarter' : labels[name]} view` });
    b.addEventListener('click', () => viewer.setView(name));
    return b;
  }));
  els.autoRotate.checked = viewer.autoRotate;
  els.autoRotate.addEventListener('change', () => viewer.setAutoRotate(els.autoRotate.checked));
  viewer.onAutoRotateChange((on) => { els.autoRotate.checked = on; });
}
els.viewModeBtn.addEventListener('click', () => setViewMode(viewMode === '3d' ? '2d' : '3d'));

function refresh() {
  result = simulate(design);
  renderFigures();
  renderMarket();
  syncPanel();
  renderPreview();
  drawDyno();
  persist();
}

function setUnits(u) {
  units = u;
  els.metric.setAttribute('aria-pressed', String(u === 'metric'));
  els.imperial.setAttribute('aria-pressed', String(u === 'imperial'));
  refresh();
  renderGarage();
}

els.name.value = design.name;
els.name.addEventListener('input', () => {
  design.name = els.name.value;
  persist();
});
els.metric.addEventListener('click', () => setUnits('metric'));
els.imperial.addEventListener('click', () => setUnits('imperial'));
els.reset.addEventListener('click', () => {
  design = { ...DEFAULT_DESIGN };
  els.name.value = design.name;
  buildPanel();
  refresh();
});
els.save.addEventListener('click', () => {
  const name = design.name.trim() || 'Unnamed';
  design.name = name;
  els.name.value = name;
  const existing = garage.findIndex((c) => c.design.name === name);
  const entry = { design: { ...design } };
  if (existing >= 0) garage[existing] = entry;
  else garage.unshift(entry);
  persist();
  renderGarage();
  els.save.textContent = existing >= 0 ? 'Updated' : 'Saved';
  setTimeout(() => { els.save.textContent = 'Save to garage'; }, 1400);
});
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { drawPreview(); drawDyno(); });
new MutationObserver(() => { drawPreview(); drawDyno(); })
  .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
if (document.fonts) document.fonts.ready.then(() => { drawPreview(); drawDyno(); });

buildTabs();
buildPanel();
setViewMode(viewMode);
setUnits(units);
