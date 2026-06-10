# StreamMatrix

StreamMatrix is a local web application for watching multiple Twitch, Kick, and YouTube live streams in one responsive dashboard.

## Features

- Add up to nine streams by Twitch/Kick username or YouTube handle/live URL, including multiple entries at once.
- Automatically adapts the video grid to the number of active streams.
- Drag streams to change their layout order.
- Save, load, update, and delete named stream layouts.
- Optional right-side chat with a selector for the active stream.
- Mute or unmute every active stream without reloading the players.
- Light, dark, and system color themes that persist between sessions.
- Persists active streams and preferences in local browser storage.
- Restores the desktop window's size, position, and maximized state.
- Opens official platform login pages so supported embeds can use the same browser session.

## Run The Desktop App

Requires Node.js 20 or newer.

```sh
npm install
npm run desktop
```

## Native Builds

Build on the matching operating system:

```sh
npm run dist:win
npm run dist:mac
npm run dist:linux
```

- Windows produces both:
  - `dist/StreamMatrix-1.0.3-installer.exe`, an installable application with Start menu and desktop shortcuts.
  - `dist/StreamMatrix-1.0.3-portable.exe`, which runs without installation.
- macOS produces a universal Intel/Apple Silicon DMG.
- Linux produces an x64 AppImage. Run it with `chmod +x StreamMatrix-*.AppImage`.

The generic `npm run dist` command builds the configured target for the current operating system.
To build only one Windows package, use `npm run dist:win:installer` or `npm run dist:win:portable`.

## Release Builds

The GitHub Actions workflow at `.github/workflows/release.yml` builds all three platforms in parallel. It can be run manually from the Actions tab. Pushing a version tag such as `v1.0.3` also creates a GitHub Release containing the Windows installer and portable executable, universal macOS DMG, and Linux AppImage.

The release workflow creates unsigned builds by default. Windows SmartScreen and macOS Gatekeeper may warn users until platform signing certificates are configured.

## Application Icons

- Source PNG: `assets/streammatrix-icon.png`
- Windows ICO: `assets/streammatrix-icon.ico`
- macOS ICNS: `assets/streammatrix-icon.icns`
- Linux PNG icon set: `assets/linux/`

## Run In A Browser

```sh
npm start
```

Open `http://localhost:4173`. Provider embeds still work in this mode, but the cross-provider mute-all control requires the desktop application.

Run the tests with:

```sh
npm test
```

## Provider Notes

- Twitch requires the embedding hostname as a `parent` parameter, so StreamMatrix must be served through the included local server rather than opened as a file.
- YouTube handles are resolved server-side to the channel's current public live video. A direct live video URL also works.
- Kick's official popout chat can be viewed in the app, but Kick does not currently support signing in or sending messages from that popout. Use the link beneath the chat to participate on Kick directly.
- Opening, closing, or switching chat only updates the chat panel. Existing video player elements remain mounted and continue playing.
