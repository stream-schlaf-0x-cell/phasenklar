import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the Phasenklar classroom board", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]*lang="de"/i);
  assert.match(html, /<title>Phasenklar – Arbeitsphasen eindeutig anzeigen<\/title>/i);
  assert.match(html, /PHASENKLAR/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);

  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  for (const label of ["Sozialform", "Lautstärke", "Zeit", "Ergebnis", "Danach"]) {
    assert.match(source, new RegExp(label));
  }
  assert.match(source, /window\.localStorage/);
  assert.match(source, /const TIMER_KEY = "phasenklar-timer-v1"/);
  assert.match(source, /const HISTORY_KEY = "phasenklar-history-v1"/);
  assert.match(source, /GROUP_SIZES = \[3, 4, 5, 6\]/);
  assert.match(source, /navigator\.serviceWorker\.register/);
  assert.match(source, /pauseTimer\(\);\s*setAttention\(true\)/s);
  assert.match(source, /Die vier Lautstärken/);
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|analytics/i);
});
