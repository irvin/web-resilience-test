For Traditional Chinese documentation, see [`README.zh-TW.md`](README.zh-TW.md).

# Report Build & Publish

This directory contains standalone report build tooling that compiles `report/index.zh-TW.md` into publishable HTML and syncs `report/img` to the `report` branch worktree.

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

### `npm run build`

- Compiles `report/index.zh-TW.md` to `index.html`
- Syncs `report/img` to `img/` in the target worktree
- Default output is the worktree for the `report` branch
- Updates output only; does not `commit` or `push`
- If no worktree is found, prompts you to run `npm run init-worktree` first

### `npm run publish`

- Creates the report worktree automatically if missing
- Runs build to sync the latest HTML and images to the report worktree
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
REPORT_COMMIT_MESSAGE="Publish 2026-03-24 report" npm run report:publish
```

Or inside `report/`:

```bash
cd report
REPORT_COMMIT_MESSAGE="Publish 2026-03-24 report" npm run publish
```

## Output

After `build`, the target worktree contains:

- `index.html`
- `img/`

Sources are `report/index.zh-TW.md` and `report/img/`; the `report` branch worktree root is the publish output. If you only run `build`, changes stay in the worktree until you run `publish` or handle them manually.

## Environment variables

- `REPORT_WORKTREE_PATH`: Override worktree path (repo-relative or absolute); default `report/publish`
- `REPORT_BRANCH`: Target branch; default `report`
- `REPORT_COMMIT_MESSAGE`: Publish commit message; default `Update report`
- `REPORT_REMOTE`: Remote used when no upstream exists; defaults to the repo’s first remote

Examples:

```bash
REPORT_WORKTREE_PATH=report/publish npm run init-worktree
REPORT_WORKTREE_PATH=report/publish npm run build
REPORT_WORKTREE_PATH=report/publish REPORT_COMMIT_MESSAGE="Publish 2026-03-24 report" npm run publish
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
