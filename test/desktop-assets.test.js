import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("desktop icon assets exist for Windows, macOS, and Linux", async () => {
  const requiredAssets = [
    "assets/streammatrix-icon.ico",
    "assets/streammatrix-icon.icns",
    "assets/linux/16x16.png",
    "assets/linux/32x32.png",
    "assets/linux/48x48.png",
    "assets/linux/128x128.png",
    "assets/linux/256x256.png",
    "assets/linux/512x512.png"
  ];

  await Promise.all(requiredAssets.map((path) => access(projectFile(path))));
});

test("desktop icon assets use the expected platform file formats", async () => {
  const ico = await readFile(projectFile("assets/streammatrix-icon.ico"));
  const icns = await readFile(projectFile("assets/streammatrix-icon.icns"));
  const png = await readFile(projectFile("assets/linux/512x512.png"));

  assert.deepEqual([...ico.subarray(0, 4)], [0, 0, 1, 0]);
  assert.equal(icns.subarray(0, 4).toString("ascii"), "icns");
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});

test("package configuration defines all native distribution targets", async () => {
  const packageJson = JSON.parse(await readFile(projectFile("package.json"), "utf8"));

  assert.equal(packageJson.build.win.icon, "assets/streammatrix-icon.ico");
  assert.equal(packageJson.build.mac.icon, "assets/streammatrix-icon.icns");
  assert.equal(packageJson.build.linux.icon, "assets/linux");
  assert.equal(packageJson.desktopName, "streammatrix.desktop");
  assert.equal(packageJson.build.linux.syncDesktopName, true);
  assert.equal(packageJson.build.win.target[0].target, "portable");
  assert.equal(packageJson.build.mac.target[0].target, "dmg");
  assert.equal(packageJson.build.mac.target[0].arch[0], "universal");
  assert.equal(packageJson.build.linux.target[0].target, "AppImage");
  assert.match(packageJson.scripts["dist:win"], /--publish never/);
  assert.match(packageJson.scripts["dist:mac"], /--publish never/);
  assert.match(packageJson.scripts["dist:linux"], /--publish never/);
});

test("GitHub release workflow includes native runners for every platform", async () => {
  const workflow = await readFile(projectFile(".github/workflows/release.yml"), "utf8");

  assert.match(workflow, /os: windows-latest/);
  assert.match(workflow, /os: macos-latest/);
  assert.match(workflow, /os: ubuntu-latest/);
  assert.match(workflow, /npm run dist:win/);
  assert.match(workflow, /npm run dist:mac/);
  assert.match(workflow, /npm run dist:linux/);
  assert.match(workflow, /gh release upload/);
});
