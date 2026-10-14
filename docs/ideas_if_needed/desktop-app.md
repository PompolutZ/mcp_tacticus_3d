# Desktop app

Status: idea. Chosen wrapper: Tauri v2.

The goal is to ship the game as an app for Mac and Windows, not only as a website. The app should run without an installer.

## Wrapper options

| Option | Engine | Size added | Notes |
|---|---|---|---|
| Tauri v2 (chosen) | The engine in the OS: WebKit (WKWebView) on Mac, WebView2 (Chromium) on Windows | ~10 MB | Small. No Rust code needed for a static app. On Mac it is the Safari engine. |
| Electron | Its own Chromium | ~100–150 MB | Same engine on every OS. Use it if WKWebView shows rendering or physics differences on Mac, or if Linux matters. |
| PWA | The browser | 0 | Least work. The user still opens it from a browser first. |
| Electrobun, Wails, Neutralino | Like Tauri | small | Newer or smaller. Not chosen. |

`apps/web/dist` is ~332 MB, mostly assets. So the wrapper size matters less than usual.

## Run without installation

- Windows: Tauri builds one `.exe` that runs directly. WebView2 is already on Windows 10 and 11.
- Mac: a `.app` in a `.zip` or `.dmg`. The user double-clicks it. Copying it to Applications is optional.

## Code signing

- Mac: macOS 15 removed the right-click → Open bypass. An unsigned app is blocked until the user allows it in System Settings → Privacy & Security. Signing needs an Apple Developer ID ($99/year) and notarization.
- Windows: an unsigned app shows a SmartScreen warning ("More info → Run anyway"). Microsoft Trusted Signing (Azure, ~$10/month) removes most of it.
- For a small group of friends, unsigned builds and a short "how to open" note are enough. For the public, signing is needed.

## WebRTC

The game uses only WebRTC data channels (`src/net/peer.js`), with no camera or microphone.

| Wrapper | Data channels |
|---|---|
| Tauri on Windows | Yes. WebView2 is Chromium. |
| Tauri on Mac | Yes. WKWebView has `RTCPeerConnection` and data channels, same engine as Safari. |
| Tauri on Linux | Often no. Many WebKitGTK builds have WebRTC turned off. |
| Electron | Yes, same as Chrome. |

The website and the app can connect to each other, because both use the same signaling and TURN servers.

## Changes the app needs

- Assets load from the app bundle, not over HTTP from the site. Tauri serves the bundle through its own protocol.
- API and TURN URLs are absolute, not relative to the site.
- CORS on the API allows the app origins: `tauri://localhost` (Mac) and `http://tauri.localhost` (Windows).
- Mac: `NSLocalNetworkUsageDescription` in `Info.plist`. Since macOS 15, an app must ask before it connects to devices on the LAN. WebRTC tries LAN connections first when two players are on the same network. macOS shows the prompt once. If the user says no, the connection goes through TURN or a public address. It still works, but it is slower.
- Windows: the first UDP use can show the Defender firewall dialog. If the user clicks Cancel, the connection still works through TURN.
- IndexedDB data in the app is separate from the browser's data.
