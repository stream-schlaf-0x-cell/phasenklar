import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../docs/", import.meta.url);

test("GitHub Pages contains the complete standalone app", async () => {
  const [html, css, script, manifestText, serviceWorker, icon192, icon512] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("styles.css", root), "utf8"),
    readFile(new URL("app.js", root), "utf8"),
    readFile(new URL("manifest.webmanifest", root), "utf8"),
    readFile(new URL("sw.js", root), "utf8"),
    readFile(new URL("icon-192.png", root)),
    readFile(new URL("icon-512.png", root)),
  ]);

  for (const label of ["Sozialform", "Lautstärke", "Zeit", "Ergebnis", "Danach"]) {
    assert.match(html, new RegExp(label));
  }
  assert.match(html, /id="timer-display"/);
  assert.match(html, /id="settings-open"/);
  assert.match(html, /id="attention-overlay"/);
  assert.match(html, /id="volume-guide-overlay"/);
  assert.match(html, /id="history-section"/);
  assert.match(html, /id="group-size-options"/);
  assert.match(html, /rel="manifest"/);
  assert.match(html, /data-setting="3"/);
  assert.match(html, /data-setting="4"/);
  assert.match(html, /data-setting="5"/);
  assert.match(css, /height:\s*100dvh/);
  assert.match(css, /grid-template-columns:\s*repeat\(12/);
  assert.match(css, /background:\s*radial-gradient\(circle at 50% 42%/);
  assert.match(css, /\.timer-warning:not\(\.timer-finished\)/);
  assert.match(css, /\.volume-guide-grid/);
  assert.match(css, /\.history-options/);
  assert.doesNotMatch(css, /\.attention-overlay\s*\{[^}]*background:\s*#aa3b28/s);
  assert.match(script, /window\.localStorage/);
  assert.match(script, /const TIMER_KEY = "phasenklar-timer-v1"/);
  assert.match(script, /const HISTORY_KEY = "phasenklar-history-v1"/);
  assert.match(script, /GROUP_SIZES = \[3, 4, 5, 6\]/);
  assert.match(script, /slice\(0, 5\)/);
  assert.match(script, /function showAttention\(\)\s*\{\s*if \(running\) stopTimer\(\)/s);
  assert.match(script, /navigator\.serviceWorker\.register\("\.\/sw\.js"\)/);
  assert.match(script, /requestFullscreen/);
  assert.match(script, /function renderSettingsStage\(\)/);
  assert.match(script, /Number\(section\.dataset\.setting\) > draft\.visibleCount/);
  assert.doesNotMatch(script, /fetch\(|XMLHttpRequest|analytics/i);
  assert.doesNotMatch(html, /README|Lokale Entwicklung/);

  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.display, "standalone");
  assert.deepEqual(manifest.icons.map((icon) => icon.sizes), ["192x192", "512x512"]);
  assert.equal(icon192.readUInt32BE(16), 192);
  assert.equal(icon192.readUInt32BE(20), 192);
  assert.equal(icon512.readUInt32BE(16), 512);
  assert.equal(icon512.readUInt32BE(20), 512);
  assert.match(serviceWorker, /const CORE_ASSETS/);
  assert.match(serviceWorker, /caches\.open\(CACHE_NAME\)/);
  assert.match(serviceWorker, /request\.mode === "navigate"/);
});

test("the React app mirrors progressive settings and the calmer stop signal", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  for (const threshold of [3, 4, 5]) {
    assert.match(source, new RegExp(`draft\\.visibleCount >= ${threshold}`));
  }
  assert.match(source, /history\.filter/);
  assert.match(source, /\.slice\(0, 5\)/);
  assert.match(source, /settings\.socialForm === "Gruppenarbeit"/);
  assert.match(source, /timer-warning/);
  assert.match(source, /volumeGuideOpen/);
  assert.match(css, /background:\s*radial-gradient\(circle at 50% 42%/);
  assert.match(css, /\.timer-warning:not\(\.timer-finished\)/);
  assert.doesNotMatch(css, /\.attention-overlay\s*\{[^}]*background:\s*#aa3b28/s);
});
