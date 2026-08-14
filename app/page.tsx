"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type BoardSettings = {
  socialForm: string;
  groupSize: number;
  volume: number;
  minutes: number;
  result: string;
  next: string;
  visibleCount: number;
};

type TimerSnapshot = {
  remaining: number;
  running: boolean;
  endAt: number | null;
  minutes: number;
};

const SOCIAL_FORMS = [
  "Einzelarbeit",
  "Partnerarbeit",
  "Gruppenarbeit",
  "Freiarbeit / SOL",
  "Plenum",
];

const GROUP_SIZES = [3, 4, 5, 6];

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

const DEFAULTS: BoardSettings = {
  socialForm: "Gruppenarbeit",
  groupSize: 4,
  volume: 2,
  minutes: 12,
  result: "3 begründete Thesen",
  next: "Material zurück · Blick nach vorn",
  visibleCount: 5,
};

const STORAGE_KEY = "phasenklar-board-v1";
const TIMER_KEY = "phasenklar-timer-v1";
const HISTORY_KEY = "phasenklar-history-v1";

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function normalizeSettings(value: Partial<BoardSettings> = {}): BoardSettings {
  const merged = { ...DEFAULTS, ...value };
  const groupSize = GROUP_SIZES.includes(Number(merged.groupSize)) ? Number(merged.groupSize) : DEFAULTS.groupSize;
  const volume = Math.min(3, Math.max(0, Number(merged.volume) || 0));
  const minutes = Math.min(120, Math.max(1, Number(merged.minutes) || DEFAULTS.minutes));
  const visibleCount = [2, 3, 4, 5].includes(Number(merged.visibleCount)) ? Number(merged.visibleCount) : DEFAULTS.visibleCount;

  return {
    socialForm: SOCIAL_FORMS.includes(merged.socialForm) ? merged.socialForm : DEFAULTS.socialForm,
    groupSize,
    volume,
    minutes,
    result: typeof merged.result === "string" && merged.result.trim() ? merged.result.trim() : DEFAULTS.result,
    next: typeof merged.next === "string" && merged.next.trim() ? merged.next.trim() : DEFAULTS.next,
    visibleCount,
  };
}

function saveTimerSnapshot(snapshot: TimerSnapshot) {
  try {
    window.localStorage.setItem(TIMER_KEY, JSON.stringify(snapshot));
  } catch {
    // Local storage can be unavailable in restricted browser modes.
  }
}

function CardNumber({ number }: { number: number }) {
  return <span className="card-number" aria-hidden="true">{number}</span>;
}

function VolumeMeter({ level }: { level: number }) {
  return (
    <span className="volume-meter" aria-hidden="true">
      <span className="volume-meter-bars">
        {[3, 2, 1, 0].map((segment) => (
          <span
            key={segment}
            className={`volume-meter-segment segment-${segment} ${level >= segment ? "active" : ""}`}
          />
        ))}
      </span>
      <span className="volume-meter-value">Stufe <b>{level}</b></span>
    </span>
  );
}

export default function Home() {
  const [settings, setSettings] = useState<BoardSettings>(DEFAULTS);
  const [draft, setDraft] = useState<BoardSettings>(DEFAULTS);
  const [history, setHistory] = useState<BoardSettings[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [attention, setAttention] = useState(false);
  const [volumeGuideOpen, setVolumeGuideOpen] = useState(false);
  const [remaining, setRemaining] = useState(DEFAULTS.minutes * 60);
  const [running, setRunning] = useState(false);
  const deadlineRef = useRef<number | null>(null);

  const volume = VOLUMES[settings.volume] ?? VOLUMES[2];
  const totalSeconds = settings.minutes * 60;
  const progress = totalSeconds > 0 ? Math.max(0, remaining / totalSeconds) : 0;
  const isFinished = remaining === 0;
  const warningAt = totalSeconds <= 5 * 60 ? 60 : 2 * 60;
  const isWarning = !isFinished && remaining <= warningAt && (running || remaining !== totalSeconds);
  const isPaused = !running && !isFinished && remaining !== totalSeconds;

  useEffect(() => {
    const restore = window.setTimeout(() => {
      let restoredSettings = DEFAULTS;
      let firstVisit = true;

      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          restoredSettings = normalizeSettings(JSON.parse(saved));
          firstVisit = false;
        }

        const savedHistory = JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? "[]");
        if (Array.isArray(savedHistory)) {
          setHistory(savedHistory.slice(0, 5).map((item) => normalizeSettings(item)));
        }

        const savedTimer = window.localStorage.getItem(TIMER_KEY);
        if (savedTimer && !firstVisit) {
          const snapshot = JSON.parse(savedTimer) as Partial<TimerSnapshot>;
          if (Number(snapshot.minutes) === restoredSettings.minutes) {
            if (snapshot.running && typeof snapshot.endAt === "number") {
              const next = Math.max(0, Math.ceil((snapshot.endAt - Date.now()) / 1000));
              setRemaining(next);
              if (next > 0) {
                deadlineRef.current = snapshot.endAt;
                setRunning(true);
              } else {
                saveTimerSnapshot({ remaining: 0, running: false, endAt: null, minutes: restoredSettings.minutes });
              }
            } else if (Number.isFinite(Number(snapshot.remaining))) {
              setRemaining(Math.min(86_400, Math.max(0, Math.round(Number(snapshot.remaining)))));
            } else {
              setRemaining(restoredSettings.minutes * 60);
            }
          } else {
            setRemaining(restoredSettings.minutes * 60);
          }
        } else {
          setRemaining(restoredSettings.minutes * 60);
        }
      } catch {
        firstVisit = true;
        setRemaining(DEFAULTS.minutes * 60);
      }

      setSettings(restoredSettings);
      setDraft(restoredSettings);
      if (firstVisit) setPanelOpen(true);
    }, 0);

    return () => window.clearTimeout(restore);
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || window.location.protocol !== "https:") return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // The board still works normally when installation is unavailable.
    });
  }, []);

  useEffect(() => {
    if (!running || deadlineRef.current === null) return;

    const update = () => {
      const next = Math.max(0, Math.ceil((deadlineRef.current! - Date.now()) / 1000));
      setRemaining(next);
      if (next === 0) {
        setRunning(false);
        deadlineRef.current = null;
        saveTimerSnapshot({ remaining: 0, running: false, endAt: null, minutes: settings.minutes });
      }
    };

    update();
    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [running, settings.minutes]);

  const startTimer = useCallback(() => {
    const startFrom = remaining === 0 ? settings.minutes * 60 : remaining;
    const endAt = Date.now() + startFrom * 1000;
    setRemaining(startFrom);
    deadlineRef.current = endAt;
    setRunning(true);
    saveTimerSnapshot({ remaining: startFrom, running: true, endAt, minutes: settings.minutes });
  }, [remaining, settings.minutes]);

  const pauseTimer = useCallback(() => {
    if (!running) return;
    const next = deadlineRef.current === null
      ? remaining
      : Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
    setRemaining(next);
    deadlineRef.current = null;
    setRunning(false);
    saveTimerSnapshot({ remaining: next, running: false, endAt: null, minutes: settings.minutes });
  }, [remaining, running, settings.minutes]);

  const toggleTimer = useCallback(() => {
    if (running) pauseTimer();
    else startTimer();
  }, [pauseTimer, running, startTimer]);

  const resetTimer = useCallback(() => {
    const next = settings.minutes * 60;
    deadlineRef.current = null;
    setRunning(false);
    setRemaining(next);
    saveTimerSnapshot({ remaining: next, running: false, endAt: null, minutes: settings.minutes });
  }, [settings.minutes]);

  const addMinute = useCallback(() => {
    const next = remaining + 60;
    setRemaining(next);
    if (running && deadlineRef.current !== null) {
      deadlineRef.current += 60_000;
      saveTimerSnapshot({ remaining: next, running: true, endAt: deadlineRef.current, minutes: settings.minutes });
    } else {
      saveTimerSnapshot({ remaining: next, running: false, endAt: null, minutes: settings.minutes });
    }
  }, [remaining, running, settings.minutes]);

  const showAttention = useCallback(() => {
    pauseTimer();
    setAttention(true);
  }, [pauseTimer]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;

      if (event.key === "Escape") {
        setAttention(false);
        setVolumeGuideOpen(false);
        setPanelOpen(false);
        return;
      }

      if (event.key.toLowerCase() === "s" && !panelOpen && !volumeGuideOpen) {
        if (attention) setAttention(false);
        else showAttention();
        return;
      }

      if (target?.matches("input, textarea, select, button")) return;

      if (event.key === " " && !panelOpen && !attention && !volumeGuideOpen) {
        event.preventDefault();
        toggleTimer();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [attention, panelOpen, showAttention, toggleTimer, volumeGuideOpen]);

  const openPanel = () => {
    setDraft(settings);
    setPanelOpen(true);
  };

  const applySettings = () => {
    const clean = normalizeSettings(draft);
    const serialized = JSON.stringify(clean);
    const nextHistory = [clean, ...history.filter((item) => JSON.stringify(item) !== serialized)].slice(0, 5);

    setSettings(clean);
    setDraft(clean);
    setHistory(nextHistory);
    setRemaining(clean.minutes * 60);
    setRunning(false);
    deadlineRef.current = null;

    try {
      window.localStorage.setItem(STORAGE_KEY, serialized);
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
    } catch {
      // The current phase remains usable even without browser storage.
    }
    saveTimerSnapshot({ remaining: clean.minutes * 60, running: false, endAt: null, minutes: clean.minutes });
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

  const socialSymbol = settings.socialForm === "Einzelarbeit"
    ? "1"
    : settings.socialForm === "Partnerarbeit"
      ? "2"
      : settings.socialForm === "Plenum"
        ? "○"
        : settings.socialForm === "Gruppenarbeit"
          ? String(settings.groupSize)
          : "↗";

  const socialNote = settings.socialForm === "Gruppenarbeit"
    ? `Gruppen à ${settings.groupSize} · Tische bleiben stehen`
    : settings.socialForm === "Freiarbeit / SOL"
      ? "Arbeitsplan prüfen · ersten Schritt wählen"
      : "Beginnt nach der Freigabe";

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
          <button className="quiet-button attention-button" onClick={showAttention}><span aria-hidden="true">●</span> Stopp</button>
          <button className="quiet-button" onClick={openPanel}><span aria-hidden="true">✎</span> Bearbeiten</button>
          <button className="icon-button" onClick={requestFullscreen} aria-label="Vollbild ein- oder ausschalten" title="Vollbild"><span aria-hidden="true">⛶</span></button>
        </div>
      </header>

      <section className="board" aria-label="Aktuelle Arbeitsphase">
        {settings.visibleCount >= 1 && (
          <article className="phase-card social-card">
            <div className="card-heading"><CardNumber number={1} /><span>Sozialform</span></div>
            <div className="card-content">
              <span className="social-symbol" aria-hidden="true">{socialSymbol}</span>
              <h2>{settings.socialForm}</h2>
              <p>{socialNote}</p>
            </div>
          </article>
        )}

        {settings.visibleCount >= 2 && (
          <button
            type="button"
            className={`phase-card volume-card volume-card-button volume-${volume.level}`}
            onClick={() => setVolumeGuideOpen(true)}
            aria-label={`Lautstärke ${volume.level}: ${volume.title}. Alle Lautstärken anzeigen`}
          >
            <div className="card-heading"><CardNumber number={2} /><span>Lautstärke</span></div>
            <div className="card-content">
              <VolumeMeter level={volume.level} />
              <div><h2>{volume.title}</h2><p>{volume.note}</p></div>
            </div>
          </button>
        )}

        {settings.visibleCount >= 3 && (
          <article className={`phase-card timer-card ${isFinished ? "timer-finished" : ""} ${isWarning ? "timer-warning" : ""}`}>
            <div className="card-heading"><CardNumber number={3} /><span>Zeit</span></div>
            <div className="timer-main">
              <p className="timer-display" aria-live="polite">{formatTime(remaining)}</p>
              <p className="timer-status">{isFinished ? "Zeit ist um" : running && isWarning ? "Endspurt" : running ? "läuft" : isPaused ? "pausiert" : "bereit"}</p>
            </div>
            <div className="timer-progress" aria-hidden="true"><span style={{ width: `${Math.min(100, progress * 100)}%` }} /></div>
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
          <span className="attention-hint">Zum Schließen S oder Escape drücken · Timer bleibt pausiert</span>
        </section>
      )}

      {volumeGuideOpen && (
        <section className="volume-guide-overlay" role="dialog" aria-modal="true" aria-labelledby="volume-guide-title">
          <div className="volume-guide-panel">
            <button className="guide-close" onClick={() => setVolumeGuideOpen(false)} aria-label="Lautstärkeübersicht schließen">×</button>
            <p className="panel-eyebrow">Gemeinsame Sprache</p>
            <h2 id="volume-guide-title">Die vier Lautstärken</h2>
            <p className="volume-guide-intro">Die Zahl zeigt, wer euch hören darf.</p>
            <div className="volume-guide-grid">
              {VOLUMES.map((item) => (
                <article key={item.level} className={item.level === settings.volume ? "current" : ""}>
                  <span>{item.level}</span>
                  <div><h3>{item.title}</h3><p>{item.note}</p></div>
                </article>
              ))}
            </div>
            <button className="guide-done" onClick={() => setVolumeGuideOpen(false)}>Verstanden</button>
          </div>
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
                    <button type="button" key={stage.count} className={draft.visibleCount === stage.count ? "selected" : ""} onClick={() => setDraft({ ...draft, visibleCount: stage.count })}>
                      <strong>{stage.title}</strong><span>{stage.note}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              {history.length > 0 && (
                <section className="setting-section history-section" aria-labelledby="history-title">
                  <div className="history-heading"><h3 id="history-title">Zuletzt verwendet</h3><span>bis zu 5</span></div>
                  <div className="history-options">
                    {history.map((item, index) => (
                      <button type="button" key={`${JSON.stringify(item)}-${index}`} onClick={() => setDraft(item)}>
                        <strong>{item.socialForm}{item.socialForm === "Gruppenarbeit" ? ` · ${item.groupSize}er-Gruppen` : ""}</strong>
                        <span>Lautstärke {item.volume}{item.visibleCount >= 3 ? ` · ${item.minutes} Min` : ""} · {item.visibleCount} Karten</span>
                        {item.visibleCount >= 4 && <small>{item.result}</small>}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <div className="setting-section social-setting">
                <label>
                  <span className="setting-label"><b>1</b> Sozialform</span>
                  <select value={draft.socialForm} onChange={(event) => setDraft({ ...draft, socialForm: event.target.value })}>
                    {SOCIAL_FORMS.map((form) => <option key={form}>{form}</option>)}
                  </select>
                </label>
                {draft.socialForm === "Gruppenarbeit" && (
                  <fieldset className="group-size-setting">
                    <legend>Gruppengröße</legend>
                    <div className="group-size-options">
                      {GROUP_SIZES.map((size) => (
                        <button type="button" key={size} className={draft.groupSize === size ? "selected" : ""} onClick={() => setDraft({ ...draft, groupSize: size })}>{size}</button>
                      ))}
                    </div>
                    <span>maximal 6 Personen</span>
                  </fieldset>
                )}
              </div>

              <fieldset className="setting-section">
                <legend><b>2</b> Lautstärke</legend>
                <div className="volume-options">
                  {VOLUMES.map((item) => (
                    <button type="button" key={item.level} className={draft.volume === item.level ? "selected" : ""} onClick={() => setDraft({ ...draft, volume: item.level })}>
                      <span>{item.level}</span><strong>{item.title}</strong>
                    </button>
                  ))}
                </div>
              </fieldset>

              {draft.visibleCount >= 3 && (
                <fieldset className="setting-section time-setting">
                  <legend><b>3</b> Zeit</legend>
                  <div className="minute-presets">
                    {[5, 10, 12, 15, 20, 30].map((minutes) => (
                      <button type="button" key={minutes} className={draft.minutes === minutes ? "selected" : ""} onClick={() => setDraft({ ...draft, minutes })}>{minutes} Min</button>
                    ))}
                  </div>
                  <label className="custom-minutes">Eigene Zeit <input type="number" min="1" max="120" value={draft.minutes} onChange={(event) => setDraft({ ...draft, minutes: Number(event.target.value) })} /> Min</label>
                </fieldset>
              )}

              {draft.visibleCount >= 4 && (
                <label className="setting-section text-setting">
                  <span className="setting-label"><b>4</b> Ergebnis</span>
                  <textarea maxLength={90} rows={2} value={draft.result} onChange={(event) => setDraft({ ...draft, result: event.target.value })} placeholder="z. B. 3 begründete Thesen" />
                  <span className="character-count">{draft.result.length}/90</span>
                </label>
              )}

              {draft.visibleCount >= 5 && (
                <label className="setting-section text-setting">
                  <span className="setting-label"><b>5</b> Danach</span>
                  <textarea maxLength={90} rows={2} value={draft.next} onChange={(event) => setDraft({ ...draft, next: event.target.value })} placeholder="z. B. Material zurück · Blick nach vorn" />
                  <span className="character-count">{draft.next.length}/90</span>
                </label>
              )}
            </div>

            <div className="panel-footer">
              <p>Phasen und Timer bleiben ausschließlich in diesem Browser gespeichert.</p>
              <button className="apply-button" onClick={applySettings}>Anzeige übernehmen</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
