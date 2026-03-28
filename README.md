## Conversation Copilot

Real-time mic transcription with AI suggestions for live conversations. Configure `OPENAI_API_KEY` in `.env.local` (see `.env.example`). Suggestions always use OpenAI; live transcription can use **OpenAI Realtime** (default) or **AssemblyAI** Universal Streaming with speaker labels.

- **OpenAI path (default):** set `OPENAI_API_KEY` only.
- **AssemblyAI path:** set `ASSEMBLYAI_API_KEY`, `TRANSCRIPTION_PROVIDER=assemblyai`, and `NEXT_PUBLIC_TRANSCRIPTION_PROVIDER=assemblyai` (client and server must agree).

In **Settings**, choose **Automatic** suggestions (line cues + pause) or **On demand** (tap **Suggest now**). Open the full transcript drawer to **Download .txt** or **Copy** the session (up to `NEXT_PUBLIC_TRANSCRIPT_SESSION_MAX_LINES`, default 2000).

Developer testing presets appear in development, or set `NEXT_PUBLIC_COPILOT_DEV_TOOLS=true` to enable them in production builds.

## Getting Started

Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

**Microphone:** Browsers only expose the mic on a **secure context** — use `http://localhost` or `https://`. Opening the dev server via `http://192.168.x.x` (the “Network” URL) will **not** work for the microphone until you use HTTPS or a tunnel.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
