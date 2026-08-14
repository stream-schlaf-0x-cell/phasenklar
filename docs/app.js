(() => {
  "use strict";

  const STORAGE_KEY = "phasenklar-board-v1";
  const TIMER_KEY = "phasenklar-timer-v1";
  const HISTORY_KEY = "phasenklar-history-v1";
  const SOCIAL_FORMS = ["Einzelarbeit", "Partnerarbeit", "Gruppenarbeit", "Freiarbeit / SOL", "Plenum"];
  const GROUP_SIZES = [3, 4, 5, 6];
  const DEFAULTS = {
    socialForm: "Gruppenarbeit",
    groupSize: 4,
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
  const volumeGuide = byId("volume-guide-overlay");
  const timerCard = byId("timer-card");
  const timerDisplay = byId("timer-display");
  const timerStatus = byId("timer-status");
  const timerProgress = byId("timer-progress");
  const timerToggle = byId("timer-toggle");

  let hasSavedSettings = false;
  let state = loadSettings();
  let draft = { ...state };
  let history = loadHistory();
  let remaining = state.minutes * 60;
  let running = false;
  let deadline = null;
  let timerInterval = null;

  function normalizeSettings(value = {}) {
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

  function loadSettings() {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      hasSavedSettings = Boolean(saved);
      return saved ? normalizeSettings(JSON.parse(saved)) : { ...DEFAULTS };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function loadHistory() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(HISTORY_KEY) || "[]");
      return Array.isArray(saved) ? saved.slice(0, 5).map((item) => normalizeSettings(item)) : [];
    } catch {
      return [];
    }
  }

  function saveTimerSnapshot() {
    try {
      window.localStorage.setItem(TIMER_KEY, JSON.stringify({ remaining, running, endAt: deadline, minutes: state.minutes }));
    } catch {
      // Local storage can be unavailable in restricted browser modes.
    }
  }

  function restoreTimer() {
    if (!hasSavedSettings) return;
    try {
      const saved = window.localStorage.getItem(TIMER_KEY);
      if (!saved) return;
      const snapshot = JSON.parse(saved);
      if (Number(snapshot.minutes) !== state.minutes) return;

      if (snapshot.running && typeof snapshot.endAt === "number") {
        remaining = Math.max(0, Math.ceil((snapshot.endAt - Date.now()) / 1000));
        if (remaining > 0) {
          running = true;
          deadline = snapshot.endAt;
        } else {
          running = false;
          deadline = null;
          saveTimerSnapshot();
        }
      } else if (Number.isFinite(Number(snapshot.remaining))) {
        remaining = Math.min(86_400, Math.max(0, Math.round(Number(snapshot.remaining))));
      }
    } catch {
      remaining = state.minutes * 60;
    }
  }

  function socialPresentation(form, groupSize) {
    if (form === "Einzelarbeit") return { symbol: "1", note: "Beginnt nach der Freigabe" };
    if (form === "Partnerarbeit") return { symbol: "2", note: "Beginnt nach der Freigabe" };
    if (form === "Plenum") return { symbol: "○", note: "Beginnt nach der Freigabe" };
    if (form === "Freiarbeit / SOL") return { symbol: "↗", note: "Arbeitsplan prüfen · ersten Schritt wählen" };
    return { symbol: String(groupSize), note: `Gruppen à ${groupSize} · Tische bleiben stehen` };
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

    const social = socialPresentation(state.socialForm, state.groupSize);
    byId("social-symbol").textContent = social.symbol;
    byId("social-value").textContent = state.socialForm;
    byId("social-note").textContent = social.note;

    const volume = VOLUMES[state.volume] || VOLUMES[2];
    byId("volume-level").textContent = String(state.volume);
    byId("volume-title").textContent = volume.title;
    byId("volume-note").textContent = volume.note;
    byId("volume-card").className = `phase-card volume-card volume-card-button volume-${state.volume}`;
    byId("volume-card").setAttribute("aria-label", `Lautstärke ${state.volume}: ${volume.title}. Alle Lautstärken anzeigen`);
    document.querySelectorAll("#volume-meter [data-meter-level]").forEach((segment) => {
      segment.classList.toggle("active", state.volume >= Number(segment.dataset.meterLevel));
    });

    document.querySelectorAll("[data-guide-volume]").forEach((item) => {
      item.classList.toggle("current", Number(item.dataset.guideVolume) === state.volume);
    });

    byId("result-value").textContent = state.result;
    byId("next-value").textContent = state.next;
    renderTimer();
  }

  function renderTimer() {
    const total = Math.max(1, state.minutes * 60);
    const finished = remaining === 0;
    const warningAt = total <= 5 * 60 ? 60 : 2 * 60;
    const warning = !finished && remaining <= warningAt && (running || remaining !== total);
    const paused = !running && !finished && remaining !== total;

    timerDisplay.textContent = formatTime(remaining);
    timerStatus.textContent = finished ? "Zeit ist um" : running && warning ? "Endspurt" : running ? "läuft" : paused ? "pausiert" : "bereit";
    timerToggle.textContent = running ? "Pause" : finished ? "Noch einmal" : "Start";
    timerProgress.style.width = `${Math.max(0, Math.min(100, (remaining / total) * 100))}%`;
    timerCard.classList.toggle("timer-finished", finished);
    timerCard.classList.toggle("timer-warning", warning);
  }

  function updateTimer() {
    if (!running || deadline === null) return;
    remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    if (remaining === 0) {
      running = false;
      deadline = null;
      window.clearInterval(timerInterval);
      timerInterval = null;
      saveTimerSnapshot();
    }
    renderTimer();
  }

  function startTimer() {
    if (remaining === 0) remaining = state.minutes * 60;
    deadline = Date.now() + remaining * 1000;
    running = true;
    window.clearInterval(timerInterval);
    timerInterval = window.setInterval(updateTimer, 250);
    saveTimerSnapshot();
    renderTimer();
  }

  function stopTimer(recalculate = true) {
    if (recalculate && deadline !== null) remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    running = false;
    deadline = null;
    window.clearInterval(timerInterval);
    timerInterval = null;
    saveTimerSnapshot();
    renderTimer();
  }

  function toggleTimer() {
    if (running) stopTimer();
    else startTimer();
  }

  function resetTimer() {
    remaining = state.minutes * 60;
    stopTimer(false);
  }

  function addMinute() {
    remaining += 60;
    if (running && deadline !== null) deadline += 60_000;
    saveTimerSnapshot();
    renderTimer();
  }

  function setSelected(container, attribute, value) {
    container.querySelectorAll("button").forEach((button) => {
      button.classList.toggle("selected", Number(button.dataset[attribute]) === Number(value));
    });
  }

  function renderSettingsStage() {
    document.querySelectorAll("[data-setting]").forEach((section) => {
      section.hidden = Number(section.dataset.setting) > draft.visibleCount;
    });
  }

  function renderGroupSize() {
    byId("group-size-setting").hidden = draft.socialForm !== "Gruppenarbeit";
    setSelected(byId("group-size-options"), "groupSize", draft.groupSize);
  }

  function renderHistory() {
    const section = byId("history-section");
    const container = byId("history-options");
    section.hidden = history.length === 0;
    container.replaceChildren();

    history.forEach((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.historyIndex = String(index);

      const title = document.createElement("strong");
      title.textContent = `${item.socialForm}${item.socialForm === "Gruppenarbeit" ? ` · ${item.groupSize}er-Gruppen` : ""}`;
      const details = document.createElement("span");
      details.textContent = `Lautstärke ${item.volume}${item.visibleCount >= 3 ? ` · ${item.minutes} Min` : ""} · ${item.visibleCount} Karten`;
      button.append(title, details);

      if (item.visibleCount >= 4) {
        const result = document.createElement("small");
        result.textContent = item.result;
        button.append(result);
      }
      container.append(button);
    });
  }

  function updateCounts() {
    byId("result-count").textContent = `${byId("result-input").value.length}/90`;
    byId("next-count").textContent = `${byId("next-input").value.length}/90`;
  }

  function syncSettingsForm() {
    byId("social-input").value = draft.socialForm;
    byId("minutes-input").value = String(draft.minutes);
    byId("result-input").value = draft.result;
    byId("next-input").value = draft.next;
    setSelected(byId("stage-options"), "stage", draft.visibleCount);
    setSelected(byId("volume-options"), "volume", draft.volume);
    setSelected(byId("minute-presets"), "minutes", draft.minutes);
    renderSettingsStage();
    renderGroupSize();
    updateCounts();
  }

  function openSettings(firstVisit = false) {
    draft = { ...state };
    syncSettingsForm();
    renderHistory();
    panel.hidden = false;
    if (!firstVisit) byId("social-input").focus();
  }

  function closeSettings() {
    panel.hidden = true;
  }

  function applySettings() {
    draft.socialForm = byId("social-input").value;
    draft.minutes = Number(byId("minutes-input").value);
    draft.result = byId("result-input").value;
    draft.next = byId("next-input").value;
    state = normalizeSettings(draft);

    const serialized = JSON.stringify(state);
    history = [state, ...history.filter((item) => JSON.stringify(item) !== serialized)].slice(0, 5);
    try {
      window.localStorage.setItem(STORAGE_KEY, serialized);
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      // The current phase remains usable even without browser storage.
    }

    remaining = state.minutes * 60;
    stopTimer(false);
    closeSettings();
    renderBoard();
  }

  function showAttention() {
    if (running) stopTimer();
    attention.hidden = false;
    byId("attention-close").focus();
  }

  function hideAttention() {
    attention.hidden = true;
  }

  function showVolumeGuide() {
    volumeGuide.hidden = false;
    byId("volume-guide-close").focus();
  }

  function hideVolumeGuide() {
    volumeGuide.hidden = true;
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
    renderSettingsStage();
  });

  byId("history-options").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-history-index]");
    if (!button) return;
    const selected = history[Number(button.dataset.historyIndex)];
    if (!selected) return;
    draft = { ...selected };
    syncSettingsForm();
  });

  byId("social-input").addEventListener("change", (event) => {
    draft.socialForm = event.target.value;
    renderGroupSize();
  });

  byId("group-size-options").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-group-size]");
    if (!button) return;
    draft.groupSize = Number(button.dataset.groupSize);
    setSelected(byId("group-size-options"), "groupSize", draft.groupSize);
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
  byId("volume-card").addEventListener("click", showVolumeGuide);
  byId("volume-guide-close").addEventListener("click", hideVolumeGuide);
  byId("volume-guide-done").addEventListener("click", hideVolumeGuide);

  byId("fullscreen").addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Embedded browsers may block fullscreen.
    }
  });

  window.addEventListener("keydown", (event) => {
    const editing = event.target.matches("input, textarea, select, button");
    if (event.key === "Escape") {
      hideAttention();
      hideVolumeGuide();
      closeSettings();
      return;
    }
    if (event.key.toLowerCase() === "s" && panel.hidden && volumeGuide.hidden) {
      if (attention.hidden) showAttention();
      else hideAttention();
      return;
    }
    if (editing || !panel.hidden || !volumeGuide.hidden) return;
    if (event.key === " " && attention.hidden) {
      event.preventDefault();
      toggleTimer();
    }
  });

  restoreTimer();
  renderBoard();
  renderHistory();
  if (running) timerInterval = window.setInterval(updateTimer, 250);
  if (!hasSavedSettings) window.setTimeout(() => openSettings(true), 0);

  if ("serviceWorker" in navigator && window.location.protocol === "https:") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {
        // The board still works normally when installation is unavailable.
      });
    });
  }
})();
