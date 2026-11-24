# Frontend (React + TypeScript + Vite)
```bash
cp .env.example .env && npm install
npm run mock    # fake API on :8000 (no Python needed)
npm run dev     # http://localhost:5173
npm run build   # type-check + production build
```
Read `CLAUDE.md` (what to build) and `../docs/API_CONTRACT.md` (the API).

npm run build:backend   # builds into ../backend/static, which the backend serves at http://127.0.0.1:8000
