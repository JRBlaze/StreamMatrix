const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("streamMatrixDesktop", {
  getMuted: () => ipcRenderer.invoke("streammatrix:get-muted"),
  setMuted: (muted) => ipcRenderer.invoke("streammatrix:set-muted", Boolean(muted)),
  loadState: () => ipcRenderer.sendSync("streammatrix:load-state"),
  saveState: (state) => ipcRenderer.send("streammatrix:save-state", state)
});
