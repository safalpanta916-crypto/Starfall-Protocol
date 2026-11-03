# SPPyntex: Starfall Protocol

An original browser-based vertical shooter by SPPyntex. Pilot Vesper-01 through three defense waves and the Aetherion Dreadnought encounter.

## Local development

From the project root:

```sh
pnpm install
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/starfall-protocol run dev
```

Check and build:

```sh
pnpm --filter @workspace/starfall-protocol run typecheck
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/starfall-protocol run build
```

The game runs locally in the browser and stores settings, tutorial completion, best score, and a resumable run in local storage.

## Controls

- Move: WASD or arrow keys; mouse pointer; left stick or D-pad; touch controls on touchscreens.
- Fire: hold Space or Z, left mouse button, gamepad A/Cross, or touch Fire.
- Focus: hold Shift, right mouse button, gamepad B/Circle, or touch Focus.
- Bomb: X, the HUD button, gamepad Y/Triangle, or touch Bomb when energy is full.
- Pause: Escape or gamepad Start.

## Vercel

The root `vercel.json` builds this workspace app and publishes its static output. Import the repository into Vercel with the project root set to the repository root; the included configuration supplies the build command, output folder, and single-page route fallback.
