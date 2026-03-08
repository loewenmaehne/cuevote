# Production TDZ (Temporal Dead Zone) Errors — What Happened

## What you saw

In production (minified bundle), the app sometimes crashed with:

- `ReferenceError: Cannot access 'ja' before initialization`
- `Cannot access 'Ta' before initialization`
- `Cannot access 'Sl' before initialization`
- `Cannot access 'ie' before initialization`

Same kind of error, different minified variable names.

## Why it happens

1. **Minification**  
   Production builds rename variables (e.g. `translations` → `Ta`, `isTV` → `ie`). The error message shows that minified name.

2. **Bundler chunking and order**  
   Vite/Rollup split the app into chunks and decide the order modules run. If:
   - Module A uses something from Module B, and  
   - the bundle runs A (or code that depends on B) before B has finished initializing,  
   then reading that “something” throws **Cannot access 'X' before initialization** (a TDZ).

3. **Risky patterns**  
   - **Export then mutate:** `export const X = { a: 1 }; X.b = 2;` — other code can load and read `X` before `X.b` is set.  
   - **Cross-references between exports:** e.g. `export const isMobile = () => isTV();` and `export const isTV = () => ...` — if the bundler evaluates/inlines in an order where `isTV` isn’t initialized yet when `isMobile` runs, you get a TDZ.  
   - **Large data modules** (e.g. `translations`, `legalContent`) loaded at startup — their export can be read before the module has finished running.

## What we changed (to stop these errors)

| Fix | Purpose |
|-----|--------|
| **legalContent.js** | One single `export const LEGAL_CONTENT = { ... }` with no mutation; helper takes `enRef` so it never closes over `LEGAL_CONTENT`. |
| **LegalPage** | Load `LEGAL_CONTENT` via `import()` in `useEffect`; route is lazy so the legal chunk only loads on `/legal`. |
| **LanguageContext** | No static import of `translations`; load via `import('./translations')` in `useEffect` and store in state. |
| **main.jsx** | App and LegalPage routes are `React.lazy()` so their chunks (and deps) don’t run at initial load. |
| **vite.config.js** | `manualChunks` for `translations` and `legalContent`; `sourcemap: true` so production errors point to real files. |
| **deviceDetection.js** | Replaced multiple `export const` with a single `export const deviceDetection = { isTV, isTablet, ... }` so all helpers are defined first and only one binding is exported (no reorder/TDZ). Call sites use `deviceDetection.isTV()` etc. |

Together, these remove or avoid the patterns that were causing the TDZ errors in production.
