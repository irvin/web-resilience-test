For Traditional Chinese documentation, see [`README.zh-TW.md`](README.zh-TW.md).

# Report Build & Publish

This directory contains standalone report build tooling that compiles `report/index.md` and `report/en.md` into publishable HTML, syncs `report/img`, and builds/syncs Marp decks under `report/slide/` into the `report` branch worktree.

## Daily workflow

Recommended commands from the repo root:

```bash
npm run report:build
npm run report:publish
```

Semantics:

- `npm run report:build`: Updates report output only, for preview and review; does not `commit` or `push`
- `npm run report:publish`: Full publish flow—build first, then `commit` and `push` changes in the `report` branch worktree

First-time setup:

```bash
cd report
npm install
npm run init-worktree
```

If you prefer working inside `report/`:

```bash
cd report
npm run build
# or
npm run publish
```

From the repo root you can also run:

```bash
npm run report:init
npm run report:build
npm run report:publish
```

## Commands

### `npm run init-worktree`

- Checks whether the `report` branch already has a worktree
- If one exists, reuses it
- If not, creates a `report` branch worktree at the default path `report/publish`
- Creates the `report` branch if it does not exist

### `npm run build:slide`

- Compiles **all** Markdown files under `report/slide/` with Marp (for example `index.md`, `aprigf.md`)
- Writes matching HTML next to the sources (for example `index.html`, `aprigf.html`)
- Updates local `report/slide/` only; does not write the worktree, and does not `commit` or `push`

### `npm run build`

- Compiles `report/index.md` to `index.html` (Traditional Chinese, `/web/report/`)
- Compiles `report/en.md` to `en.html` (English, `/web/report/en.html`)
- Language switcher uses the same pill-style UI as the main `/web/` site (`lang-switcher` / `lang-switcher-btn`)
- Syncs `report/img` to `img/` in the target worktree (shared by both locales)
- Syncs every `report/slide/*.html` plus `report/slide/img/` into the worktree `slide/` directory (does not recompile decks; run `build:slide` first, or use `publish`)
- Default output is the worktree for the `report` branch
- Updates output only; does not `commit` or `push`
- If no worktree is found, prompts you to run `npm run init-worktree` first

### `npm run publish`

- Creates the report worktree automatically if missing
- Runs `build:slide` to compile all decks, then `build` to sync the latest report HTML, images, and slides into the report worktree
- Checks for changes in the report worktree
- If there are changes, runs `git add .`, `git commit`, and `git push`
- Exits with no action if there are no changes

## Recommended production workflow

### First-time setup

```bash
cd report
npm install
npm run init-worktree
```

### Daily build

From the repo root:

```bash
npm run report:build
```

Or inside `report/`:

```bash
cd report
npm run build
```

### Daily publish

From the repo root:

```bash
npm run report:publish
```

Or inside `report/`:

```bash
cd report
npm run publish
```

You do not need to set a commit message manually. When there are changes, the script uses the default `Update report` message to commit and push to the `report` branch. It does not create a commit when there are no changes.

To use a custom message, optionally run this from the repo root:

```bash
REPORT_COMMIT_MESSAGE="Update APRIGF slides" npm run report:publish
```

## Slides (`report/slide/`)

Sources and outputs:

- Sources: `report/slide/*.md`, with images under `report/slide/img/`
- Local compile: `npm run build:slide` → matching `.html` files in the same directory
- Publish sync: `npm run build` (or `publish`) copies every `slide/*.html` and `slide/img/` into the worktree `slide/` directory

To add another independent deck (for example `new-talk.md`):

1. Add the Markdown (and any images) under `report/slide/`
2. Preview with `npm run build:slide`, or publish with `npm run publish`
3. You do not need to edit `package.json`, add a per-deck build script, or hard-code HTML filenames to copy
4. If visitors should find it from the site, still add a link on the report pages or another entry point

Published URLs look like `/web/report/slide/index.html` and `/web/report/slide/aprigf.html`.

## Output

After `build`, the target worktree contains:

- `index.html` (Traditional Chinese)
- `en.html` (English)
- `img/` (shared assets)
- `slide/` (compiled slide HTML and images)

Sources are `report/index.md`, `report/en.md`, `report/img/`, and `report/slide/`; the `report` branch worktree is the publish output. If you only run `build`, changes stay in the worktree until you run `publish` or handle them manually. Note: `build` does not compile slide Markdown; run `build:slide` first to refresh deck content, or use `publish`, which compiles slides as part of the flow.

## Environment variables

- `REPORT_WORKTREE_PATH`: Override worktree path (repo-relative or absolute); default `report/publish`
- `REPORT_BRANCH`: Target branch; default `report`
- `REPORT_COMMIT_MESSAGE`: Publish commit message; default `Update report`
- `REPORT_REMOTE`: Remote used when no upstream exists; defaults to the repo’s first remote

Examples:

```bash
REPORT_WORKTREE_PATH=report/publish npm run init-worktree
REPORT_WORKTREE_PATH=report/publish npm run build
REPORT_WORKTREE_PATH=report/publish npm run publish
```

## Common errors

### Report worktree not found

Message may look like:

```text
Cannot find a worktree for branch 'report'.
```

Run:

```bash
cd report
npm run init-worktree
```

### Target path exists but is not a worktree

If the default path `report/publish` is a normal folder rather than a git worktree, init stops with instructions. Either:

- Remove or rename that directory
- Or set a different `REPORT_WORKTREE_PATH`

Example:

```bash
REPORT_WORKTREE_PATH=report/site-output npm run init-worktree
```
