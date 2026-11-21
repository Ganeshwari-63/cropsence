# CropSense

CropSense is a React and Vite web app with an Express API for practical farming tools. The interface includes Home, Weather, Crop Recommendation, Disease Check, Yield Estimation, and About pages, with support for multiple Indian languages.

## Requirements

- Node.js 22 or newer
- npm
- A Gemini API key for live leaf photo analysis (the rest of the app can run without it)

## Run locally on Windows

Open the CropSense folder in VS Code. Run the API and the website in two separate terminals.

### 1. Start the API

In the first terminal:

```powershell
cd server
npm install
Copy-Item .env.example .env
notepad .env
```

Add your Gemini key to `GEMINI_API_KEY=` in the `.env` file, save it, then return to the terminal and run:

```powershell
npm run dev
```

The API listens on `http://localhost:8787`.

### 2. Start the website

Open a second terminal in VS Code:

```powershell
cd client
npm install
npm run dev
```

Open the local address printed by Vite, usually `http://localhost:5173`.

Vite forwards `/api` requests to the local API. Keep both terminals open while using the app.

## Environment settings

`server/.env.example` lists the supported server settings. Copy it to `server/.env` and add your own key. Never commit `.env` or share your API key. The repository ignore rules exclude environment files and dependency folders.

## Media

The rice-field and feature videos are in `client/public/videos/`. The files are included with the project.

## Publish on Render

The included `render.yaml` deploys the website and API as one Node service. This keeps photo analysis behind the server, where the Gemini key is stored, and serves the site and API from one HTTPS origin.

1. Push this repository to the GitHub account you want to deploy from.
2. In Render, choose **New → Blueprint** and connect the repository.
3. Review the `cropsense` service. Add your Gemini API key as the `GEMINI_API_KEY` secret when prompted; do not add it to a source file.
4. Deploy. Render builds the client, starts the API, and checks `/api/health` before routing traffic.

Render assigns a public `onrender.com` address and provides HTTPS. The Blueprint uses the free plan to avoid setting up a paid service automatically. Free services pause after 15 minutes without traffic and can take about a minute to start again. Render describes free instances as suitable for previews and hobby projects, not production. For an always-on public launch, select a paid service plan after reviewing the current price and usage terms. Render's current free plan also supports custom domains.

The public service enables browser security headers, HTTPS-only transport in production, same-origin API calls, request-size validation, and per-address rate limits. `TRUST_PROXY_HOPS=1` is set for Render's reverse proxy. If you host somewhere else, set `TRUST_PROXY_HOPS` and `CLIENT_ORIGINS` for that provider and your exact site origin.
