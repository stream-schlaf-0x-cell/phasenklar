import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../docs/", import.meta.url);

test("GitHub Pages contains the complete standalone app", async () => {
  const [html, css, script] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("styles.css", root), "utf8"),
    readFile(new URL("app.js", root), "utf8"),
  ]);

  for (const label of ["Sozialform", "Lautstärke", "Zeit", "Ergebnis", "Danach"]) {
    assert.match(html, new RegExp(label));
  }
  assert.match(html, /id="timer-display"/);
  assert.match(html, /id="settings-open"/);
  assert.match(html, /id="attention-overlay"/);
  assert.match(css, /height:\s*100dvh/);
  assert.match(css, /grid-template-columns:\s*repeat\(12/);
  assert.match(script, /window\.localStorage/);
  assert.match(script, /requestFullscreen/);
  assert.doesNotMatch(script, /fetch\(|XMLHttpRequest|analytics/i);
  assert.doesNotMatch(html, /README|Lokale Entwicklung/);
});
