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
  assert.match(html, /data-setting="3"/);
  assert.match(html, /data-setting="4"/);
  assert.match(html, /data-setting="5"/);
  assert.match(css, /height:\s*100dvh/);
  assert.match(css, /grid-template-columns:\s*repeat\(12/);
  assert.match(css, /background:\s*radial-gradient\(circle at 50% 42%/);
  assert.doesNotMatch(css, /\.attention-overlay\s*\{[^}]*background:\s*#aa3b28/s);
  assert.match(script, /window\.localStorage/);
  assert.match(script, /requestFullscreen/);
  assert.match(script, /function renderSettingsStage\(\)/);
  assert.match(script, /Number\(section\.dataset\.setting\) > draft\.visibleCount/);
  assert.doesNotMatch(script, /fetch\(|XMLHttpRequest|analytics/i);
  assert.doesNotMatch(html, /README|Lokale Entwicklung/);
});

test("the React app mirrors progressive settings and the calmer stop signal", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  for (const threshold of [3, 4, 5]) {
    assert.match(source, new RegExp(`draft\\.visibleCount >= ${threshold}`));
  }
  assert.match(css, /background:\s*radial-gradient\(circle at 50% 42%/);
  assert.doesNotMatch(css, /\.attention-overlay\s*\{[^}]*background:\s*#aa3b28/s);
});
