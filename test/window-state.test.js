import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeWindowState } from "../desktop/window-state.js";

const workAreas = [{ x: 0, y: 0, width: 1920, height: 1080 }];

test("window state restores visible bounds and maximized state", () => {
  const bounds = { x: 120, y: 80, width: 1280, height: 760 };
  assert.deepEqual(normalizeWindowState({ bounds, isMaximized: true }, workAreas), {
    bounds,
    isMaximized: true
  });
});

test("window state rejects undersized or disconnected-monitor bounds", () => {
  assert.deepEqual(
    normalizeWindowState({ bounds: { x: 0, y: 0, width: 800, height: 600 } }, workAreas),
    {}
  );
  assert.deepEqual(
    normalizeWindowState({ bounds: { x: 4000, y: 2000, width: 1200, height: 800 } }, workAreas),
    {}
  );
});

test("desktop lifecycle saves normal bounds on move, resize, and close", async () => {
  const source = await readFile(new URL("../desktop/main.js", import.meta.url), "utf8");

  assert.match(source, /getNormalBounds\(\)/);
  assert.match(source, /mainWindow\.on\("move", scheduleWindowStateSave\)/);
  assert.match(source, /mainWindow\.on\("resize", scheduleWindowStateSave\)/);
  assert.match(source, /mainWindow\.on\("close", \(\) =>/);
});
