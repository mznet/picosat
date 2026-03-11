# picosat

A desktop and web app for JSON/YAML diff, Markdown preview, and Mermaid diagram editing in one place.

## Features

- **JSON Diff** — Compare two JSON documents side by side with formatting
- **YAML Diff** — Compare two YAML documents side by side with formatting
- **Markdown Viewer** — Editor with live preview and file open
- **Mermaid** — Diagram editor with preview, zoom/pan, minimap, and file open

## Tech Stack

- **React 18** + **TypeScript**
- **Vite** — Build tool and dev server
- **Tailwind CSS** — Styling
- **Tauri 2** — Desktop app (optional)

## Getting Started

### Web (development)

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### Web (production build preview)

```bash
npm run build
npm run preview
```

### Desktop (Tauri)

```bash
npm run tauri dev    # Development
npm run tauri build  # Build
```

[Install Rust](https://www.rust-lang.org/tools/install) first.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | TypeScript check + Vite build |
| `npm run preview` | Serve production build locally |
| `npm run lint` | Run ESLint |
| `npm run test` | Vitest (watch) |
| `npm run test:run` | Vitest (single run) |
| `npm run tauri dev` | Tauri development mode |
| `npm run tauri build` | Build Tauri desktop app |

## CI & Branch Protection

PRs run **lint** and **test** via [GitHub Actions](.github/workflows/ci.yml). To require that checks pass before merging:

1. Go to **Settings → Branches** → Branch protection rules.
2. Add or edit a rule for `main`.
3. Enable **Require status checks to pass before merging**.
4. In **Status checks that are required**, select **lint & test** (the CI job name).
5. Save. PRs can then only be merged when the CI workflow succeeds.

## Project Structure

```
src/
  App.tsx              # Routing and view switching
  main.tsx
  components/
    Sidebar.tsx        # Left sidebar view selector (J / Y / Md / M)
    ObjectDiffView.tsx # Shared JSON/YAML diff UI
    MarkdownViewer.tsx # Markdown editor + preview
    MermaidViewer.tsx  # Mermaid editor + preview, zoom/minimap
  utils/
    diffTree.ts        # Diff tree logic
src-tauri/             # Tauri desktop (Rust)
```

## License

Private.
