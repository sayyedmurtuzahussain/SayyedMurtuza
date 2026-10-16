# SayyedMurtuza
A top-down, left-hand-traffic four-way junction simulator on HTML canvas. Cars spawn at adjustable rates, queue without overlapping, and cross on green with no collisions. It offers fixed vs adaptive signals, free left turns, emergency green corridors, live stats, and pause/reset controls.
# Traffic Junction Simulator

A top-down, left-hand-traffic (LHT) four-way junction simulator built on HTML canvas. Adjust traffic, switch signal strategies, and measure how well the signal timing moves cars through.

> Indian junctions are chaos. This project simulates one and measures how well the signals cope.

## Features

**Core**
- Top-down four-way junction drawn on an HTML canvas
- Cars spawn from all four directions at user-adjustable rates
- Signals cycle green, amber and red per direction, with distinct shapes and labels so they read in black and white
- Cars stop at red, queue without overlapping, and cross on green with no collisions inside the junction
- Live statistics: cars passed, average waiting time and current queue length per direction
- Pause, resume, step and reset controls (reset clears all statistics)

**Stretch goals**
- **Adaptive signal mode:** gives more green time to longer queues, with a side-by-side comparison against fixed timing
- **Free left turn:** dedicated bypass lane (traffic drives on the left)
- **Emergency vehicle:** siren beacon triggers a green corridor, then the normal cycle resumes

## How it works

| Area | Approach |
|---|---|
| Simulation loop | Fixed 60 Hz time step, decoupled from display frame rate, driven by `requestAnimationFrame` with an accumulator |
| Queueing | Intelligent Driver Model (IDM) car-following keeps safe gaps, so cars never overlap |
| Junction safety | A car enters only if its exit lane has room; amber point-of-no-return rule; all-red clearance between phases |
| Spawning | A spawn is held back if the entry lane is occupied |
| Adaptive mode | Queue-weighted green time with minimum and maximum green limits so no direction starves |
| Fair comparison | Fixed and adaptive run with the same random seed and arrival rates |
| Rendering | Canvas scales for high-DPI (Retina) screens; the renderer only reads a state snapshot |

The simulation code contains no canvas or DOM calls, so it is independent of the drawing code.

## Controls

- **Arrival-rate sliders:** one per direction (N, S, E, W)
- **Mode switch:** fixed-time or adaptive
- **Emergency button:** sends an emergency vehicle
- **Pause / Resume / Step / Reset**
- **Click or tap a car** to inspect its speed, state and waiting time

## Project structure

> Adjust the file names below to match your repository.

```
.
├── index.html          # Page layout and controls
├── css/                # Styles (responsive, mobile drawers)
├── js/
│   ├── simulation.js   # State manager, fixed-step loop, running state
│   ├── junction.js     # Lane geometry, stop lines, turning paths
│   ├── vehicle.js      # Car model and IDM car-following
│   ├── signals.js      # Fixed, adaptive and emergency signal controller
│   ├── stats.js        # Live statistics and analytics
│   └── renderer.js     # Canvas drawing (HiDPI, responsive)
└── README.md
```

## Getting started

No build step is needed.

```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>
```

Open `index.html` in a browser, or serve it locally:

```bash
python -m http.server 8000
# then visit http://localhost:8000
```

## Testing the simulator

1. Raise the spawn rate on every direction until queues form, and check that cars never overlap.
2. Watch the junction on amber and check that no car collides with crossing traffic.
3. Switch between fixed and adaptive mode and compare average waiting time and throughput.
4. Trigger an emergency vehicle and confirm the green corridor opens and the normal cycle resumes.
5. Press reset and confirm all statistics return to zero.

## Tech stack

- HTML5 Canvas
- Vanilla JavaScript (ES6+)
- CSS3

## License

Add your license here (for example, MIT).
