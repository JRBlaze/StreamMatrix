import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const clientSource = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

test("chat updates preserve mounted stream players", () => {
  const renderChatSection = clientSource.match(
    /function renderChat\(\) \{([\s\S]*?)\n\}\n\nfunction updateChatButtons/
  )?.[1];
  assert.ok(renderChatSection, "renderChat function was not found");
  assert.doesNotMatch(renderChatSection, /renderStreams\s*\(/);
  assert.doesNotMatch(renderChatSection, /streamGrid\.(?:replaceChildren|innerHTML)/);

  const chatHandlerSection = clientSource.match(
    /elements\.chatToggle\.addEventListener([\s\S]*?)elements\.themeSelect\.addEventListener/
  )?.[1];
  assert.ok(chatHandlerSection, "chat event handlers were not found");
  assert.doesNotMatch(chatHandlerSection, /renderStreams\s*\(/);
});
