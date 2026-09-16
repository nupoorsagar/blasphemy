# Blasphemy — Site Intelligence Auditor

A general-purpose website auditing SaaS focused on **actionable findings instead of a vanity score**.

> What is wrong with my website, why does it matter, and exactly what should I fix?

## Stack

- Next.js + React + TypeScript
- Cheerio-based HTTP crawler
- Playwright browser worker
- OpenAI Responses API for optional AI interpretation
- Vercel for the web app
- Separate worker host recommended for long browser audits

## Repository layout

```text
app/                 Next.js pages + API routes
components/          UI components
lib/                 Types, storage, AI, crawler, rule engine, browser launcher
worker/               Long-running Playwright worker
tests/                Rule/catalog tests
public/               Static assets
```

The files in this repository are already at the **repository root**. Do not nest this project inside another folder when you create the GitHub repo.

## Local Windows setup without admin rights

If your company machine blocks the Node.js installer, use the official Node.js Windows ZIP distribution instead of an MSI installer.

1. Extract Node somewhere you can write, for example:

```text
C:\Users\<you>\Downloads\node-v22.22.3-win-x64
```

2. In Command Prompt, add it to PATH for the current terminal:

```cmd
set PATH=C:\Users\<you>\Downloads\node-v22.22.3-win-x64;%PATH%
```

3. Verify:

```cmd
node -v
npm -v
```

4. From the repository root:

```cmd
npm install
```

### Playwright on managed machines

The worker now tries, in order:

1. `PLAYWRIGHT_EXECUTABLE_PATH`, if supplied
2. an installed Chrome/Edge executable on Windows
3. Playwright-managed Chromium

So a corporate network blocking the Playwright browser download does **not** stop local browser checks when Chrome or Edge is already installed.

You normally do **not** need to run `npx playwright install chromium` locally when Chrome or Edge is detected.

If you do need a Playwright-managed browser on a worker host, run:

```bash
npx playwright install chromium
```

Start the web app:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Run the standalone browser worker when needed:

```bash
npm run worker -- https://example.com 30 local-demo
```

## OpenAI setup

Create `.env.local` in the repository root and add:

```env
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.6-luna
```

The key is read only by server-side code. `.env.local` is ignored by Git.

AI is optional: deterministic findings still work when the key is absent.

## GitHub structure

The GitHub repository should look like this:

```text
blasphemy/
├── app/
├── components/
├── lib/
├── worker/
├── tests/
├── public/
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── README.md
├── ARCHITECTURE.md
└── RULE_ENGINE.md
```

Avoid this structure:

```text
blasphemy/
└── site-intelligence-auditor-github-ready/
    ├── package.json
    └── app/
```

## Deployment direction

### Vercel

Use Vercel for the Next.js UI and short API requests. Set `OPENAI_API_KEY` as a server environment variable.

### Worker

Run `worker/index.ts` on a long-lived worker host for browser-heavy audits. The worker can POST completed results to `/api/audits/:id/complete` using `AUDIT_CALLBACK_SECRET`.

### Production persistence

The current MVP uses an in-memory store so it is easy to run immediately. Before production, replace this with Postgres and a durable job queue. Recommended tables include organizations, users, projects, audits, pages, findings, browser runs, AI analyses, usage, and subscriptions.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

Do not use `npm audit fix --force` during initial setup unless you have reviewed the resulting dependency changes.
