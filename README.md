# SciPaper Todo

Local-first desktop workspace for scientific manuscript writing, review response, thesis assembly, and AI-assisted editing.

[Latest release](https://github.com/1690834643/scipaper-todo-app/releases/latest) · Windows and macOS · Electron + React + local JSON storage

## What It Is

SciPaper Todo is a desktop writing tool for researchers who manage papers as long-running projects rather than one-off documents.

It keeps manuscripts, references, review rounds, writing progress, attachments, and AI actions on your own machine. The app is designed around IMRaD paper writing, but it also includes thesis sections, daily research logs, Pomodoro writing sessions, and a built-in MCP server so external AI clients can read and write your local project with explicit tool boundaries.

## Main Features

- IMRaD paper workspace: Title, Abstract, Introduction, Methods, Results, Discussion, References.
- Focus writing mode: TipTap editor, formatting toolbar, citation autocomplete, annotations, AI drawer, word count, daily goal, and Pomodoro controls.
- Local AI assistant: OpenAI-compatible and Anthropic-compatible providers, scenario prompts, streaming responses, tool-call approval, and write tools.
- Review workflow: review rounds, reviewer comments, revisions, response text, status tracking, and import helpers.
- Thesis workflow: thesis metadata, sections, linked papers, text blocks, and Markdown export.
- Zotero integration: local Zotero config and AI-accessible reference context.
- Imports: manuscript/review text from paste, TXT, Markdown, DOCX, and text-based PDF.
- Exports: Markdown, DOCX, LaTeX, HTML, JSON, share package, full backup.
- Writing analytics: streaks, daily word target, mood log, Pomodoro sessions, progress entries.
- Vocabulary packs: section-aware scientific autocomplete with built-in and custom packs.
- MCP server: stdio entry for Claude Code, Cursor, Kimi Code, Cline, Roo Code, Continue, Windsurf, and other MCP-compatible clients.

## Recent Focus

The current development line focuses on making the real writing page match the design prototype and keeping long writing sessions smooth:

- Writing overlay is fixed above the dashboard and owns the scroll canvas.
- The toolbar, AI entry, annotation dock, citation autocomplete, and Pomodoro controls are available inside writing mode.
- Word counts update on editor changes instead of scanning the editor on every React render.
- Scroll work and outline tracking are requestAnimationFrame-throttled.
- Autocomplete dictionaries are indexed before keystroke-time matching.
- Storage internals are split into schema, normalization, database I/O, and business operations.
- `db.cjs` now caches normalized reads by database mtime while returning mutable copies to callers.

## Installation

Download the latest release:

https://github.com/1690834643/scipaper-todo-app/releases/latest

Windows:

- `SciPaper Todo-Setup-x.y.z.exe`: installer with Start Menu and uninstall entry.
- `SciPaper Todo-Portable-x.y.z.exe`: portable executable.

macOS:

- `SciPaper Todo-x.y.z-arm64.dmg` or `.zip`: Apple Silicon.
- `SciPaper Todo-x.y.z-x64.dmg` or `.zip`: Intel Mac.
- macOS builds are currently unsigned. On first launch, right-click the app and choose Open. If needed, run:

```bash
xattr -dr com.apple.quarantine /Applications/SciPaper\ Todo.app
```

## Local Data

SciPaper Todo stores data under:

```text
Documents/SciPaperTodo/
├── database.json
├── database.json.bak
├── Articles/
│   └── {ArticleId}/
│       ├── Attachments/
│       └── Exports/
└── Theses/
```

The database is local JSON. Writes use a temp file plus rename, a sentinel lock (`database.json.lock`), and periodic `.bak` snapshots. Full backup and restore are available in Settings.

## Storage Architecture

The Electron storage layer is split into four layers:

- `electron/schema.cjs`: constants, paths, section/status enums.
- `electron/normalize.cjs`: legacy migration and data normalization.
- `electron/db.cjs`: store creation, read cache, write lock, atomic write, backup recovery.
- `electron/storage.cjs`: business operations exposed to Electron IPC and MCP tools.

This split keeps schema and migration code out of business operations, makes storage bugs easier to locate, and allows future performance work such as write batching or incremental state responses without touching article/review/thesis logic.

## MCP Usage

The MCP entry point is:

```text
electron/mcp-cli.cjs
```

For WSL or source-based usage, point an MCP client at Node directly:

```json
{
  "mcpServers": {
    "scipaper-todo": {
      "command": "node",
      "args": ["/path/to/scipaper-todo/electron/mcp-cli.cjs"],
      "env": {
        "HOME": "/mnt/c/Users/<windows-user>"
      }
    }
  }
}
```

Set `HOME` to the user directory that contains `Documents/SciPaperTodo` when the MCP process runs outside the desktop app environment.

## Development

```bash
npm ci
npm run dev
```

Useful commands:

```bash
npm test
npm run lint
npm run build:renderer
npm run dist:win
npm run dist:mac
```

`npm run dev` starts Vite on `http://127.0.0.1:5173/` and launches Electron against that renderer.

## Release Process

The repository includes GitHub Actions release packaging:

- Pushing a `v*` tag runs tests, lint, Windows packaging, macOS packaging, and GitHub Release publishing.
- Manual publishing is available from Actions -> Build & Release -> Run workflow with `publish=true`.

Local WSL cross-building of Windows packages can fail if Wine/rcedit support is incomplete. The recommended release path is GitHub Actions on `windows-latest` and `macos-latest`.

## Tech Stack

- Electron 37
- React 19
- TypeScript 6
- Vite 8
- TipTap / ProseMirror
- Vitest
- electron-builder
- `@modelcontextprotocol/sdk`

## Known Notes

- The app is local-first; there is no cloud sync layer.
- macOS releases are unsigned until a signing certificate is configured.
- Scanned PDFs need OCR before import; text-based PDFs are supported best-effort.
- External MCP writers and the desktop app share a file lock. Concurrent writes fail explicitly rather than silently overwriting each other.
