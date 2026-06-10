import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const clientSource = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

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
