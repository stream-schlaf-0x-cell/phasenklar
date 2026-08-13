"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type BoardSettings = {
  socialForm: string;
  volume: number;
  minutes: number;
  result: string;
  next: string;
  visibleCount: number;
};

const DEFAULTS: BoardSettings = {
  socialForm: "Gruppenarbeit",
  volume: 2,
  minutes: 12,
  result: "3 begründete Thesen",
  next: "Material zurück · Blick nach vorn",
  visibleCount: 5,
};

const SOCIAL_FORMS = [
  "Einzelarbeit",
  "Partnerarbeit",
  "Gruppenarbeit",
  "Freiarbeit / SOL",
  "Plenum",
];

const VOLUMES = [
  { level: 0, title: "Ruhe", note: "Niemand spricht" },
  { level: 1, title: "Flüstern", note: "Nur die Person neben dir hört dich" },
  { level: 2, title: "Gruppentisch", note: "Nur die eigene Gruppe hört euch" },
  { level: 3, title: "Präsentation", note: "Der ganze Raum hört zu" },
];

const STAGES = [
  { count: 2, title: "Start", note: "Sozialform + Lautstärke" },
  { count: 3, title: "+ Zeit", note: "Arbeitsrahmen ergänzen" },
  { count: 4, title: "+ Ergebnis", note: "Ziel sichtbar machen" },
  { count: 5, title: "Alle 5", note: "Vollständige Routine" },
];

const STORAGE_KEY = "phasenklar-board-v1";

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function CardNumber({ number }: { number: number }) {
  return <span className="card-number" aria-hidden="true">{number}</span>;
}

export default function Home() {
  const [settings, setSettings] = useState<BoardSettings>(DEFAULTS);
  const [draft, setDraft] = useState<BoardSettings>(DEFAULTS);
  const [panelOpen, setPanelOpen] = useState(false);
  const [attention, setAttention] = useState(false);
  const [remaining, setRemaining] = useState(DEFAULTS.minutes * 60);
  const [running, setRunning] = useState(false);
  const deadlineRef = useRef<number | null>(null);

  const volume = VOLUMES[settings.volume] ?? VOLUMES[2];
  const totalSeconds = settings.minutes * 60;
  const progress = totalSeconds > 0 ? Math.max(0, remaining / totalSeconds) : 0;
  const isFinished = remaining === 0;

  useEffect(() => {
    const restore = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = { ...DEFAULTS, ...JSON.parse(saved) } as BoardSettings;
          setSettings(parsed);
          setDraft(parsed);
          setRemaining(parsed.minutes * 60);
        } else {
          setPanelOpen(true);
        }
      } catch {
        setPanelOpen(true);
      }
    }, 0);
    return () => window.clearTimeout(restore);
  }, []);

  useEffect(() => {
    if (!running || deadlineRef.current === null) return;
    const update = () => {
      const next = Math.max(0, Math.ceil((deadlineRef.current! - Date.now()) / 1000));
      setRemaining(next);
      if (next === 0) {
        setRunning(false);
        deadlineRef.current = null;
      }
    };
    update();
    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [running]);

  const toggleTimer = useCallback(() => {
    if (running) {
      if (deadlineRef.current !== null) {
        setRemaining(Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000)));
      }
      deadlineRef.current = null;
      setRunning(false);
      return;
    }
    const startFrom = remaining === 0 ? settings.minutes * 60 : remaining;
    setRemaining(startFrom);
    deadlineRef.current = Date.now() + startFrom * 1000;
    setRunning(true);
  }, [remaining, running, settings.minutes]);

  const resetTimer = useCallback(() => {
    deadlineRef.current = null;
    setRunning(false);
    setRemaining(settings.minutes * 60);
  }, [settings.minutes]);

  const addMinute = useCallback(() => {
    setRemaining((current) => current + 60);
    if (running && deadlineRef.current !== null) deadlineRef.current += 60_000;
  }, [running]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, button")) return;
      if (event.key === " " && !panelOpen && !attention) {
        event.preventDefault();
        toggleTimer();
      }
      if (event.key.toLowerCase() === "s" && !panelOpen) setAttention((value) => !value);
      if (event.key === "Escape") {
        setAttention(false);
        setPanelOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [attention, panelOpen, toggleTimer]);

  const openPanel = () => {
    setDraft(settings);
    setPanelOpen(true);
  };

  const applySettings = () => {
    const clean: BoardSettings = {
      ...draft,
      minutes: Math.min(120, Math.max(1, Number(draft.minutes) || 1)),
      result: draft.result.trim() || "Ergebnis sichern",
      next: draft.next.trim() || "Blick nach vorn",
    };
    setSettings(clean);
    setDraft(clean);
    setRemaining(clean.minutes * 60);
    setRunning(false);
    deadlineRef.current = null;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    setPanelOpen(false);
  };

  const requestFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Fullscreen can be unavailable in embedded browser contexts.
    }
  };

  return (
    <main className={`app-shell stage-${settings.visibleCount}`}>
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
          <div>
            <p className="brand">PHASENKLAR</p>
            <p className="brand-subline">Was jetzt gilt</p>
          </div>
        </div>
        <div className="top-actions">
          <button className="quiet-button attention-button" onClick={() => setAttention(true)}><span aria-hidden="true">●</span> Stopp</button>
          <button className="quiet-button" onClick={openPanel}><span aria-hidden="true">✎</span> Bearbeiten</button>
          <button className="icon-button" onClick={requestFullscreen} aria-label="Vollbild ein- oder ausschalten" title="Vollbild"><span aria-hidden="true">⛶</span></button>
        </div>
      </header>

      <section className="board" aria-label="Aktuelle Arbeitsphase">
        {settings.visibleCount >= 1 && (
          <article className="phase-card social-card">
            <div className="card-heading"><CardNumber number={1} /><span>Sozialform</span></div>
            <div className="card-content">
              <span className="social-symbol" aria-hidden="true">{settings.socialForm === "Einzelarbeit" ? "1" : settings.socialForm === "Partnerarbeit" ? "2" : settings.socialForm === "Plenum" ? "○" : "4"}</span>
              <h2>{settings.socialForm}</h2>
              <p>{settings.socialForm === "Gruppenarbeit" ? "Die Tische bleiben stehen" : settings.socialForm === "Freiarbeit / SOL" ? "Arbeitsplan prüfen · ersten Schritt wählen" : "Beginnt nach der Freigabe"}</p>
            </div>
          </article>
        )}

        {settings.visibleCount >= 2 && (
          <article className={`phase-card volume-card volume-${volume.level}`}>
            <div className="card-heading"><CardNumber number={2} /><span>Lautstärke</span></div>
            <div className="card-content">
              <span className="volume-level">{volume.level}</span>
              <div><h2>{volume.title}</h2><p>{volume.note}</p></div>
            </div>
          </article>
        )}

        {settings.visibleCount >= 3 && (
          <article className={`phase-card timer-card ${isFinished ? "timer-finished" : ""}`}>
            <div className="card-heading"><CardNumber number={3} /><span>Zeit</span></div>
            <div className="timer-main">
              <p className="timer-display" aria-live="polite">{formatTime(remaining)}</p>
              <p className="timer-status">{isFinished ? "Zeit ist um" : running ? "läuft" : "bereit"}</p>
            </div>
            <div className="timer-progress" aria-hidden="true"><span style={{ width: `${progress * 100}%` }} /></div>
            <div className="timer-controls">
              <button className="primary-timer" onClick={toggleTimer}>{running ? "Pause" : isFinished ? "Noch einmal" : "Start"}</button>
              <button onClick={addMinute}>+ 1 Min</button>
              <button onClick={resetTimer}>Neu</button>
            </div>
          </article>
        )}

        {settings.visibleCount >= 4 && (
          <article className="phase-card result-card">
            <div className="card-heading"><CardNumber number={4} /><span>Ergebnis</span></div>
            <div className="statement-content">
              <span className="statement-kicker">Am Ende liegt vor:</span>
              <h2>{settings.result}</h2>
              <p>Alle müssen das Ergebnis erklären können.</p>
            </div>
          </article>
        )}

        {settings.visibleCount >= 5 && (
          <article className="phase-card next-card">
            <div className="card-heading"><CardNumber number={5} /><span>Danach</span></div>
            <div className="statement-content">
              <span className="arrow-symbol" aria-hidden="true">→</span>
              <h2>{settings.next}</h2>
              <p>Erst abschließen, dann wechseln.</p>
            </div>
          </article>
        )}
      </section>

      {attention && (
        <section className="attention-overlay" role="dialog" aria-modal="true" aria-labelledby="attention-title">
          <button className="attention-close" onClick={() => setAttention(false)} aria-label="Stoppsignal schließen">×</button>
          <p className="attention-eyebrow">STOPP</p>
          <div className="attention-zero" aria-hidden="true">0</div>
          <h2 id="attention-title">Lautstärke 0</h2>
          <p>Hände leer · Blick nach vorn</p>
          <span className="attention-hint">Zum Schließen klicken oder S drücken</span>
        </section>
      )}

      {panelOpen && (
        <div className="panel-backdrop" role="presentation">
          <section className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <div className="panel-header">
              <div><p className="panel-eyebrow">Phase vorbereiten</p><h2 id="settings-title">Was soll jetzt gelten?</h2></div>
              <button className="panel-close" onClick={() => setPanelOpen(false)} aria-label="Bearbeiten schließen">×</button>
            </div>

            <div className="settings-grid">
              <fieldset className="setting-section stage-section">
                <legend>Nach und nach einführen</legend>
                <p className="setting-help">Zeige zunächst nur wenige Erwartungen. Ergänze die nächste Karte, sobald die vorherigen Begriffe sitzen.</p>
                <div className="stage-options">
                  {STAGES.map((stage) => (
                    <button key={stage.count} className={draft.visibleCount === stage.count ? "selected" : ""} onClick={() => setDraft({ ...draft, visibleCount: stage.count })}>
                      <strong>{stage.title}</strong><span>{stage.note}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="setting-section">
                <span className="setting-label"><b>1</b> Sozialform</span>
                <select value={draft.socialForm} onChange={(event) => setDraft({ ...draft, socialForm: event.target.value })}>
                  {SOCIAL_FORMS.map((form) => <option key={form}>{form}</option>)}
                </select>
              </label>

              <fieldset className="setting-section">
                <legend><b>2</b> Lautstärke</legend>
                <div className="volume-options">
                  {VOLUMES.map((item) => (
                    <button key={item.level} className={draft.volume === item.level ? "selected" : ""} onClick={() => setDraft({ ...draft, volume: item.level })}>
                      <span>{item.level}</span><strong>{item.title}</strong>
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="setting-section time-setting">
                <legend><b>3</b> Zeit</legend>
                <div className="minute-presets">
                  {[5, 10, 12, 15, 20, 30].map((minutes) => (
                    <button key={minutes} className={draft.minutes === minutes ? "selected" : ""} onClick={() => setDraft({ ...draft, minutes })}>{minutes} Min</button>
                  ))}
                </div>
                <label className="custom-minutes">Eigene Zeit <input type="number" min="1" max="120" value={draft.minutes} onChange={(event) => setDraft({ ...draft, minutes: Number(event.target.value) })} /> Min</label>
              </fieldset>

              <label className="setting-section text-setting">
                <span className="setting-label"><b>4</b> Ergebnis</span>
                <textarea maxLength={90} rows={2} value={draft.result} onChange={(event) => setDraft({ ...draft, result: event.target.value })} placeholder="z. B. 3 begründete Thesen" />
                <span className="character-count">{draft.result.length}/90</span>
              </label>

              <label className="setting-section text-setting">
                <span className="setting-label"><b>5</b> Danach</span>
                <textarea maxLength={90} rows={2} value={draft.next} onChange={(event) => setDraft({ ...draft, next: event.target.value })} placeholder="z. B. Material zurück · Blick nach vorn" />
                <span className="character-count">{draft.next.length}/90</span>
              </label>
            </div>

            <div className="panel-footer">
              <p>Die Angaben bleiben ausschließlich in diesem Browser gespeichert.</p>
              <button className="apply-button" onClick={applySettings}>Anzeige übernehmen</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
