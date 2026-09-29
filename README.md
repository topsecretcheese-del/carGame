# Car Builder

A car design game in the browser, inspired by *Automation: The Car Company Tycoon Game*.
Pick a body, design the engine, set up the drivetrain and chassis, and see how the car
performs and which buyers want it.

## Play

Open `index.html` in a browser. No build step or install needed.

## What you can design

- **Body:** style (hatchback, sedan, wagon, coupe, roadster, SUV, pickup), chassis material.
- **Style:** paint, headlights, grille, hood, wheel design and finish, spoiler, stripes and stripe
  colour, window tint, roof and body kit. Some parts change the figures too: wings and skirts add
  grip, scoops, racks and big wings add drag, and every part has a cost and prestige effect.
- **Engine:** cylinder layout, block material, valvetrain, fuel system, turbocharging and boost,
  bore and stroke, compression, cam profile, rev limit.
- **Drivetrain:** driven wheels, gearbox, final drive ratio.
- **Chassis:** suspension type and stiffness, tyre compound, tyre width, wheel size, brakes.
- **Interior:** trim level and safety equipment.

## 3D viewer

The car is shown in 3D (three.js, loaded from a CDN). Drag to rotate, scroll or pinch to zoom,
or pick a camera angle. The body, every styling part, wheel and tyre size, ride height, brakes
and exhaust count all update live. If WebGL isn't available it falls back to a 2D side drawing,
which you can also switch to with the "2D drawing" button.

## What it calculates

- A dyno chart of power and torque across the rev range.
- 0–100 km/h (or 0–60 mph), quarter mile, top speed, cornering grip, braking distance, fuel use,
  weight, build cost and sticker price. Acceleration comes from a time-stepped simulation with
  gearing, traction, weight transfer, drag and shift times.
- Ratings (performance, comfort, economy, reliability and more) and how well the car fits each
  market segment.
- Warnings for engine knock, over-revving, and top speed being capped by the rev limiter.

Designs can be saved to the garage, which is kept in the browser's local storage.

## Race mode

Open `race.html` or press **Race this car** in the builder. Race the current design or a saved garage car against five AI opponents over three laps. The race uses the builder simulation for horsepower, mass, top speed, drivetrain launch behaviour, tyre/suspension grip and braking. Keyboard and touch controls are supported.

## Code layout

- `js/data.js`: parts catalogue and market segments. Tweak numbers here to rebalance.
- `js/sim.js`: engine model, performance simulation and ratings.
- `js/viewer3d.js`: the 3D car viewer.
- `js/app.js`: controls, 2D preview, dyno chart and garage.
- `js/race.js`: browser race simulation and AI opponents.
- `race.html` / `race.css`: race mode UI and styling.
