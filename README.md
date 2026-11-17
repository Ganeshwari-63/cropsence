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
