import { moveStream, normalizeTheme, parseStreamInputs } from "./state.js";

const STORAGE_KEY = "streammatrix-state-v1";
const MAX_STREAMS = 9;

const platformLabels = {
  twitch: "Twitch",
  kick: "Kick",
  youtube: "YouTube"
};

const elements = {
  accountsButton: document.querySelector("#accounts-button"),
  accountsPopover: document.querySelector("#accounts-popover"),
  addButton: document.querySelector("#add-stream-button"),
  chatExternalLink: document.querySelector("#chat-external-link"),
  chatFrameWrap: document.querySelector("#chat-frame-wrap"),
  chatPanel: document.querySelector("#chat-panel"),
  chatSelect: document.querySelector("#chat-select"),
  chatToggle: document.querySelector("#chat-toggle"),
  closeChatButton: document.querySelector("#close-chat-button"),
  deleteLayoutButton: document.querySelector("#delete-layout-button"),
  emptyStateTemplate: document.querySelector("#empty-state-template"),
  form: document.querySelector("#add-stream-form"),
  formMessage: document.querySelector("#form-message"),
  loadLayoutButton: document.querySelector("#load-layout-button"),
  mobileMenuButton: document.querySelector("#mobile-menu-button"),
  muteAllButton: document.querySelector("#mute-all-button"),
  platformSelect: document.querySelector("#platform-select"),
  saveLayoutButton: document.querySelector("#save-layout-button"),
  savedLayoutSelect: document.querySelector("#saved-layout-select"),
  streamCardTemplate: document.querySelector("#stream-card-template"),
  streamCount: document.querySelector("#stream-count"),
  streamGrid: document.querySelector("#stream-grid"),
  streamInput: document.querySelector("#stream-input"),
  themeSelect: document.querySelector("#theme-select"),
  workspace: document.querySelector("#workspace")
};

let messageTimer;
let state = loadState();

function loadState() {
  const fallback = {
    streams: [],
    chatEnabled: false,
    activeChatId: null,
    muted: false,
    theme: "system",
    savedLayouts: []
  };

  try {
    const stored = window.streamMatrixDesktop?.loadState?.() ?? JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!stored || !Array.isArray(stored.streams)) {
      return fallback;
    }
    return {
      ...fallback,
      ...stored,
      streams: stored.streams.filter(isValidStoredStream).slice(0, MAX_STREAMS),
      theme: normalizeTheme(stored.theme),
      savedLayouts: Array.isArray(stored.savedLayouts)
        ? stored.savedLayouts.filter(isValidSavedLayout).map((layout) => ({
            ...layout,
            streams: layout.streams.filter(isValidStoredStream).slice(0, MAX_STREAMS)
          }))
        : []
    };
  } catch {
    return fallback;
  }
}

function isValidStoredStream(stream) {
  return (
    stream &&
    typeof stream.id === "string" &&
    typeof stream.name === "string" &&
    ["twitch", "kick", "youtube"].includes(stream.platform) &&
    (stream.platform !== "youtube" || typeof stream.videoId === "string")
  );
}

function isValidSavedLayout(layout) {
  return (
    layout &&
    typeof layout.id === "string" &&
    typeof layout.name === "string" &&
    layout.name.trim().length > 0 &&
    Array.isArray(layout.streams)
  );
}

function saveState() {
  if (window.streamMatrixDesktop?.saveState) {
    window.streamMatrixDesktop.saveState(state);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

function copyStreams(streams) {
  return streams.map((stream) => ({ ...stream }));
}

function normalizeUsername(value) {
  return value.trim().replace(/^@/, "").replace(/^https?:\/\/[^/]+\//, "").split(/[/?#]/)[0];
}

function createStreamId(platform, value) {
  return `${platform}-${value.toLowerCase().replace(/[^a-z0-9_-]/g, "-")}`;
}

function getTwitchParent() {
  return window.location.hostname || "localhost";
}

function getPlayerUrl(stream) {
  const parent = encodeURIComponent(getTwitchParent());
  if (stream.platform === "twitch") {
    return `https://player.twitch.tv/?channel=${encodeURIComponent(stream.name)}&parent=${parent}&autoplay=true`;
  }
  if (stream.platform === "kick") {
    return `https://player.kick.com/${encodeURIComponent(stream.name)}?autoplay=true`;
  }
  return `https://www.youtube.com/embed/${encodeURIComponent(stream.videoId)}?autoplay=1&playsinline=1`;
}

function getChatUrl(stream) {
  const parent = encodeURIComponent(getTwitchParent());
  const darkMode = document.documentElement.dataset.theme !== "light";
  if (stream.platform === "twitch") {
    return `https://www.twitch.tv/embed/${encodeURIComponent(stream.name)}/chat?parent=${parent}&darkpopout=${darkMode}`;
  }
  if (stream.platform === "kick") {
    return `https://kick.com/popout/${encodeURIComponent(stream.name)}/chat`;
  }
  return `https://www.youtube.com/live_chat?v=${encodeURIComponent(stream.videoId)}&embed_domain=${parent}&dark_theme=${darkMode ? "1" : "0"}`;
}

function getExternalUrl(stream) {
  if (stream.platform === "twitch") {
    return `https://www.twitch.tv/${encodeURIComponent(stream.name)}`;
  }
  if (stream.platform === "kick") {
    return `https://kick.com/${encodeURIComponent(stream.name)}`;
  }
  return `https://www.youtube.com/watch?v=${encodeURIComponent(stream.videoId)}`;
}

function setTheme(theme) {
  const systemIsLight = window.matchMedia("(prefers-color-scheme: light)").matches;
  const resolvedTheme = theme === "system" ? (systemIsLight ? "light" : "dark") : theme;
  document.documentElement.dataset.theme = resolvedTheme;
  elements.themeSelect.value = theme;
}

function updateMuteButton() {
  elements.muteAllButton.setAttribute("aria-pressed", String(state.muted));
  elements.muteAllButton.querySelector("span").textContent = state.muted ? "Unmute all" : "Mute all";
  elements.muteAllButton.title = state.muted ? "Unmute every stream" : "Mute every stream";
}

async function applyMuteState() {
  updateMuteButton();
  if (window.streamMatrixDesktop) {
    try {
      state.muted = await window.streamMatrixDesktop.setMuted(state.muted);
      saveState();
      updateMuteButton();
    } catch {
      showMessage("StreamMatrix could not change the desktop audio state.", true);
    }
  }
}

function calculateColumns(count) {
  if (count <= 1) return 1;
  if (count <= 4) return 2;
  return 3;
}

function renderStreams() {
  elements.streamGrid.replaceChildren();
  elements.streamGrid.classList.toggle("is-empty", state.streams.length === 0);
  elements.streamGrid.style.setProperty("--columns", calculateColumns(state.streams.length));
  elements.streamCount.textContent = `${state.streams.length} ${state.streams.length === 1 ? "stream" : "streams"}`;

  if (state.streams.length === 0) {
    elements.streamGrid.append(elements.emptyStateTemplate.content.cloneNode(true));
    return;
  }

  for (const stream of state.streams) {
    const card = elements.streamCardTemplate.content.firstElementChild.cloneNode(true);
    card.dataset.platform = stream.platform;
    card.dataset.streamId = stream.id;
    card.querySelector(".stream-name").textContent = stream.name;
    card.querySelector(".stream-platform").textContent = platformLabels[stream.platform];

    const iframe = document.createElement("iframe");
    iframe.src = getPlayerUrl(stream);
    iframe.title = `${stream.name} on ${platformLabels[stream.platform]}`;
    iframe.allow = "autoplay; fullscreen; encrypted-media; picture-in-picture";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    card.querySelector(".player-wrap").append(iframe);

    const chatButton = card.querySelector(".chat-card-button");
    chatButton.classList.toggle("active", state.chatEnabled && state.activeChatId === stream.id);
    chatButton.addEventListener("click", () => {
      state.chatEnabled = true;
      state.activeChatId = stream.id;
      saveState();
      renderChat();
      updateChatButtons();
    });

    card.querySelector(".remove-stream-button").addEventListener("click", () => {
      removeStream(stream.id);
    });

    configureStreamDrag(card, stream.id);
    elements.streamGrid.append(card);
  }
}

function configureStreamDrag(card, streamId) {
  const handle = card.querySelector(".drag-stream-button");
  handle.draggable = true;
  handle.addEventListener("dragstart", (event) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", streamId);
    requestAnimationFrame(() => card.classList.add("dragging"));
  });
  handle.addEventListener("dragend", () => {
    card.classList.remove("dragging");
    clearDragTargets();
  });
  card.addEventListener("dragover", (event) => {
    if (event.dataTransfer.types.includes("text/plain")) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      clearDragTargets();
      card.classList.add("drag-target");
    }
  });
  card.addEventListener("dragleave", (event) => {
    if (!card.contains(event.relatedTarget)) {
      card.classList.remove("drag-target");
    }
  });
  card.addEventListener("drop", (event) => {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData("text/plain");
    clearDragTargets();
    reorderStream(sourceId, streamId);
  });
}

function clearDragTargets() {
  for (const card of elements.streamGrid.querySelectorAll(".drag-target")) {
    card.classList.remove("drag-target");
  }
}

function reorderStream(sourceId, targetId) {
  const movement = moveStream(state.streams, sourceId, targetId);
  if (!movement) return;
  const { sourceIndex, targetIndex } = movement;
  saveState();

  const sourceCard = elements.streamGrid.querySelector(`[data-stream-id="${CSS.escape(sourceId)}"]`);
  const targetCard = elements.streamGrid.querySelector(`[data-stream-id="${CSS.escape(targetId)}"]`);
  const sourceOption = elements.chatSelect.querySelector(`option[value="${CSS.escape(sourceId)}"]`);
  const targetOption = elements.chatSelect.querySelector(`option[value="${CSS.escape(targetId)}"]`);
  if (sourceIndex < targetIndex) {
    targetCard?.after(sourceCard);
    targetOption?.after(sourceOption);
  } else {
    targetCard?.before(sourceCard);
    targetOption?.before(sourceOption);
  }
}

function renderChat() {
  if (state.streams.length === 0) {
    state.chatEnabled = false;
    state.activeChatId = null;
  }

  if (!state.streams.some((stream) => stream.id === state.activeChatId)) {
    state.activeChatId = state.streams[0]?.id ?? null;
  }

  elements.chatToggle.checked = state.chatEnabled;
  elements.chatPanel.hidden = !state.chatEnabled;
  elements.workspace.classList.toggle("chat-open", state.chatEnabled);
  elements.chatSelect.replaceChildren();

  for (const stream of state.streams) {
    const option = document.createElement("option");
    option.value = stream.id;
    option.textContent = `${stream.name} - ${platformLabels[stream.platform]}`;
    elements.chatSelect.append(option);
  }

  const activeStream = state.streams.find((stream) => stream.id === state.activeChatId);
  elements.chatFrameWrap.replaceChildren();

  if (state.chatEnabled && activeStream) {
    elements.chatSelect.value = activeStream.id;
    const iframe = document.createElement("iframe");
    iframe.src = getChatUrl(activeStream);
    iframe.title = `${activeStream.name} live chat`;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.setAttribute(
      "sandbox",
      "allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals"
    );
    elements.chatFrameWrap.append(iframe);
    elements.chatExternalLink.href = getExternalUrl(activeStream);
  }

  saveState();
}

function updateChatButtons() {
  for (const card of elements.streamGrid.querySelectorAll(".stream-card")) {
    const isActive = state.chatEnabled && card.dataset.streamId === state.activeChatId;
    card.querySelector(".chat-card-button").classList.toggle("active", isActive);
  }
}

function render() {
  setTheme(state.theme);
  renderStreams();
  renderChat();
  renderSavedLayouts();
  updateChatButtons();
  updateMuteButton();
}

function renderSavedLayouts(selectedId = elements.savedLayoutSelect.value) {
  elements.savedLayoutSelect.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Saved layouts";
  elements.savedLayoutSelect.append(placeholder);

  for (const layout of state.savedLayouts) {
    const option = document.createElement("option");
    option.value = layout.id;
    option.textContent = layout.name;
    elements.savedLayoutSelect.append(option);
  }

  elements.savedLayoutSelect.value = state.savedLayouts.some((layout) => layout.id === selectedId) ? selectedId : "";
  const hasSelection = Boolean(elements.savedLayoutSelect.value);
  elements.loadLayoutButton.disabled = !hasSelection;
  elements.deleteLayoutButton.disabled = !hasSelection;
}

function showMessage(message, isError = false) {
  clearTimeout(messageTimer);
  elements.formMessage.textContent = message;
  elements.formMessage.classList.toggle("error", isError);
  elements.formMessage.hidden = false;
  messageTimer = setTimeout(() => {
    elements.formMessage.hidden = true;
  }, 5000);
}

function setSubmitting(isSubmitting) {
  elements.addButton.disabled = isSubmitting;
  elements.addButton.lastChild.textContent = isSubmitting ? " Resolving..." : " Add stream";
}

async function buildStream(platform, input) {
  if (platform === "youtube") {
    const response = await fetch(`/api/youtube/resolve?input=${encodeURIComponent(input)}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? "Could not resolve that YouTube stream.");
    }

    const displayName = input
      .trim()
      .replace(/^https?:\/\/(?:www\.)?youtube\.com\//i, "")
      .replace(/\/live\/?$/, "")
      .replace(/^@/, "")
      .split(/[/?#]/)[0] || data.videoId;

    return {
      id: createStreamId(platform, data.videoId),
      platform,
      name: displayName,
      videoId: data.videoId
    };
  }

  const username = normalizeUsername(input);
  if (!/^[A-Za-z0-9_.-]{2,40}$/.test(username)) {
    throw new Error(`Enter a valid ${platformLabels[platform]} username.`);
  }

  return {
    id: createStreamId(platform, username),
    platform,
    name: username
  };
}

async function addStream(event) {
  event.preventDefault();
  const platform = elements.platformSelect.value;
  const inputs = parseStreamInputs(elements.streamInput.value);

  if (inputs.length === 0) return;
  const availableSlots = MAX_STREAMS - state.streams.length;
  if (availableSlots === 0) {
    showMessage(`StreamMatrix supports up to ${MAX_STREAMS} streams at once.`, true);
    return;
  }
  if (inputs.length > availableSlots) {
    showMessage(`You can add ${availableSlots} more ${availableSlots === 1 ? "stream" : "streams"}.`, true);
    return;
  }

  setSubmitting(true);
  try {
    const results = await Promise.allSettled(inputs.map((input) => buildStream(platform, input)));
    const existingIds = new Set(state.streams.map((stream) => stream.id));
    const addedStreams = [];
    const errors = [];

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        errors.push(`${inputs[index]}: ${result.reason.message}`);
      } else if (existingIds.has(result.value.id)) {
        errors.push(`${inputs[index]}: already in your matrix`);
      } else {
        existingIds.add(result.value.id);
        addedStreams.push(result.value);
      }
    });

    if (addedStreams.length === 0) {
      throw new Error(errors.join(" ") || "No streams were added.");
    }

    state.streams.push(...addedStreams);
    state.activeChatId ??= addedStreams[0].id;
    elements.streamInput.value = "";
    saveState();
    renderStreams();
    renderChat();
    if (errors.length > 0) {
      showMessage(`Added ${addedStreams.length}. ${errors.join(" ")}`, true);
    } else if (addedStreams.length > 1) {
      showMessage(`Added ${addedStreams.length} streams.`);
    }
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    setSubmitting(false);
    elements.streamInput.focus();
  }
}

function saveCurrentLayout() {
  if (state.streams.length === 0) {
    showMessage("Add at least one stream before saving a layout.", true);
    return;
  }

  const name = window.prompt("Name this stream layout:");
  if (name === null) return;
  const trimmedName = name.trim();
  if (!trimmedName) {
    showMessage("Enter a name for the saved layout.", true);
    return;
  }

  const existingLayout = state.savedLayouts.find(
    (layout) => layout.name.toLowerCase() === trimmedName.toLowerCase()
  );
  if (existingLayout) {
    existingLayout.name = trimmedName;
    existingLayout.streams = copyStreams(state.streams);
    saveState();
    renderSavedLayouts(existingLayout.id);
    showMessage(`Updated "${trimmedName}".`);
    return;
  }

  const layout = {
    id: globalThis.crypto?.randomUUID?.() ?? `layout-${Date.now()}`,
    name: trimmedName,
    streams: copyStreams(state.streams)
  };
  state.savedLayouts.push(layout);
  saveState();
  renderSavedLayouts(layout.id);
  showMessage(`Saved "${trimmedName}".`);
}

function loadSelectedLayout() {
  const layout = state.savedLayouts.find((item) => item.id === elements.savedLayoutSelect.value);
  if (!layout) return;

  state.streams = copyStreams(layout.streams);
  state.activeChatId = state.streams[0]?.id ?? null;
  state.chatEnabled = state.chatEnabled && state.streams.length > 0;
  saveState();
  renderStreams();
  renderChat();
  showMessage(`Loaded "${layout.name}".`);
}

function deleteSelectedLayout() {
  const layout = state.savedLayouts.find((item) => item.id === elements.savedLayoutSelect.value);
  if (!layout || !window.confirm(`Delete the saved layout "${layout.name}"?`)) return;

  state.savedLayouts = state.savedLayouts.filter((item) => item.id !== layout.id);
  saveState();
  renderSavedLayouts();
  showMessage(`Deleted "${layout.name}".`);
}

function removeStream(streamId) {
  state.streams = state.streams.filter((stream) => stream.id !== streamId);
  if (state.activeChatId === streamId) {
    state.activeChatId = state.streams[0]?.id ?? null;
  }
  saveState();
  renderStreams();
  renderChat();
}

function updatePlaceholder() {
  const placeholders = {
    twitch: "Enter Twitch usernames, separated by commas",
    kick: "Enter Kick usernames, separated by commas",
    youtube: "Enter handles or live URLs, separated by commas"
  };
  elements.streamInput.placeholder = placeholders[elements.platformSelect.value];
}

elements.form.addEventListener("submit", addStream);
elements.platformSelect.addEventListener("change", updatePlaceholder);
elements.savedLayoutSelect.addEventListener("change", () => renderSavedLayouts(elements.savedLayoutSelect.value));
elements.saveLayoutButton.addEventListener("click", saveCurrentLayout);
elements.loadLayoutButton.addEventListener("click", loadSelectedLayout);
elements.deleteLayoutButton.addEventListener("click", deleteSelectedLayout);
elements.muteAllButton.addEventListener("click", async () => {
  if (!window.streamMatrixDesktop) {
    showMessage("Mute all is available in the StreamMatrix desktop application.", true);
    return;
  }

  state.muted = !state.muted;
  saveState();
  await applyMuteState();
});
elements.chatToggle.addEventListener("change", () => {
  state.chatEnabled = elements.chatToggle.checked && state.streams.length > 0;
  state.activeChatId ??= state.streams[0]?.id ?? null;
  renderChat();
  updateChatButtons();
});
elements.closeChatButton.addEventListener("click", () => {
  state.chatEnabled = false;
  renderChat();
  updateChatButtons();
});
elements.chatSelect.addEventListener("change", () => {
  state.activeChatId = elements.chatSelect.value;
  renderChat();
  updateChatButtons();
});
elements.themeSelect.addEventListener("change", () => {
  state.theme = elements.themeSelect.value;
  setTheme(state.theme);
  saveState();
  renderChat();
});
elements.accountsButton.addEventListener("click", () => {
  elements.accountsPopover.hidden = !elements.accountsPopover.hidden;
});
elements.mobileMenuButton.addEventListener("click", () => {
  elements.accountsPopover.hidden = !elements.accountsPopover.hidden;
});
document.addEventListener("click", (event) => {
  if (
    !elements.accountsPopover.hidden &&
    !elements.accountsPopover.contains(event.target) &&
    !elements.accountsButton.contains(event.target) &&
    !elements.mobileMenuButton.contains(event.target)
  ) {
    elements.accountsPopover.hidden = true;
  }
});
window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
  if (state.theme === "system") {
    setTheme("system");
    renderChat();
  }
});

updatePlaceholder();
render();
applyMuteState();
