# Afterimage Architect

**Afterimage Architect** is a browser-based puzzle-action game where previous attempts become replaying “afterimage” ghosts. The player solves compact sci-fi puzzle rooms by coordinating with recordings of their own past movement.

> Use recordings of your past attempts to cooperate with yourself and solve puzzle rooms.

## Live Demo

[Play Afterimage Architect]: https://afterimage-architect.vercel.app/

## Gameplay

The player controls a small glowing robot inside single-screen puzzle rooms. Each room contains walls, pressure plates, doors, and an exit portal.

The core mechanic is timeline recording:

1. Move through the level.
2. Press `R` to restart the timeline.
3. Your previous attempt becomes a translucent afterimage.
4. The afterimage replays your exact recorded input.
5. Use your past self to hold plates, open doors, and solve the room.

## Controls

| Key | Action |
|---|---|
| WASD / Arrow Keys | Move |
| R | Restart timeline and create afterimage |
| Backspace | Full reset current level |
| Shift + R | Full reset current level |
| Esc / P | Pause |
| Enter / N | Continue to next level |
| M | Return to level select while paused |

## Features

- Browser-based game built with TypeScript, Phaser 3, and Vite
- Fixed timestep simulation loop
- Input-frame recording system
- Afterimage ghost replay
- JSON-driven level loading
- Pressure plates and doors
- Ghosts can activate puzzle elements
- Five handcrafted puzzle levels
- Level select screen
- LocalStorage progress saving
- Pause / controls menu
- Generated sound effects using Web Audio
- Visual polish effects:
  - ghost spawn bursts
  - player movement trail
  - door open/close pulses
  - level-complete effects
  - camera flash and shake

## Technical Breakdown

### Deterministic Replay System

The core system records the player’s directional input every fixed simulation tick. When the player restarts a timeline, the current recording is saved and assigned to a ghost afterimage.

Each ghost starts from the level spawn point and replays one recorded input frame per simulation step. Because gameplay is updated using a fixed timestep, the replay is more consistent than relying directly on variable browser frame timing.

### Fixed Timestep Simulation

The game separates Phaser’s variable render update from gameplay simulation. Phaser may render at different frame rates depending on the browser and machine, but gameplay logic runs through a fixed-step accumulator.

This helps make player movement, input recording, and ghost playback more stable and predictable.

### JSON Level Format

Levels are stored as JSON files in `public/levels`.

Each level defines:

- level id
- level name
- player spawn
- exit portal
- walls
- pressure plates
- doors
- player instruction text
- hint text

Example:

```json
{
  "id": "level-003",
  "name": "Borrowed Weight",
  "instruction": "Record yourself holding the plate, then restart and let your afterimage help.",
  "hint": "Press R after standing on the plate. Your ghost will replay that attempt.",
  "spawn": {
    "x": 5,
    "y": 5
  },
  "exit": {
    "x": 14,
    "y": 5
  },
  "plates": [
    {
      "id": "plate-a",
      "x": 6,
      "y": 5,
      "controls": ["door-a"]
    }
  ],
  "doors": [
    {
      "id": "door-a",
      "x": 9,
      "y": 5
    }
  ]
}

```

## Architecture

```txt
src/
  main.ts
  style.css
  game/
    constants.ts
    levels.ts
    types.ts
    scenes/
      GameScene.ts
      LevelSelectScene.ts
    systems/
      GeneratedSfx.ts

public/
  levels/
    level-001.json
    level-002.json
    level-003.json
    level-004.json
    level-005.json
```

## Main Systems

### GameScene

Handles the main gameplay loop:

- level loading
- player movement
- collision
- timeline restart
- ghost replay
- puzzle state
- win condition
- pause overlay
- visual effects

### LevelSelectScene

Handles:

- level selection
- locked/unlocked level display
- LocalStorage progress reading
- starting selected levels

### GeneratedSfx

A small sound system that generates simple sci-fi effects using the browser Web Audio API. No external audio assets are required.

## Level Progression

| Level | Name | Focus |
|---|---|---|
| 1 | First Contact | Movement and exit portal |
| 2 | Hold the Line | Pressure plate and door |
| 3 | Borrowed Weight | First ghost-assisted puzzle |
| 4 | Two Echoes | Multiple afterimages |
| 5 | Final Relay | Final multi-step relay puzzle |

## Tech Stack

- TypeScript
- Phaser 3
- Vite
- HTML/CSS
- Web Audio API
- LocalStorage
- JSON level files

## What I Built

I built the game from scratch, including:

- the Phaser project setup
- the movement and collision system
- the fixed timestep simulation loop
- the input recording system
- the afterimage replay system
- level loading from JSON
- puzzle interactions between plates and doors
- level select and saved progress
- pause menu and controls screen
- generated sound effects
- visual polish effects

## Challenges and Solutions

### Challenge: Making ghost replay feel reliable

The main challenge was making afterimages replay previous attempts consistently. I solved this by recording input per simulation frame and updating gameplay through a fixed timestep loop instead of relying directly on variable browser frame timing.

### Challenge: Keeping the project scoped

The game idea could easily become too large, so I kept the MVP focused around movement, plates, doors, ghosts, exits, and five handcrafted levels.

### Challenge: Making levels data-driven

Instead of hardcoding every room, I moved level layouts into JSON files. This made the project easier to expand and made the architecture cleaner.

## Future Improvements

- Add laser beams that can be blocked by the player or ghosts
- Add moving platforms
- Add patrol guards
- Add a visual level editor
- Add animated GIFs to the README
- Add accessibility settings
- Add speedrun timer and best-time tracking
- Add more levels

## Running Locally

Install dependencies:

```bash
npm install
```

Start development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

## Status

Playable prototype with five handcrafted levels.