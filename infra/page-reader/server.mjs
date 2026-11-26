// Entry point of the page-reader container (infra/compose.yaml). `node server.mjs --self-check` starts Chromium once
// and exits, so an image whose browser cannot start fails its build check instead of the morning read.
import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";
import { createReaderServer } from "./reader.mjs";

const executablePath =
  process.env.CHROME_PATH ?? ["/usr/bin/chromium", "/usr/bin/chromium-browser"].find((path) => existsSync(path));
if (!executablePath) {
  console.error("No Chromium found; set CHROME_PATH.");
  process.exit(1);
}

// No sandbox inside the container (it is the sandbox), no GPU, and /tmp instead of a small /dev/shm. The browser keeps
// its own user agent: the reader does not pretend to be anything else.
const launch = () =>
  puppeteer.launch({
    executablePath,
    headless: true,
    protocolTimeout: 60_000,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--no-first-run", "--mute-audio"],
  });

if (process.argv.includes("--self-check")) {
  const browser = await launch();
  try {
    const tab = await browser.newPage();
    await tab.setContent('<a href="/post/self-check">ok</a>');
    const found = await tab.$eval('a[href^="/post/"]', (link) => link.textContent);
    if (found !== "ok") throw new Error("the browser did not read the test page");
    console.log(`Chromium ${await browser.version()} starts and reads pages.`);
  } finally {
    await browser.close();
  }
  process.exit(0);
}

const port = Number(process.env.PORT ?? 8095);
const server = createReaderServer({ launch });
server.listen(port, () => console.log(`page-reader listens on ${port}`));

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
