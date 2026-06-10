import { app, BrowserWindow, ipcMain, shell } from "electron";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

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

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
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
  mainWindow.webContents.once("did-finish-load", () => {
    if (process.env.STREAMMATRIX_SMOKE_TEST === "1") {
      mainWindow.webContents.setAudioMuted(true);
      if (!mainWindow.webContents.isAudioMuted()) {
        throw new Error("Desktop audio mute integration failed.");
      }
      console.log("StreamMatrix desktop smoke test passed.");
      setTimeout(() => app.quit(), 250);
    }
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
