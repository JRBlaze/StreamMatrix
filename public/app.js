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
  emptyStateTemplate: document.querySelector("#empty-state-template"),
  form: document.querySelector("#add-stream-form"),
  formMessage: document.querySelector("#form-message"),
  mobileMenuButton: document.querySelector("#mobile-menu-button"),
  muteAllButton: document.querySelector("#mute-all-button"),
  platformSelect: document.querySelector("#platform-select"),
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
    theme: "system"
  };

  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!stored || !Array.isArray(stored.streams)) {
      return fallback;
    }
    return {
      ...fallback,
      ...stored,
      streams: stored.streams.filter(isValidStoredStream).slice(0, MAX_STREAMS)
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

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

    elements.streamGrid.append(card);
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
  updateChatButtons();
  updateMuteButton();
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
  const input = elements.streamInput.value.trim();

  if (!input) return;
  if (state.streams.length >= MAX_STREAMS) {
    showMessage(`StreamMatrix supports up to ${MAX_STREAMS} streams at once.`, true);
    return;
  }

  setSubmitting(true);
  try {
    const stream = await buildStream(platform, input);
    if (state.streams.some((item) => item.id === stream.id)) {
      throw new Error("That stream is already in your matrix.");
    }
    state.streams.push(stream);
    state.activeChatId ??= stream.id;
    elements.streamInput.value = "";
    saveState();
    renderStreams();
    renderChat();
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    setSubmitting(false);
    elements.streamInput.focus();
  }
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
    twitch: "Enter Twitch username",
    kick: "Enter Kick username",
    youtube: "Enter @handle or live URL"
  };
  elements.streamInput.placeholder = placeholders[elements.platformSelect.value];
}

elements.form.addEventListener("submit", addStream);
elements.platformSelect.addEventListener("change", updatePlaceholder);
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
