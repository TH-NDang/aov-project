// The page reader opens one publisher page in a headless Chromium, the way a visitor's browser does, and answers with
// the page once its scripts have filled it. wiki-service asks for it by name (patch watch, ADR-035); the reader opens
// no address it is given, only the pages listed here.
import http from "node:http";

/** The pages the reader opens, by the name wiki-service asks for. `ready` appears once the list is filled. */
export const PAGES = Object.freeze({
  "garena-id-news": Object.freeze({
    url: "https://main.aov.garena.co.id/news/update",
    ready: 'a[href^="/post/"]',
  }),
});

/** Pictures, video and fonts are not needed to read a list, so the browser does not download them. */
const SKIPPED_RESOURCES = new Set(["image", "media", "font"]);
const DEFAULT_DEADLINE_MS = 60_000;

/** A page that never showed its list in time: wiki-service records it as unreachable and tries again later. */
export class ReadTimeout extends Error {
  name = "ReadTimeout";
}

/**
 * Opens `page` in a browser started for this read and closed after it, so no cookie or cache outlives one read and
 * the memory goes back once it ends. Answers the page's HTML without its scripts and styles. The deadline covers
 * starting the browser too, so a read always ends well before wiki-service stops waiting for it.
 */
export async function readPage(launch, page, deadlineMs = DEFAULT_DEADLINE_MS) {
  let timer;
  let finished = false;
  let browser;
  const expired = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new ReadTimeout(`no list after ${deadlineMs} ms`)), deadlineMs);
  });
  const read = (async () => {
    const started = await launch();
    if (finished) {
      // The deadline passed while the browser was starting: nobody waits for this one any more.
      await close(started);
      throw new ReadTimeout("the browser started after the deadline");
    }
    browser = started;
    return open(browser, page, deadlineMs);
  })();
  try {
    return await Promise.race([read, expired]);
  } finally {
    finished = true;
    clearTimeout(timer);
    if (browser) await close(browser);
  }
}

async function open(browser, page, deadlineMs) {
  const tab = await browser.newPage();
  await tab.setRequestInterception(true);
  tab.on("request", (request) => {
    if (request.isInterceptResolutionHandled()) return;
    if (SKIPPED_RESOURCES.has(request.resourceType())) {
      request.abort("blockedbyclient");
    } else {
      request.continue();
    }
  });
  try {
    await tab.goto(page.url, { waitUntil: "domcontentloaded", timeout: deadlineMs });
    await tab.waitForSelector(page.ready, { timeout: deadlineMs });
  } catch (error) {
    if (error?.name === "TimeoutError") throw new ReadTimeout(error.message);
    throw error;
  }
  return tab.evaluate(() => {
    for (const node of document.querySelectorAll("script, style, noscript, template, iframe, svg, link")) {
      node.remove();
    }
    return `<!doctype html>\n${document.documentElement.outerHTML}`;
  });
}

async function close(browser) {
  const child = browser.process?.();
  try {
    await Promise.race([browser.close(), new Promise((resolve) => setTimeout(resolve, 5_000))]);
  } catch {
    // The process is ended below either way.
  }
  if (child && child.exitCode === null && !child.killed) {
    child.kill("SIGKILL");
  }
}

/**
 * GET /health answers without starting a browser; GET /render?page=<name> reads one listed page. One read runs at a
 * time; a second one meanwhile is told to come back later.
 */
export function createReaderServer({ launch, pages = PAGES, deadlineMs = DEFAULT_DEADLINE_MS, log = console.log }) {
  let busy = false;

  return http.createServer(async (request, response) => {
    const address = new URL(request.url ?? "/", "http://page-reader");
    if (request.method !== "GET") {
      return answer(response, 405, "only GET", { Allow: "GET" });
    }
    if (address.pathname === "/health") {
      return answer(response, 200, "ok");
    }
    if (address.pathname !== "/render") {
      return answer(response, 404, "not found");
    }
    const name = address.searchParams.get("page") ?? "";
    const page = Object.hasOwn(pages, name) ? pages[name] : undefined;
    if (!page) {
      return answer(response, 404, "unknown page");
    }
    if (busy) {
      return answer(response, 503, "another read is running", { "Retry-After": "60" });
    }

    busy = true;
    const started = Date.now();
    try {
      const html = await readPage(launch, page, deadlineMs);
      log(`${name}: read in ${Date.now() - started} ms, ${html.length} characters`);
      answer(response, 200, html, { "Content-Type": "text/html; charset=utf-8" });
    } catch (error) {
      const timedOut = error instanceof ReadTimeout;
      const reason = `${error?.name ?? "Error"}: ${String(error?.message ?? "").split("\n")[0].slice(0, 200)}`;
      log(`${name}: ${timedOut ? "timed out" : "failed"} after ${Date.now() - started} ms (${reason})`);
      answer(response, timedOut ? 504 : 502, timedOut ? "the page did not show its list in time" : "the page could not be read");
    } finally {
      busy = false;
    }
  });
}

function answer(response, status, body, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  response.end(body);
}
