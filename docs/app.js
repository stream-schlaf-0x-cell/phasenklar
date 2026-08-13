(() => {
  "use strict";

  const STORAGE_KEY = "phasenklar-board-v1";
  const DEFAULTS = {
    socialForm: "Gruppenarbeit",
    volume: 2,
    minutes: 12,
    result: "3 begründete Thesen",
    next: "Material zurück · Blick nach vorn",
    visibleCount: 5,
  };
  const VOLUMES = [
    { title: "Ruhe", note: "Niemand spricht" },
    { title: "Flüstern", note: "Nur die Person neben dir hört dich" },
    { title: "Gruppentisch", note: "Nur die eigene Gruppe hört euch" },
    { title: "Präsentation", note: "Der ganze Raum hört zu" },
  ];

  const byId = (id) => document.getElementById(id);
  const shell = byId("app-shell");
  const panel = byId("panel-backdrop");
  const attention = byId("attention-overlay");
  const timerCard = byId("timer-card");
  const timerDisplay = byId("timer-display");
  const timerStatus = byId("timer-status");
  const timerProgress = byId("timer-progress");
  const timerToggle = byId("timer-toggle");

  let state = loadSettings();
  let draft = { ...state };
  let remaining = state.minutes * 60;
  let running = false;
  let deadline = null;
  let timerInterval = null;

  function loadSettings() {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : { ...DEFAULTS };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function socialPresentation(form) {
    if (form === "Einzelarbeit") return { symbol: "1", note: "Beginnt nach der Freigabe" };
    if (form === "Partnerarbeit") return { symbol: "2", note: "Beginnt nach der Freigabe" };
    if (form === "Plenum") return { symbol: "○", note: "Beginnt nach der Freigabe" };
    if (form === "Freiarbeit / SOL") return { symbol: "4", note: "Arbeitsplan prüfen · ersten Schritt wählen" };
    return { symbol: "4", note: "Die Tische bleiben stehen" };
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  function renderBoard() {
    shell.className = `app-shell stage-${state.visibleCount}`;
    document.querySelectorAll("[data-card]").forEach((card) => {
      card.hidden = Number(card.dataset.card) > state.visibleCount;
    });

    const social = socialPresentation(state.socialForm);
    byId("social-symbol").textContent = social.symbol;
    byId("social-value").textContent = state.socialForm;
    byId("social-note").textContent = social.note;

    const volume = VOLUMES[state.volume] || VOLUMES[2];
    byId("volume-level").textContent = String(state.volume);
    byId("volume-title").textContent = volume.title;
    byId("volume-note").textContent = volume.note;
    byId("volume-card").className = `phase-card volume-card volume-${state.volume}`;

    byId("result-value").textContent = state.result;
    byId("next-value").textContent = state.next;
    renderTimer();
  }

  function renderTimer() {
    const total = Math.max(1, state.minutes * 60);
    const finished = remaining === 0;
    timerDisplay.textContent = formatTime(remaining);
    timerStatus.textContent = finished ? "Zeit ist um" : running ? "läuft" : "bereit";
    timerToggle.textContent = running ? "Pause" : finished ? "Noch einmal" : "Start";
    timerProgress.style.width = `${Math.max(0, Math.min(100, (remaining / total) * 100))}%`;
    timerCard.classList.toggle("timer-finished", finished);
  }

  function updateTimer() {
    if (!running || deadline === null) return;
    remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    if (remaining === 0) stopTimer(false);
    renderTimer();
  }

  function startTimer() {
    if (remaining === 0) remaining = state.minutes * 60;
    deadline = Date.now() + remaining * 1000;
    running = true;
    window.clearInterval(timerInterval);
    timerInterval = window.setInterval(updateTimer, 250);
    renderTimer();
  }

  function stopTimer(recalculate = true) {
    if (recalculate && deadline !== null) remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    running = false;
    deadline = null;
    window.clearInterval(timerInterval);
    timerInterval = null;
    renderTimer();
  }

  function toggleTimer() {
    if (running) stopTimer();
    else startTimer();
  }

  function resetTimer() {
    stopTimer(false);
    remaining = state.minutes * 60;
    renderTimer();
  }

  function addMinute() {
    remaining += 60;
    if (running && deadline !== null) deadline += 60_000;
    renderTimer();
  }

  function setSelected(container, attribute, value) {
    container.querySelectorAll("button").forEach((button) => {
      button.classList.toggle("selected", Number(button.dataset[attribute]) === Number(value));
    });
  }

  function updateCounts() {
    byId("result-count").textContent = `${byId("result-input").value.length}/90`;
    byId("next-count").textContent = `${byId("next-input").value.length}/90`;
  }

  function openSettings(firstVisit = false) {
    draft = { ...state };
    byId("social-input").value = draft.socialForm;
    byId("minutes-input").value = String(draft.minutes);
    byId("result-input").value = draft.result;
    byId("next-input").value = draft.next;
    setSelected(byId("stage-options"), "stage", draft.visibleCount);
    setSelected(byId("volume-options"), "volume", draft.volume);
    setSelected(byId("minute-presets"), "minutes", draft.minutes);
    updateCounts();
    panel.hidden = false;
    if (!firstVisit) byId("social-input").focus();
  }

  function closeSettings() {
    panel.hidden = true;
  }

  function applySettings() {
    const minutes = Math.min(120, Math.max(1, Number(byId("minutes-input").value) || 1));
    state = {
      ...draft,
      socialForm: byId("social-input").value,
      minutes,
      result: byId("result-input").value.trim() || "Ergebnis sichern",
      next: byId("next-input").value.trim() || "Blick nach vorn",
    };
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* Local storage may be blocked. */ }
    remaining = state.minutes * 60;
    stopTimer(false);
    closeSettings();
    renderBoard();
  }

  function showAttention() {
    attention.hidden = false;
    byId("attention-close").focus();
  }

  function hideAttention() {
    attention.hidden = true;
  }

  byId("settings-open").addEventListener("click", () => openSettings());
  byId("settings-close").addEventListener("click", closeSettings);
  byId("settings-apply").addEventListener("click", applySettings);
  panel.addEventListener("click", (event) => { if (event.target === panel) closeSettings(); });

  byId("stage-options").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-stage]");
    if (!button) return;
    draft.visibleCount = Number(button.dataset.stage);
    setSelected(byId("stage-options"), "stage", draft.visibleCount);
  });

  byId("volume-options").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-volume]");
    if (!button) return;
    draft.volume = Number(button.dataset.volume);
    setSelected(byId("volume-options"), "volume", draft.volume);
  });

  byId("minute-presets").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-minutes]");
    if (!button) return;
    draft.minutes = Number(button.dataset.minutes);
    byId("minutes-input").value = String(draft.minutes);
    setSelected(byId("minute-presets"), "minutes", draft.minutes);
  });

  byId("minutes-input").addEventListener("input", (event) => {
    draft.minutes = Number(event.target.value);
    setSelected(byId("minute-presets"), "minutes", draft.minutes);
  });
  byId("result-input").addEventListener("input", updateCounts);
  byId("next-input").addEventListener("input", updateCounts);

  timerToggle.addEventListener("click", toggleTimer);
  byId("timer-add").addEventListener("click", addMinute);
  byId("timer-reset").addEventListener("click", resetTimer);
  byId("attention-open").addEventListener("click", showAttention);
  byId("attention-close").addEventListener("click", hideAttention);

  byId("fullscreen").addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { /* Embedded browsers may block fullscreen. */ }
  });

  window.addEventListener("keydown", (event) => {
    const editing = event.target.matches("input, textarea, select, button");
    if (event.key === "Escape") {
      hideAttention();
      closeSettings();
      return;
    }
    if (editing || !panel.hidden) return;
    if (event.key === " ") {
      event.preventDefault();
      toggleTimer();
    }
    if (event.key.toLowerCase() === "s") {
      if (attention.hidden) showAttention();
      else hideAttention();
    }
  });

  renderBoard();
  if (!window.localStorage.getItem(STORAGE_KEY)) window.setTimeout(() => openSettings(true), 0);
})();
