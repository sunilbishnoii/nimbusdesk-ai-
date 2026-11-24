# How we work together (2 people, GitHub)

## Ownership - prevents merge conflicts
| Folder | Who edits it |
|---|---|
| `frontend/` | friend only |
| `backend/`, `docs/` | Sunil only |
| `README.md`, `CONTRIBUTING.md` | either, via PR |

If you need something changed in the other person's folder, **open a GitHub Issue** (or message) - don't edit their files.

## Branches and pull requests
- `main` is always working. Nobody pushes to `main` directly.
- Create a branch per task: `frontend/lead-detail-page`, `backend/improve-thresholds`.
- Commit small and often with clear messages: `Add lead detail page`, not `update`.
- Open a Pull Request into `main`; the other person reviews (even a quick look) and merges.
- Before starting work each day: `git checkout main && git pull`, then branch.

## Changing the API (the one thing that needs both of you)
1. Sunil changes the backend, runs `python scripts/export_contract.py` (from `backend/`), updates `docs/API_CONTRACT.md`, merges.
2. Friend pulls, updates `frontend/src/types.ts`, `src/api.ts` and `frontend/mock/server.mjs` to match.
3. Never rename or remove a field without telling the other person first. Adding new optional fields is safe.

## Setting up the repo on GitHub (once, by Sunil)
1. GitHub -> New repository (private), no README. 2. In the project folder:
```
git init -b main
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main
```
3. Repo -> Settings -> Collaborators -> invite your friend. 4. Settings -> Branches -> add rule for `main`: "Require a pull request before merging".

## Never commit
`.env`, `node_modules/`, `.venv/`, `*.db`, the Bitext CSV, API keys.
