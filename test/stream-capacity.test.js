import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import * as stateHelpers from "../public/state.js";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

// Supply the renderer's browser dependencies and observe its registered UI handlers.
function startRenderer(stored = null) {
  const nodes = new Map();
  function node() {
    const children = new Map();
    const classes = new Set();
    return {
      children: [],
      dataset: {},
      handlers: {},
      style: new Map(),
      classList: {
        toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); },
        contains(name) { return classes.has(name); }
      },
      value: "",
      lastChild: {},
      querySelector(selector) {
        if (!children.has(selector)) children.set(selector, node());
        return children.get(selector);
      },
      querySelectorAll() { return this.children.filter((child) => child.dataset.streamId); },
      addEventListener(type, handler) { this.handlers[type] = handler; },
      setAttribute() {},
      replaceChildren() { this.children = []; },
      append(child) { this.children.push(child); },
      cloneNode() { return node(); },
      focus() {}
    };
  }

  function select(selector) {
    if (!nodes.has(selector)) {
      const element = node();
      element.style.setProperty = element.style.set.bind(element.style);
      element.content = { firstElementChild: node(), cloneNode: node };
      nodes.set(selector, element);
    }
    return nodes.get(selector);
  }

  let serialized = JSON.stringify(stored);
  select("#platform-select").value = "twitch";
  runInNewContext(source.replace(/^import .+\r?\n/, ""), {
    ...stateHelpers,
    document: { querySelector: select, createElement: node, documentElement: node(), addEventListener() {} },
    window: { location: { hostname: "localhost" }, matchMedia: node, prompt: () => "Full matrix" },
    localStorage: { getItem: () => serialized, setItem: (_key, value) => { serialized = value; } },
    setTimeout() {},
    clearTimeout() {}
  }, { filename: new URL("../public/app.js", import.meta.url).pathname });

  return {
    select,
    get stored() { return JSON.parse(serialized); },
    async submit(names) {
      select("#stream-input").value = names.join(", ");
      await select("#add-stream-form").handlers.submit({ preventDefault() {} });
    }
  };
}

const names = Array.from({ length: 16 }, (_, index) => 'channel' + (index + 1));

test("the add form admits 15 streams and rejects submissions beyond capacity", async () => {
  const renderer = startRenderer();
  const grid = renderer.select("#stream-grid");

  for (const [from, to, columns] of [[0, 1, 1], [1, 4, 2], [4, 9, 3], [9, 12, 4], [12, 14, 5]]) {
    await renderer.submit(names.slice(from, to));
    assert.equal(grid.children.length, to);
    assert.equal(grid.style.get("--columns"), columns);
  }

  await renderer.submit(names.slice(14));
  assert.equal(grid.children.length, 14);
  assert.equal(renderer.select("#form-message").textContent, "You can add 1 more stream.");

  await renderer.submit(names.slice(14, 15));
  assert.equal(grid.children.length, 15);
  assert.equal(renderer.select("#stream-count").textContent, "15 streams");
  assert.deepEqual(renderer.stored.streams.map(({ name }) => name), names.slice(0, 15));

  await renderer.submit(names.slice(15));
  assert.equal(grid.children.length, 15);
  assert.equal(renderer.select("#form-message").textContent, "StreamMatrix supports up to 15 streams at once.");
});

test("reloading and restoring a saved layout keeps 15 valid streams in order", async () => {
  const original = startRenderer();
  await original.submit(names.slice(0, 15));
  original.select("#save-layout-button").handlers.click();
  const stored = original.stored;
  const extra = { id: "extra", name: "extra", platform: "kick" };
  stored.streams.push(extra);
  stored.savedLayouts[0].streams.push(extra);

  const reopened = startRenderer(stored);
  const grid = reopened.select("#stream-grid");
  assert.equal(grid.children.length, 15);
  assert.deepEqual(reopened.stored.streams.map(({ name }) => name), names.slice(0, 15));

  reopened.select("#saved-layout-select").value = stored.savedLayouts[0].id;
  reopened.select("#load-layout-button").handlers.click();
  assert.equal(grid.children.length, 15);
  assert.deepEqual(reopened.stored.streams.map(({ name }) => name), names.slice(0, 15));
});

test("expanded grids reserve Twitch-sized player tracks and preserve the mobile layout", async () => {
  const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  assert.match(css, /@media \(min-width: 761px\) \{\s*\.stream-grid-expanded \{[^}]*repeat\(auto-fit, minmax\(min\(100%, max\(400px,/);
  assert.match(css, /\.stream-grid-expanded \{[^}]*grid-auto-rows: minmax\(352px, 1fr\)/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.stream-grid \{[^}]*grid-template-columns: 1fr/);
  for (const [count, expanded] of [[9, false], [10, true], [15, true]]) {
    const renderer = startRenderer({ streams: names.slice(0, count).map((name) => ({
      id: name, name, platform: "twitch"
    })) });
    assert.equal(renderer.select("#stream-grid").classList.contains("stream-grid-expanded"), expanded);
  }
});
