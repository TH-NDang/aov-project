// Runs without a browser: a fake one stands in for Chromium. `npm test` in this folder.
import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import { createReaderServer, PAGES } from "./reader.mjs";

const PAGE = { url: "https://example.test/news", ready: 'a[href^="/post/"]' };

/** A browser whose one tab ends the way `behaviour` says: "list", "slow", "fail" or "hang". */
function fakeLaunch(behaviour, seen = {}) {
  return async () => {
    seen.launched = (seen.launched ?? 0) + 1;
    const handlers = {};
    const tab = {
      setRequestInterception: async () => {},
      on: (event, handler) => {
        handlers[event] = handler;
      },
      goto: async (url) => {
        seen.url = url;
        for (const type of ["document", "image", "font", "script"]) {
          handlers.request?.({
            isInterceptResolutionHandled: () => false,
            resourceType: () => type,
            abort: () => (seen.aborted = [...(seen.aborted ?? []), type]),
            continue: () => (seen.continued = [...(seen.continued ?? []), type]),
          });
        }
        if (behaviour === "fail") throw new Error("net::ERR_NAME_NOT_RESOLVED");
      },
      waitForSelector: async () => {
        if (behaviour === "slow") {
          const error = new Error("Waiting for selector failed");
          error.name = "TimeoutError";
          throw error;
        }
        if (behaviour === "hang") await new Promise(() => {});
      },
      evaluate: async () => '<!doctype html>\n<html><body><a href="/post/patch-notes">Patch</a></body></html>',
    };
    return {
      newPage: async () => tab,
      close: async () => {
        seen.closed = (seen.closed ?? 0) + 1;
      },
    };
  };
}

async function start(launch, options = {}) {
  const server = createReaderServer({ launch, pages: { news: PAGE }, log: () => {}, ...options });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  return { server, get: (path, init) => fetch(base + path, init) };
}

test("reads a listed page and closes its browser", async (t) => {
  const seen = {};
  const { server, get } = await start(fakeLaunch("list", seen));
  t.after(() => server.close());

  const response = await get("/render?page=news");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.match(await response.text(), /\/post\/patch-notes/);
  assert.equal(seen.url, PAGE.url);
  assert.deepEqual(seen.aborted, ["image", "font"]);
  assert.deepEqual(seen.continued, ["document", "script"]);
  assert.equal(seen.closed, 1);
});

test("opens only the pages it lists", async (t) => {
  const seen = {};
  const { server, get } = await start(fakeLaunch("list", seen));
  t.after(() => server.close());

  for (const path of ["/render?page=https://evil.test/", "/render?page=__proto__", "/render", "/elsewhere"]) {
    assert.equal((await get(path)).status, 404, path);
  }
  assert.equal((await get("/render?page=news", { method: "POST" })).status, 405);
  assert.equal(seen.launched, undefined);
});

test("answers health without a browser", async (t) => {
  const seen = {};
  const { server, get } = await start(fakeLaunch("list", seen));
  t.after(() => server.close());

  assert.equal((await get("/health")).status, 200);
  assert.equal(seen.launched, undefined);
});

test("a list that never shows is a timeout, a broken page a failure; both close the browser", async (t) => {
  const slow = {};
  const failing = {};
  const hanging = {};
  const a = await start(fakeLaunch("slow", slow));
  const b = await start(fakeLaunch("fail", failing));
  const c = await start(fakeLaunch("hang", hanging), { deadlineMs: 50 });
  t.after(() => [a, b, c].forEach(({ server }) => server.close()));

  assert.equal((await a.get("/render?page=news")).status, 504);
  assert.equal((await b.get("/render?page=news")).status, 502);
  assert.equal((await c.get("/render?page=news")).status, 504);
  assert.equal(slow.closed, 1);
  assert.equal(failing.closed, 1);
  assert.equal(hanging.closed, 1);
});

test("runs one read at a time", async (t) => {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  const launch = async () => {
    await gate;
    return fakeLaunch("list")();
  };
  const { server, get } = await start(launch);
  t.after(() => server.close());

  const first = get("/render?page=news");
  await new Promise((resolve) => setTimeout(resolve, 20));
  const second = await get("/render?page=news");
  assert.equal(second.status, 503);
  assert.equal(second.headers.get("retry-after"), "60");
  release();
  assert.equal((await first).status, 200);
});

test("lists the Indonesian news page and nothing else", () => {
  assert.deepEqual(Object.keys(PAGES), ["garena-id-news"]);
  assert.equal(PAGES["garena-id-news"].url, "https://main.aov.garena.co.id/news/update");
});
