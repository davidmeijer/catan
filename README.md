# Catan-Lite (TypeScript + React + Vite)

A small browser implementation of a Catan-like game with a basic bot AI.

Includes very special custom win and lose sounds!

## Requirements
- Node.js 18+ (or 20+ recommended)
- npm (or pnpm / yarn)

## Install
`npm i`

## Run in dev
`npm run dev`

Then open the printed local URL (usually http://localhost:5173)

If error "Cannot find module '@vitejs/plugin-react' occurs:

`npm i -D @vitejs/plugin-react`

## Build for prod
`npm run build`

`npm run preview`

## Play
- Choose 1–4 human players and any number of bots (total 2–4).
- Setup phase: Each player places Settlement + Road, then in reverse order places another Settlement + Road. You’ll get starting resources from tiles touching your second settlement.
- On your turn: Roll dice, receive resources, optionally trade (4:1 with bank), build Roads/Settlements/Cities, optionally move the Robber on a 7, then End Turn.
- You win at 10 Victory Points (1 per settlement, 2 per city).

## Notes / Simplifications
- Ports, development cards, Longest Road/Largest Army: not implemented (kept minimal).
- Discard on 7 is omitted. Robber still blocks production.
- Fixed base-board layout & numbers for clarity.
- Bot AI is heuristic: prefers high-probability spots (pips), builds cities/settlements/roads as resources allow, and trades 4:1 when near goals.

## File Structure
- index.html
- vite.config.ts
- tsconfig.json
- package.json
- src/
  - main.tsx
  - App.tsx
  - game/
    - constants.ts
    - types.ts
    - board.ts
    - logic.ts
    - ai.ts
    - rng.ts
  - ui/
    - Board.tsx
    - Panels.tsx
    - styles.css
