// Turns a design into engine curves, performance figures and market ratings.

const G = 9.81;
const AIR_DENSITY = 1.2;
const PETROL_MJ_PER_L = 34.2;
const MAX_PISTON_SPEED = 22; // m/s mean piston speed before reliability suffers

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// Maps x onto 0-100, where `worst` scores 0 and `best` scores 100 (either order).
const score = (x, worst, best) => clamp(((x - worst) / (best - worst)) * 100, 0, 100);

function buildEngine(d) {
  const layout = LAYOUTS[d.layout];
  const head = HEADS[d.head];
  const fuel = FUEL_SYSTEMS[d.fuel];
  const asp = ASPIRATIONS[d.aspiration];
  const block = BLOCKS[d.block];
  const turbo = d.aspiration !== 'na';
  const boost = turbo ? d.boost : 0;
  const cam = d.cam / 100;

  const displacement = (Math.PI / 4) * d.bore ** 2 * d.stroke * layout.cyl / 1e6; // litres
  const safeRpm = Math.min(head.rpm, (MAX_PISTON_SPEED * 60) / (2 * d.stroke / 1000));
  const revLimit = d.revLimit;

  // Hotter cams move peak torque higher and make the torque curve peakier.
  const peakRpm = revLimit * lerp(0.42, 0.78, cam);
  const width = revLimit * lerp(0.62, 0.34, cam);
  // Short strokes and more cylinders breathe better at high rpm.
  const bigBoreBonus = clamp(d.bore / d.stroke, 0.8, 1.25);

  // Turbo boost raises effective compression; past about 12.5 the engine knocks.
  const effectiveCompression = d.compression + boost * 3.2;
  const knock = Math.max(0, effectiveCompression - 12.5);
  const compressionFactor = (1 + (d.compression - 9) * 0.03) * (1 - knock * 0.06);
  const spoolRpm = asp.spoolBase + boost * 1200;

  const nmPerLitre = 105 * head.ve * fuel.ve * compressionFactor;

  function torqueAt(rpm) {
    if (rpm > revLimit) return 0;
    const ve = 0.5 + 0.5 * Math.exp(-(((rpm - peakRpm) / width) ** 2));
    const highRpmLoss = rpm > peakRpm ? 1 - ((rpm - peakRpm) / revLimit) * 0.25 * (1.25 - bigBoreBonus) : 1;
    const boostNow = turbo ? 1 + boost * smoothstep(spoolRpm - 900, spoolRpm + 700, rpm) : 1;
    return Math.max(0, displacement * nmPerLitre * ve * highRpmLoss * boostNow);
  }

  const curve = [];
  let peakTorque = 0, peakTorqueRpm = 0, peakPower = 0, peakPowerRpm = 0;
  for (let rpm = 800; rpm <= revLimit; rpm += 50) {
    const t = torqueAt(rpm);
    const kw = (t * rpm) / 9549;
    curve.push({ rpm, torque: t, power: kw });
    if (t > peakTorque) { peakTorque = t; peakTorqueRpm = rpm; }
    if (kw > peakPower) { peakPower = kw; peakPowerRpm = rpm; }
  }

  const mass = (layout.mass + displacement * 30) * block.massMul * head.massMul + asp.mass;
  const cost = (layout.cost + displacement * 450) * head.costMul * block.costMul + fuel.cost + asp.cost;

  const overRev = Math.max(0, revLimit - safeRpm);
  const reliability = clamp(
    72 + head.reliability + fuel.reliability + block.reliability
      - overRev / 60 - knock * 18 - boost * 10 - cam * 12 - (layout.cyl > 8 ? 5 : 0),
    0, 100);
  const smoothness = clamp(layout.smooth * 100 - cam * 30 + (turbo ? 5 : 0), 0, 100);

  const warnings = [];
  if (overRev > 0) warnings.push(`Rev limit is ${Math.round(overRev)} rpm above the safe ${Math.round(safeRpm)} rpm for this stroke and valvetrain.`);
  if (knock > 0) warnings.push(`Engine knocks: effective compression ${effectiveCompression.toFixed(1)}:1 is over 12.5:1. Lower compression or boost.`);

  return {
    displacement, safeRpm, revLimit, torqueAt, curve,
    peakTorque, peakTorqueRpm, peakPower, peakPowerRpm,
    mass, cost, reliability, smoothness, turbo, cam,
    thermalEff: 0.3 * fuel.eff * (1 + (d.compression - 9) * 0.02) * (1 - cam * 0.08) * (1 - knock * 0.05),
    warnings,
  };
}

function gearRatios(box) {
  const ratios = [];
  for (let i = 0; i < box.gears; i++) {
    ratios.push(box.first * (box.top / box.first) ** (i / (box.gears - 1)));
  }
  return ratios;
}

function simulate(d) {
  const body = BODIES[d.body];
  const mat = MATERIALS[d.material];
  const box = GEARBOXES[d.gearbox];
  const drive = DRIVETRAINS[d.drivetrain];
  const susp = SUSPENSIONS[d.suspension];
  const tire = TIRES[d.tires];
  const brakes = BRAKES[d.brakes];
  const interior = INTERIORS[d.interior];
  const safetyPkg = SAFETY[d.safety];
  const engine = buildEngine(d);

  // Add up the effects of the styling parts.
  const style = { cd: 1, grip: 0, mass: 0, cost: 0, prestige: 0, comfort: 0, utility: 0 };
  for (const [key, table] of Object.entries(STYLE_TABLES)) {
    const part = table[d[key]];
    style.cd *= part.cd ?? 1;
    for (const k of ['grip', 'mass', 'cost', 'prestige', 'comfort', 'utility']) style[k] += part[k] ?? 0;
  }

  const bodyMass = body.mass * mat.massMul;
  const mass = bodyMass + engine.mass + box.mass + drive.mass + susp.mass + brakes.mass +
    interior.mass + safetyPkg.mass + style.mass + (d.tireWidth - 195) * 0.12 * 4 + (d.rim - 15) * 1.5 * 4;

  const wheelRadius = d.rim * 0.0127 + d.tireWidth * 0.001 * (d.rim >= 18 ? 0.4 : 0.55);
  const widthGrip = 1 + (d.tireWidth - 205) / 1000;
  const mu = tire.mu * widthGrip;
  const rr = tire.rr * (1 + (d.tireWidth - 205) / 800);
  const cdA = 1.12 * style.cd * body.cd * body.area * (1 + (d.tireWidth - 205) / 2000);
  const ratios = gearRatios(box);
  const eff = box.eff * (d.drivetrain === 'awd' ? 0.95 : 1);

  const resist = (v) => 0.5 * AIR_DENSITY * cdA * v * v + rr * mass * G;
  const rpmFor = (v, gear) => (v / wheelRadius) * ratios[gear] * d.finalDrive * 60 / (2 * Math.PI);

  // Share of weight on driven wheels shifts rearward as the car accelerates.
  function tractionLimit(accel) {
    const shift = 0.12 * (accel / G);
    const share = d.drivetrain === 'awd' ? 1 : d.drivetrain === 'fwd' ? 0.6 - shift : 0.46 + shift;
    return mu * mass * G * clamp(share, 0.3, 1);
  }

  // Straight-line acceleration run, stepped at 10 ms.
  const dt = 0.01;
  const launchRpm = Math.min(engine.revLimit * 0.7, Math.max(2500, engine.peakTorqueRpm * 0.8));
  let v = 0, x = 0, t = 0, gear = 0, shiftTimer = 0, accel = 0;
  let t60 = null, t100 = null, tQuarter = null, vQuarter = 0, t160 = null;
  while (t < 90 && (tQuarter === null || t100 === null || t160 === null)) {
    let force = 0;
    const shifting = shiftTimer > 0;
    if (shifting) {
      shiftTimer -= dt;
    } else {
      let rpm = rpmFor(v, gear);
      if (rpm >= engine.revLimit * 0.995 && gear < ratios.length - 1) {
        gear++;
        shiftTimer = box.shift;
        continue;
      }
      if (gear === 0) rpm = Math.max(rpm, launchRpm); // clutch slip off the line
      const wheelForce = rpm > engine.revLimit ? 0 : (engine.torqueAt(rpm) * ratios[gear] * d.finalDrive * eff) / wheelRadius;
      force = Math.min(wheelForce, tractionLimit(accel));
    }
    accel = (force - resist(v)) / (mass * 1.05);
    if (accel <= 0 && v > 5 && !shifting) break; // car has topped out
    v = Math.max(0, v + accel * dt);
    x += v * dt;
    t += dt;
    if (t60 === null && v >= 26.82) t60 = t;
    if (t100 === null && v >= 100 / 3.6) t100 = t;
    if (t160 === null && v >= 160 / 3.6) t160 = t;
    if (tQuarter === null && x >= 402.3) { tQuarter = t; vQuarter = v; }
  }

  // Top speed: the fastest speed in any gear where drive force still beats drag.
  let topSpeed = 0;
  for (let g = 0; g < ratios.length; g++) {
    for (let vv = 5; vv < 140; vv += 0.25) {
      const rpm = rpmFor(vv, g);
      if (rpm > engine.revLimit) break;
      const f = Math.min((engine.torqueAt(rpm) * ratios[g] * d.finalDrive * eff) / wheelRadius, tractionLimit(0));
      if (f >= resist(vv)) topSpeed = Math.max(topSpeed, vv);
    }
  }
  const topRpm = rpmFor(topSpeed, ratios.length - 1);

  // Handling and braking.
  const stiff = d.stiffness / 100;
  const lateralG = 0.88 * mu * susp.grip * drive.handling * (0.92 + stiff * 0.1) * (1 - (mass - 1200) / 12000) * (1 + style.grip);
  const brakeG = Math.min(mu * 1.05, brakes.decel);
  const braking100 = (100 / 3.6) ** 2 / (2 * brakeG * G);

  // Fuel economy from the energy needed to cruise, plus a fixed urban overhead.
  const cruise = (kmh) => {
    const vc = kmh / 3.6;
    const cruiseRpm = rpmFor(vc, ratios.length - 1);
    const rpmPenalty = 1 + Math.max(0, cruiseRpm - 2200) / 6000;
    const joulesPer100km = (resist(vc) * 100000) / (eff * engine.thermalEff) * rpmPenalty;
    return joulesPer100km / (PETROL_MJ_PER_L * 1e6) + 0.9 * engine.displacement;
  };
  const economy = cruise(90) * 0.5 + cruise(120) * 0.2 + (cruise(50) + mass / 450) * 0.3;

  const cost = body.cost * mat.costMul + engine.cost + box.cost + drive.cost + susp.cost +
    tire.cost * (1 + (d.tireWidth - 205) / 250 + (d.rim - 15) / 10) + brakes.cost +
    interior.cost + safetyPkg.cost + style.cost + 2500; // assembly
  const price = Math.round((cost * 1.35) / 50) * 50;

  const comfort = clamp(susp.comfort * (1.25 - stiff * 0.5) + interior.comfort + box.comfort + tire.comfort +
    engine.smoothness * 0.12 + style.comfort - (d.rim - 16) * 3 - (body.name === 'Roadster' ? 8 : 0), 0, 100);
  const reliability = clamp(engine.reliability * 0.7 + 25 + mat.reliability - (d.drivetrain === 'awd' ? 4 : 0) -
    (d.gearbox === 'dct' ? 5 : 0), 0, 100);

  const ratings = {
    performance: score(t100 ?? 30, 16, 3),
    handling: score(lateralG, 0.62, 1.15),
    comfort,
    economy: score(economy, 14, 4),
    practicality: clamp(body.seats * 9 + body.cargo * 45, 0, 100),
    reliability,
    safety: clamp(safetyPkg.safety + (brakeG - 0.9) * 30 + (mass - 1100) / 60, 0, 100),
    prestige: clamp(interior.prestige + mat.prestige + style.prestige + LAYOUTS[d.layout].cyl * 3 + (engine.peakPower > 250 ? 12 : 0), 0, 100),
    utility: clamp(body.utility * 55 + style.utility + susp.utility * 20 + (d.drivetrain === 'awd' ? 15 : 0) + engine.peakTorque / 25, 0, 100),
    affordability: score(price, 80000, 10000),
  };

  const segments = {};
  for (const [key, seg] of Object.entries(SEGMENTS)) {
    let s = 0;
    for (const [rating, w] of Object.entries(seg.weights)) s += ratings[rating] * w;
    segments[key] = Math.round(s);
  }

  return {
    engine, mass, wheelRadius, ratios,
    t60, t100, t160, tQuarter, vQuarter, topSpeed, topRpm,
    lateralG, brakeG, braking100, economy,
    cost, price, ratings, segments, style,
  };
}
