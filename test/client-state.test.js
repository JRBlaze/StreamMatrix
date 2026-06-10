import test from "node:test";
import assert from "node:assert/strict";
import { moveStream, normalizeTheme, parseStreamInputs } from "../public/state.js";

test("bulk stream input accepts comma-separated and line-separated values", () => {
  assert.deepEqual(
    parseStreamInputs("channel-one, channel-two\nhttps://youtube.com/@channel-three/live\n\n"),
    ["channel-one", "channel-two", "https://youtube.com/@channel-three/live"]
  );
});

test("stream ordering moves the dragged stream relative to its target", () => {
  const streams = [{ id: "one" }, { id: "two" }, { id: "three" }];

  assert.deepEqual(moveStream(streams, "one", "three"), { sourceIndex: 0, targetIndex: 2 });
  assert.deepEqual(streams.map(({ id }) => id), ["two", "three", "one"]);
  assert.deepEqual(moveStream(streams, "one", "two"), { sourceIndex: 2, targetIndex: 0 });
  assert.deepEqual(streams.map(({ id }) => id), ["one", "two", "three"]);
});

test("stored color themes are limited to supported values", () => {
  assert.equal(normalizeTheme("dark"), "dark");
  assert.equal(normalizeTheme("light"), "light");
  assert.equal(normalizeTheme("system"), "system");
  assert.equal(normalizeTheme("invalid"), "system");
});
