import fs from 'node:fs';
import { chromium, type Browser } from 'playwright';

function windowsChromeCandidates() {
  const localAppData = process.env.LOCALAPPDATA;
  const programFiles = process.env.PROGRAMFILES;
  const programFilesX86 = process.env['PROGRAMFILES(X86)'];
  return [
    process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    localAppData ? `${localAppData}\\Google\\Chrome\\Application\\chrome.exe` : undefined,
    programFiles ? `${programFiles}\\Google\\Chrome\\Application\\chrome.exe` : undefined,
    programFilesX86 ? `${programFilesX86}\\Google\\Chrome\\Application\\chrome.exe` : undefined,
    localAppData ? `${localAppData}\\Microsoft\\Edge\\Application\\msedge.exe` : undefined,
    programFiles ? `${programFiles}\\Microsoft\\Edge\\Application\\msedge.exe` : undefined,
    programFilesX86 ? `${programFilesX86}\\Microsoft\\Edge\\Application\\msedge.exe` : undefined,
  ].filter((value): value is string => Boolean(value));
}

export async function launchAuditBrowser(): Promise<{ browser: Browser; source: string }> {
  const explicit = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  if (explicit) {
    if (!fs.existsSync(explicit)) {
      throw new Error(`PLAYWRIGHT_EXECUTABLE_PATH does not exist: ${explicit}`);
    }
    return { browser: await chromium.launch({ headless: true, executablePath: explicit }), source: explicit };
  }

  // Prefer an already-installed browser for local/company-managed machines.
  for (const executablePath of windowsChromeCandidates()) {
    if (!fs.existsSync(executablePath)) continue;
    try {
      return { browser: await chromium.launch({ headless: true, executablePath }), source: executablePath };
    } catch {
      // Try the next installed browser.
    }
  }

  // Playwright-managed Chromium is the portable fallback for CI/worker hosts.
  try {
    return { browser: await chromium.launch({ headless: true }), source: 'playwright-managed-chromium' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown browser launch error';
    throw new Error(
      'No usable browser was found. Install Chrome/Edge, set PLAYWRIGHT_EXECUTABLE_PATH, or run `npx playwright install chromium`. ' + message,
    );
  }
}
