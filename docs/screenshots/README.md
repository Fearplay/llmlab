# README screenshots

The four PNG files show the current web app at 1440 × 1100 in English and Czech,
using the light theme, a synthetic Ollama model catalog, and empty runs and
documents. They illustrate the UI; model availability and statistics are not
measurements from a real provider.

Start LLMLab with `python start.py`. Use an isolated [Playwright CLI](https://github.com/microsoft/playwright-cli)
session opened on a blank page, then run the checked-in capture function:

```powershell
npx.cmd --yes --package @playwright/cli playwright-cli -s=readme open about:blank
npx.cmd --yes --package @playwright/cli playwright-cli -s=readme run-code --filename scripts/capture-readme-screenshots.js
npx.cmd --yes --package @playwright/cli playwright-cli -s=readme close
```

On macOS/Linux use `npx` instead of `npx.cmd`. Run from the repository root.
Always begin with a new session; close any old `readme` session before rerunning.

The capture script clears browser storage, mocks every allowed API response
before navigating, blocks unknown API calls and external requests, and never
submits a prompt or document. No real API records, credentials, browser profile,
or Ollama catalog are used. The development-only Next.js launcher is hidden to
keep it from covering the sidebar footer; application content is unchanged.
Inspect all four images before committing them. CLI traces remain in the ignored
`.playwright-cli` directory.
