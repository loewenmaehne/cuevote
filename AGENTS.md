# Repository Guidelines

## Project Structure & Module Organization
- `revibe_demo.jsx` houses the end-to-end playlist UI prototype. Keep the component self-contained, and break new logic into feature folders (e.g., `src/queue`, `src/session`) once you introduce a bundler.
- `DemoImages/` stores reference screenshots for the README and PRs; keep additions under 500 KB.
- `README.md` captures the product narrative—update the matching section whenever flows, roles, or feature names change.
- When the project grows, create `src/` and colocate tests with components. Gather reusable hooks under `src/hooks`.

## Build, Test, and Development Commands
- The repository ships an isolated React 18 component. To preview it locally, scaffold a fresh Vite sandbox:
  ```bash
  npm create vite@latest revibe-sandbox -- --template react
  cd revibe-sandbox
  npm install
  npm install lucide-react
  npm run dev
  ```
  Replace `src/App.jsx` with `RevibePlaylistView`, and enable Tailwind (PostCSS + `tailwind.config.js`) so the utility classes render correctly.
- Once a permanent toolchain lives in this repo, document its scripts here (`npm run dev`, `npm run build`, `npm run lint`) and keep instructions in sync with `package.json`.

## Coding Style & Naming Conventions
- Prefer modern React: function components, hooks, and state variables in `camelCase`.
- Use double quotes for strings, trailing commas in multi-line objects, and keep JSX attributes ordered logically (state, handlers, rendering props).
- Keep Tailwind utility strings consistent (layout → color → state); extract helpers when repetition grows.
- Import icons from `lucide-react` as needed, but tree-shake by listing exact symbols.

## Testing Guidelines
- Add interaction tests with React Testing Library + Vitest (or Jest if already configured). Co-locate files as `ComponentName.test.jsx`.
- Cover vote toggling, modal visibility, and suggestion submission flows whenever you introduce new behavior. Target ≥80 % statement coverage; explain gaps in the PR.

## Commit & Pull Request Guidelines
- Follow the existing short, imperative style (`Add`, `Update`, `Refine`). Keep summaries ≤72 characters, reference issue IDs when relevant, and note key UI states.
- Pull requests should include purpose, testing notes (`npm run dev`, `npm run test`), refreshed screenshots from `DemoImages/`, and required reviewer setup.

## Assets & Configuration Notes
- Store secrets in `.env.local`, never in Git, and document required variables in the PR.
- Optimize new media for web playback and call out third-party services (YouTube quotas, websocket endpoints) touched by the change.
