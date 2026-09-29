// Parts catalogue. Masses in kg, costs in dollars, dimensions in metres unless noted.

const BODIES = {
  hatch:    { name: 'Hatchback', mass: 820,  cost: 5200,  cd: 0.33, area: 2.05, seats: 5, cargo: 0.65, utility: 0.2, length: 4.0 },
  sedan:    { name: 'Sedan',     mass: 930,  cost: 6200,  cd: 0.29, area: 2.15, seats: 5, cargo: 0.75, utility: 0.2, length: 4.7 },
  wagon:    { name: 'Wagon',     mass: 980,  cost: 6600,  cd: 0.31, area: 2.2,  seats: 5, cargo: 1.0,  utility: 0.4, length: 4.75 },
  coupe:    { name: 'Coupe',     mass: 880,  cost: 6400,  cd: 0.28, area: 1.95, seats: 4, cargo: 0.35, utility: 0.1, length: 4.4 },
  roadster: { name: 'Roadster',  mass: 780,  cost: 6800,  cd: 0.34, area: 1.8,  seats: 2, cargo: 0.15, utility: 0.0, length: 4.0 },
  suv:      { name: 'SUV',       mass: 1180, cost: 7800,  cd: 0.37, area: 2.65, seats: 7, cargo: 0.9,  utility: 0.7, length: 4.8 },
  pickup:   { name: 'Pickup',    mass: 1150, cost: 7200,  cd: 0.42, area: 2.75, seats: 5, cargo: 0.8,  utility: 1.0, length: 5.3 },
};

const MATERIALS = {
  steel:     { name: 'Steel',            massMul: 1.0,  costMul: 1.0, reliability: 0,  prestige: 0 },
  galvanized:{ name: 'Galvanized steel', massMul: 1.02, costMul: 1.1, reliability: 6,  prestige: 2 },
  aluminium: { name: 'Aluminium',        massMul: 0.74, costMul: 1.9, reliability: 3,  prestige: 12 },
  carbon:    { name: 'Carbon fibre',     massMul: 0.55, costMul: 4.5, reliability: 0,  prestige: 30 },
};

// smooth: 0-1 how balanced the layout is; base mass and cost before displacement.
const LAYOUTS = {
  i3:  { name: 'Inline 3', cyl: 3,  mass: 55,  cost: 900,  smooth: 0.45 },
  i4:  { name: 'Inline 4', cyl: 4,  mass: 68,  cost: 1100, smooth: 0.6 },
  b4:  { name: 'Boxer 4',  cyl: 4,  mass: 78,  cost: 1500, smooth: 0.75 },
  i5:  { name: 'Inline 5', cyl: 5,  mass: 80,  cost: 1500, smooth: 0.7 },
  v6:  { name: 'V6',       cyl: 6,  mass: 92,  cost: 1900, smooth: 0.75 },
  i6:  { name: 'Inline 6', cyl: 6,  mass: 98,  cost: 1900, smooth: 0.95 },
  b6:  { name: 'Boxer 6',  cyl: 6,  mass: 100, cost: 2400, smooth: 0.95 },
  v8:  { name: 'V8',       cyl: 8,  mass: 112, cost: 2600, smooth: 0.85 },
  v10: { name: 'V10',      cyl: 10, mass: 135, cost: 3800, smooth: 0.9 },
  v12: { name: 'V12',      cyl: 12, mass: 150, cost: 4800, smooth: 1.0 },
};

const BLOCKS = {
  iron:      { name: 'Cast iron', massMul: 1.0,  costMul: 1.0,  reliability: 5 },
  aluminium: { name: 'Aluminium', massMul: 0.78, costMul: 1.3,  reliability: 0 },
};

// rpm: practical valvetrain limit. ve: breathing efficiency.
const HEADS = {
  ohv:  { name: 'OHV (pushrod)', rpm: 6300, ve: 0.93, costMul: 0.95, massMul: 0.95, reliability: 6 },
  sohc: { name: 'SOHC',          rpm: 7200, ve: 0.97, costMul: 1.05, massMul: 1.0,  reliability: 3 },
  dohc: { name: 'DOHC',          rpm: 8800, ve: 1.02, costMul: 1.22, massMul: 1.06, reliability: 0 },
};

// eff: thermal efficiency multiplier for fuel economy.
const FUEL_SYSTEMS = {
  carb:   { name: 'Carburettor',          ve: 0.94, eff: 0.88, cost: 150,  reliability: -3 },
  spi:    { name: 'Single-point injection', ve: 0.97, eff: 0.94, cost: 300,  reliability: 2 },
  mpi:    { name: 'Multi-point injection',  ve: 1.0,  eff: 1.0,  cost: 450,  reliability: 3 },
  direct: { name: 'Direct injection',       ve: 1.03, eff: 1.08, cost: 800,  reliability: 0 },
};

const ASPIRATIONS = {
  na:    { name: 'Naturally aspirated', mass: 0,  cost: 0,    spoolBase: 0 },
  turbo: { name: 'Single turbo',        mass: 22, cost: 1400, spoolBase: 2600 },
  twin:  { name: 'Twin turbo',          mass: 38, cost: 2600, spoolBase: 2000 },
};

// ratios: first and top gear; shift: seconds of lost drive per shift.
const GEARBOXES = {
  m4:  { name: '4-speed manual',    gears: 4, first: 3.5, top: 1.0,  eff: 0.93, shift: 0.5,  mass: 38, cost: 600,  comfort: 0 },
  m5:  { name: '5-speed manual',    gears: 5, first: 3.6, top: 0.82, eff: 0.93, shift: 0.45, mass: 42, cost: 800,  comfort: 0 },
  m6:  { name: '6-speed manual',    gears: 6, first: 3.8, top: 0.72, eff: 0.93, shift: 0.4,  mass: 48, cost: 1200, comfort: 0 },
  a3:  { name: '3-speed automatic', gears: 3, first: 2.5, top: 1.0,  eff: 0.82, shift: 0.5,  mass: 60, cost: 900,  comfort: 8 },
  a6:  { name: '6-speed automatic', gears: 6, first: 4.2, top: 0.69, eff: 0.88, shift: 0.3,  mass: 75, cost: 1900, comfort: 12 },
  dct: { name: '7-speed dual-clutch', gears: 7, first: 3.9, top: 0.63, eff: 0.94, shift: 0.08, mass: 70, cost: 2800, comfort: 9 },
};

const DRIVETRAINS = {
  fwd: { name: 'Front-wheel drive', mass: 0,  cost: 0,    handling: 0.97 },
  rwd: { name: 'Rear-wheel drive',  mass: 25, cost: 300,  handling: 1.02 },
  awd: { name: 'All-wheel drive',   mass: 75, cost: 1500, handling: 1.0 },
};

const SUSPENSIONS = {
  leaf:      { name: 'Solid axle, leaf springs', grip: 0.9,  comfort: 25, offroad: 1.0, mass: 10, cost: 300,  utility: 1.0 },
  mcpherson: { name: 'MacPherson strut',         grip: 1.0,  comfort: 55, offroad: 0.5, mass: 0,  cost: 600,  utility: 0.3 },
  wishbone:  { name: 'Double wishbone',          grip: 1.07, comfort: 62, offroad: 0.6, mass: 8,  cost: 1100, utility: 0.5 },
  multilink: { name: 'Multi-link',               grip: 1.08, comfort: 72, offroad: 0.4, mass: 12, cost: 1500, utility: 0.3 },
};

// mu: peak friction coefficient; rr: rolling resistance coefficient.
const TIRES = {
  eco:    { name: 'Economy',     mu: 0.85, rr: 0.0085, comfort: 8,   cost: 200 },
  all:    { name: 'All-season',  mu: 0.92, rr: 0.0100, comfort: 5,   cost: 300 },
  offroad:{ name: 'All-terrain', mu: 0.84, rr: 0.0130, comfort: 0,   cost: 420 },
  sport:  { name: 'Sport',       mu: 1.04, rr: 0.0115, comfort: -2,  cost: 650 },
  semi:   { name: 'Semi-slick',  mu: 1.22, rr: 0.0135, comfort: -10, cost: 1100 },
};

// decel: maximum braking the hardware supports, in g.
const BRAKES = {
  drum:    { name: 'Drums all round',       decel: 0.8,  cost: 150,  mass: 0 },
  discdrum:{ name: 'Front discs, rear drums', decel: 0.95, cost: 300,  mass: 2 },
  disc:    { name: 'Discs all round',       decel: 1.1,  cost: 500,  mass: 4 },
  vented:  { name: 'Vented discs',          decel: 1.3,  cost: 900,  mass: 8 },
  ceramic: { name: 'Carbon-ceramic',        decel: 1.6,  cost: 6000, mass: -10 },
};

const INTERIORS = {
  basic:    { name: 'Basic',    mass: 0,   cost: 300,   comfort: 0,  prestige: 0 },
  standard: { name: 'Standard', mass: 35,  cost: 1200,  comfort: 12, prestige: 8 },
  premium:  { name: 'Premium',  mass: 70,  cost: 3500,  comfort: 22, prestige: 25 },
  luxury:   { name: 'Luxury',   mass: 120, cost: 9000,  comfort: 30, prestige: 45 },
};

const SAFETY = {
  basic:    { name: 'Basic (seatbelts)',       mass: 0,  cost: 100,  safety: 25 },
  standard: { name: 'Standard (airbags, ABS)', mass: 20, cost: 700,  safety: 60 },
  advanced: { name: 'Advanced (crumple zones, stability control)', mass: 45, cost: 1800, safety: 90 },
};

// Market segments and how much each cares about each rating (weights sum to 1).
const SEGMENTS = {
  commuter: { name: 'Commuter', weights: { economy: 0.35, affordability: 0.3, reliability: 0.15, practicality: 0.2 } },
  family:   { name: 'Family',   weights: { practicality: 0.3, safety: 0.25, comfort: 0.2, affordability: 0.15, reliability: 0.1 } },
  sport:    { name: 'Sport',    weights: { performance: 0.4, handling: 0.35, prestige: 0.1, affordability: 0.15 } },
  luxury:   { name: 'Luxury',   weights: { comfort: 0.35, prestige: 0.35, performance: 0.15, safety: 0.15 } },
  work:     { name: 'Work & off-road', weights: { utility: 0.45, reliability: 0.3, affordability: 0.25 } },
};

const DEFAULT_DESIGN = {
  name: 'Greg GT',
  color: '#c8341c',
  body: 'coupe',
  material: 'steel',
  layout: 'i6',
  block: 'aluminium',
  head: 'dohc',
  fuel: 'mpi',
  aspiration: 'na',
  bore: 84,
  stroke: 90,
  compression: 10.5,
  boost: 0.7,
  cam: 55,
  revLimit: 7000,
  gearbox: 'm6',
  finalDrive: 3.7,
  drivetrain: 'rwd',
  suspension: 'wishbone',
  stiffness: 60,
  tires: 'sport',
  tireWidth: 235,
  rim: 17,
  brakes: 'vented',
  interior: 'standard',
  safety: 'standard',
};

// Side profiles: x runs rear (0) to front (1); y runs from the sill (0) to the roof (1).
// width, height and clearance are in metres. windshield and rearWindow index the body
// points that bound the sloped glass (used by the 3D viewer).
const PROFILES = {
  hatch: { width: 1.72, height: 1.45, clearance: 0.16, windshield: [4, 5], rearWindow: [2, 3],
    wheels: [0.16, 0.82],
    body: [[0, 0], [0, 0.55], [0.04, 0.64], [0.1, 0.95], [0.55, 1], [0.72, 0.64], [0.96, 0.56], [1, 0.44], [1, 0]],
    glass: [[0.12, 0.66], [0.16, 0.9], [0.54, 0.93], [0.68, 0.66]] },
  sedan: { width: 1.8, height: 1.42, clearance: 0.15, windshield: [5, 6], rearWindow: [3, 4],
    wheels: [0.18, 0.82],
    body: [[0, 0], [0, 0.55], [0.03, 0.63], [0.2, 0.67], [0.3, 0.96], [0.58, 0.98], [0.72, 0.66], [0.97, 0.58], [1, 0.44], [1, 0]],
    glass: [[0.24, 0.68], [0.32, 0.91], [0.57, 0.92], [0.68, 0.67]] },
  wagon: { width: 1.8, height: 1.47, clearance: 0.15, windshield: [3, 4], rearWindow: [1, 2],
    wheels: [0.17, 0.82],
    body: [[0, 0], [0, 0.6], [0.03, 0.95], [0.58, 0.98], [0.72, 0.66], [0.97, 0.58], [1, 0.44], [1, 0]],
    glass: [[0.05, 0.67], [0.06, 0.9], [0.57, 0.92], [0.68, 0.67]] },
  coupe: { width: 1.84, height: 1.3, clearance: 0.12, windshield: [5, 6], rearWindow: [3, 4],
    wheels: [0.18, 0.8],
    body: [[0, 0], [0, 0.6], [0.05, 0.67], [0.22, 0.72], [0.38, 0.97], [0.55, 0.98], [0.7, 0.66], [0.97, 0.55], [1, 0.42], [1, 0]],
    glass: [[0.28, 0.71], [0.39, 0.91], [0.54, 0.92], [0.65, 0.68]] },
  roadster: { width: 1.76, height: 1.22, clearance: 0.12,
    // An open car: the 3D body skips the windscreen fin and adds a separate screen.
    body3d: [[0, 0], [0, 0.62], [0.06, 0.7], [0.6, 0.7], [0.97, 0.58], [1, 0.44], [1, 0]],
    screen: [[0.6, 0.7], [0.51, 0.99]],
    wheels: [0.18, 0.8],
    body: [[0, 0], [0, 0.62], [0.06, 0.7], [0.44, 0.7], [0.5, 0.96], [0.53, 0.96], [0.6, 0.7], [0.97, 0.58], [1, 0.44], [1, 0]],
    glass: [[0.475, 0.71], [0.51, 0.93], [0.525, 0.93], [0.565, 0.71]] },
  suv: { width: 1.92, height: 1.75, clearance: 0.22, windshield: [3, 4], rearWindow: [1, 2],
    wheels: [0.17, 0.82],
    body: [[0, 0], [0, 0.62], [0.02, 0.95], [0.6, 0.98], [0.74, 0.66], [0.98, 0.6], [1, 0.45], [1, 0]],
    glass: [[0.04, 0.68], [0.05, 0.9], [0.59, 0.92], [0.7, 0.68]] },
  pickup: { width: 1.96, height: 1.8, clearance: 0.24, windshield: [4, 5], rearWindow: [2, 3],
    wheels: [0.15, 0.8],
    body: [[0, 0], [0, 0.6], [0.38, 0.6], [0.4, 0.97], [0.62, 0.97], [0.73, 0.66], [0.98, 0.6], [1, 0.45], [1, 0]],
    glass: [[0.43, 0.67], [0.44, 0.9], [0.61, 0.9], [0.69, 0.67]] },
};
