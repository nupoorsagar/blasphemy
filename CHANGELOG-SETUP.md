# Blasphemy setup changes

This package is the replacement for the previously nested `site-intelligence-auditor-github-ready` folder.

## Changes in this package

1. Project files are ready to sit directly at the `blasphemy` repository root.
2. Added `lib/browser.ts` with a browser-launch strategy for managed Windows machines:
   - `PLAYWRIGHT_EXECUTABLE_PATH` first
   - installed Google Chrome
   - installed Microsoft Edge
   - Playwright-managed Chromium as fallback
3. Updated `worker/index.ts` to use the shared browser launcher and record which browser source was used.
4. Updated `.env.example` with browser configuration and safer server-only OpenAI guidance.
5. Updated `README.md` with exact Windows/no-admin setup and repository layout guidance.
6. Removed the generated `tsconfig.tsbuildinfo` artifact so GitHub receives source/config rather than local build cache.

## Local repo migration

Your current checkout is:

```text
blasphemy/
└── site-intelligence-auditor-github-ready/
```

After applying this package, it should become:

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

Do not copy `.env.local` into GitHub.
