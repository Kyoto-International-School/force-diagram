# Force Diagram Bootstrap

Minimal frontend baseline for a browser-only diagram/editor app.

Stack:

- Vite + React + TypeScript
- Tailwind CSS v4 via `@tailwindcss/vite`
- `shadcn/ui` primitives
- `@xyflow/react` for diagram/canvas work
- ESLint, TypeScript project references, and `knip`

## Local development

```bash
npm install
npm run dev
```

The app uses the `@` alias for `src`, so imports such as `@/components/ui/button` and `@/lib/utils` resolve in both Vite and TypeScript.

## Quality checks

```bash
npm run lint
npm run typecheck
npm run knip
npm run check
```

`npm run check` runs the full validation pass expected for the bootstrap baseline.

## Production build

```bash
npm run build
```

Preview the generated bundle locally with:

```bash
npm run preview
```

## Static deployment

This project is client-side only and produces static assets in `dist/`.

For static hosts that serve from the root path, use the normal build:

```bash
npm run build
```

For GitHub Pages, build with the repository name as the base path:

```bash
npm run build:pages
```

This repository also includes a GitHub Actions workflow at [`.github/workflows/deploy-pages.yml`](/Users/ash/dev/kis/gh-org/force-diagram/.github/workflows/deploy-pages.yml) that deploys `main` to GitHub Pages automatically.

One-time repository setup in GitHub:

1. Open `Settings` -> `Pages`
2. Set `Source` to `GitHub Actions`
3. Push to `main` or rerun the `Deploy GitHub Pages` workflow from the `Actions` tab

If the site is deployed under a different subpath, override the base path at build time:

```bash
BASE_PATH=/your-subpath/ npm run build
```

Then publish the contents of `dist/` with your preferred static host or CI workflow.
