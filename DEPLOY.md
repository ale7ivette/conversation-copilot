# Deploying Conversation Copilot

This app is **Next.js 15** (`npm run build` / `npm run start`). Deploy like any Next app: set **environment variables** on the host and serve over **HTTPS** (required for microphone and screen/tab audio in the browser).

## Vercel (recommended)

1. Push this repo to **GitHub**, **GitLab**, or **Bitbucket**.
2. Sign in at [vercel.com](https://vercel.com) and **Add New Project** → import the repo. Framework: **Next.js** (auto-detected).
3. Under **Settings → Environment Variables**, add for **Production** (and **Preview** if you want previews to work):
   - **`OPENAI_API_KEY`** — required for copilot suggestions (and for OpenAI Realtime transcription if you use the default path).
   - **Transcription (optional):** default is OpenAI Realtime. For **AssemblyAI** streaming + diarization, add **`ASSEMBLYAI_API_KEY`**, **`TRANSCRIPTION_PROVIDER=assemblyai`**, and **`NEXT_PUBLIC_TRANSCRIPTION_PROVIDER=assemblyai`** (keep those two provider values identical).
   - Optional (see `.env.example`): `NEXT_PUBLIC_TRANSCRIPT_SESSION_MAX_LINES`, `TRANSCRIPTION_LANGUAGE`, `REALTIME_TRANSCRIPTION_MODEL`, `REALTIME_INPUT_NOISE_REDUCTION`, `NEXT_PUBLIC_ASSEMBLYAI_SPEECH_MODEL`.
4. Deploy. You get a URL like `https://your-project.vercel.app`.

**Architecture:** `/api/copilot-suggest` uses your OpenAI key on the server. For listening, either `/api/realtime-token` returns short-lived Realtime client secrets, or `/api/assemblyai-streaming-token` returns a short-lived AssemblyAI streaming token; the browser never sees your long-lived provider secrets.

## Other hosts

| Host | Approach |
|------|----------|
| **Netlify** | Next.js runtime; set the same env vars in the project settings. |
| **Railway / Render / Fly.io** | Build: `npm run build`. Start: `npm run start`. Set `PORT` if the platform requires it; expose the app port (often 3000). |
| **VPS** | `git clone`, `npm ci`, `npm run build`, `npm run start` behind **nginx** or **Caddy** with **TLS** (e.g. Let’s Encrypt). |

## Go-live checklist

- **HTTPS** on the public URL. Mic and tab capture fail on non-secure `http://` (except `localhost`).
- **Secrets** only in the host’s environment UI, not in Git. This repo’s `.gitignore` ignores `.env*` except `.env.example`.
- **OpenAI** billing and model access match the key you deploy.
- **Custom domain** (optional): add the domain in the host and update DNS as instructed.

## Local production check

```bash
npm run build
npm run start
```

Open `http://localhost:3000` for a local smoke test. Production must use HTTPS.
