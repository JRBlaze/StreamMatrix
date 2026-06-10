import { app, BrowserWindow, ipcMain, screen, shell } from "electron";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeWindowState } from "./window-state.js";

process.env.NODE_ENV = "test";
const { startServer, stopServer } = await import("../server.js");

const desktopDirectory = fileURLToPath(new URL(".", import.meta.url));
const applicationIconPath = join(desktopDirectory, "../assets/streammatrix-icon.png");
const trustedAccountHosts = new Set([
  "accounts.google.com",
  "kick.com",
  "www.kick.com",
  "twitch.tv",
  "www.twitch.tv",
  "youtube.com",
  "www.youtube.com"
]);

let mainWindow;
let serverOrigin;
let windowStateSaveTimer;

if (process.platform === "win32") {
  app.setAppUserModelId("com.streammatrix.app");
}

function isTrustedAccountUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" && trustedAccountHosts.has(url.hostname);
  } catch {
    return false;
  }
}

function createAccountWindow(url) {
  const accountWindow = new BrowserWindow({
    width: 1080,
    height: 760,
    minWidth: 720,
    minHeight: 560,
    parent: mainWindow,
    autoHideMenuBar: true,
    backgroundColor: "#090b0f",
    icon: applicationIconPath,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  accountWindow.webContents.setWindowOpenHandler(({ url: childUrl }) => {
    if (isTrustedAccountUrl(childUrl)) {
      return { action: "allow" };
    }
    shell.openExternal(childUrl);
    return { action: "deny" };
  });
  accountWindow.loadURL(url);
}

function getWindowStatePath() {
  return join(app.getPath("userData"), "window-state.json");
}

function getApplicationStatePath() {
  return join(app.getPath("userData"), "application-state.json");
}

function readJsonFile(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function writeJsonFile(path, value, errorMessage) {
  const temporaryPath = `${path}.tmp`;
  try {
    writeFileSync(temporaryPath, JSON.stringify(value), "utf8");
    renameSync(temporaryPath, path);
  } catch (error) {
    console.error(errorMessage, error);
  }
}

function loadWindowState() {
  const stored = readJsonFile(getWindowStatePath());
  const workAreas = screen.getAllDisplays().map(({ workArea }) => workArea);
  return normalizeWindowState(stored, workAreas);
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const state = {
    bounds: mainWindow.getNormalBounds(),
    isMaximized: mainWindow.isMaximized()
  };

  writeJsonFile(getWindowStatePath(), state, "StreamMatrix could not save the window state:");
}

function scheduleWindowStateSave() {
  clearTimeout(windowStateSaveTimer);
  windowStateSaveTimer = setTimeout(saveWindowState, 250);
}

function createMainWindow() {
  const savedWindowState = loadWindowState();
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    ...savedWindowState.bounds,
    minWidth: 900,
    minHeight: 620,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#090b0f",
    icon: applicationIconPath,
    title: "StreamMatrix",
    webPreferences: {
      preload: join(desktopDirectory, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (savedWindowState.isMaximized) {
    mainWindow.maximize();
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isTrustedAccountUrl(url)) {
      createAccountWindow(url);
    } else {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(serverOrigin)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("move", scheduleWindowStateSave);
  mainWindow.on("resize", scheduleWindowStateSave);
  mainWindow.webContents.once("did-finish-load", async () => {
    if (process.env.STREAMMATRIX_SMOKE_TEST === "1") {
      mainWindow.webContents.setAudioMuted(true);
      if (!mainWindow.webContents.isAudioMuted()) {
        throw new Error("Desktop audio mute integration failed.");
      }
      const uiReady = await mainWindow.webContents.executeJavaScript(`
        Boolean(
          window.streamMatrixDesktop?.loadState &&
          window.streamMatrixDesktop?.saveState &&
          document.querySelector("#saved-layout-select") &&
          document.querySelector("#stream-input")?.tagName === "TEXTAREA" &&
          document.querySelector("#stream-card-template")?.content.querySelector(".drag-stream-button")
        )
      `);
      if (!uiReady) {
        throw new Error("Desktop persistence or stream layout controls failed to load.");
      }
      console.log("StreamMatrix desktop smoke test passed.");
      setTimeout(() => app.quit(), 250);
    }
  });
  mainWindow.on("close", () => {
    clearTimeout(windowStateSaveTimer);
    saveWindowState();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  mainWindow.loadURL(serverOrigin);
}

ipcMain.handle("streammatrix:set-muted", (_event, muted) => {
  const isMuted = Boolean(muted);
  mainWindow?.webContents.setAudioMuted(isMuted);
  return isMuted;
});

ipcMain.handle("streammatrix:get-muted", () => {
  return mainWindow?.webContents.isAudioMuted() ?? false;
});

ipcMain.on("streammatrix:load-state", (event) => {
  event.returnValue = readJsonFile(getApplicationStatePath());
});

ipcMain.on("streammatrix:save-state", (_event, state) => {
  if (!state || typeof state !== "object" || Array.isArray(state)) return;
  writeJsonFile(getApplicationStatePath(), state, "StreamMatrix could not save the application state:");
});

app.whenReady().then(async () => {
  try {
    const address = await startServer(0);
    serverOrigin = `http://localhost:${address.port}`;
    createMainWindow();
  } catch (error) {
    console.error("StreamMatrix failed to start:", error);
    app.quit();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopServer().catch(() => {});
});
