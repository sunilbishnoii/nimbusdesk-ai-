# 🚀 Deployment Guide — NimbusDesk

This guide explains how to access your project right now and how to deploy it permanently on free cloud platforms (Vercel & Render).

---

## 1. 🌐 Live Public Access (Available Right Now)

Your project is already being served live via a free secure tunnel:

* **Public HTTPS URL**: [https://nine-bushes-sit.loca.lt](https://nine-bushes-sit.loca.lt)
* **Local Computer URL**: [http://localhost:5173/](http://localhost:5173/)
* **Mobile / Same Wi-Fi Network**: [http://172.20.10.7:5173/](http://172.20.10.7:5173/)

*(Note: When opening `loca.lt` for the first time, click "Click to Continue" to enter the app).*

---

## 2. ⚡ Free Permanent Cloud Deployment Options

### Option A: Render (Recommended for Full-Stack Python + RAG)
Render provides a **100% free web service tier** that can host both the Python FastAPI backend and the built frontend together using our included `render.yaml`.

1. Push your repository to [GitHub](https://github.com).
2. Go to [Render.com](https://render.com) and sign in with GitHub.
3. Click **New +** → **Blueprint** (or **Web Service**).
4. Select your repository — Render will automatically read `render.yaml`:
   * **Build Command**: `cd frontend && npm install && npm run build:backend && cd .. && pip install -r backend/requirements.txt`
   * **Start Command**: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Click **Apply** — your app will be live at `https://your-app-name.onrender.com`!

---

### Option B: Vercel (Instant Frontend Hosting)
Vercel offers an ultra-fast global CDN for modern React apps.

1. Push the `frontend` folder or repository to GitHub.
2. Sign in to [Vercel](https://vercel.com) and click **Add New Project**.
3. Select your repository and set the **Root Directory** to `frontend`.
4. Click **Deploy**. Vercel will build and launch your site on a free `*.vercel.app` domain!

---

### Option C: Docker (Any Cloud / VPS)
You can build and deploy the container anywhere with one command:

```bash
docker build -t nimbusdesk backend/
docker run -p 8000:8000 nimbusdesk
```
