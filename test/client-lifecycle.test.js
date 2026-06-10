import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const clientSource = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const styleSource = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

test("chat updates preserve mounted stream players", () => {
  const sources = [
    { name: "LF", source: clientSource.replace(/\r\n/g, "\n") },
    { name: "CRLF", source: clientSource.replace(/\r?\n/g, "\r\n") }
  ];

  for (const { name, source } of sources) {
    const renderChatSection = source.match(
      /function renderChat\(\) \{([\s\S]*?)\r?\n\}\r?\n\r?\nfunction updateChatButtons/
    )?.[1];
    assert.ok(renderChatSection, `renderChat function was not found with ${name} line endings`);
    assert.doesNotMatch(renderChatSection, /renderStreams\s*\(/);
    assert.doesNotMatch(renderChatSection, /streamGrid\.(?:replaceChildren|innerHTML)/);

    const chatHandlerSection = source.match(
      /elements\.chatToggle\.addEventListener([\s\S]*?)elements\.themeSelect\.addEventListener/
    )?.[1];
    assert.ok(chatHandlerSection, `chat event handlers were not found with ${name} line endings`);
    assert.doesNotMatch(chatHandlerSection, /renderStreams\s*\(/);
  }
});

test("drag reordering preserves mounted stream players", () => {
  const reorderSection = clientSource.match(
    /function reorderStream\(sourceId, targetId\) \{([\s\S]*?)\r?\n\}\r?\n\r?\nfunction renderChat/
  )?.[1];

  assert.ok(reorderSection, "reorderStream function was not found");
  assert.doesNotMatch(reorderSection, /renderStreams\s*\(/);
  assert.doesNotMatch(reorderSection, /renderChat\s*\(/);
  assert.match(reorderSection, /saveState\s*\(\)/);
});

test("theme and named stream layouts are included in persistent state", () => {
  assert.match(clientSource, /theme:\s*"system"/);
  assert.match(clientSource, /savedLayouts:\s*\[\]/);
  assert.match(clientSource, /window\.streamMatrixDesktop\?\.loadState/);
  assert.match(clientSource, /window\.streamMatrixDesktop\.saveState\(state\)/);
  assert.match(clientSource, /localStorage\.setItem\(STORAGE_KEY,\s*JSON\.stringify\(state\)\)/);
  assert.match(clientSource, /function saveCurrentLayout\(\)/);
  assert.match(clientSource, /function loadSelectedLayout\(\)/);
});

test("native dropdown options use the active color theme", () => {
  assert.match(styleSource, /select,\s*\r?\noption\s*\{[\s\S]*?color-scheme:\s*inherit/);
  assert.match(styleSource, /select,\s*\r?\noption\s*\{[\s\S]*?background-color:\s*var\(--surface-raised\)/);
  assert.match(styleSource, /select,\s*\r?\noption\s*\{[\s\S]*?color:\s*var\(--text\)/);
});
