# macOS Adaptation Plan

**Branch**: `mac_adaptation`
**Target**: ship a signed, notarized macOS build that installs cleanly via direct dmg download or `brew install --cask`.
**Authoring environment**: macOS 26.3, Apple Silicon (arm64), Xcode CLT present, Node 25.8 / npm 11.12.

**Implementation status (2026-05-03)**:
- Phase 1 platform fixes are implemented in this branch: macOS menu, bundle icon/metadata, darwin MCP config, unpacked MCP runtime, Windows-import attachment warnings, and README macOS sections.
- Phase 2 is signing-ready in code and CI, but still blocked on Apple Developer credentials in repository secrets.
- Phase 5 still needs a separate Homebrew tap repository and release SHA automation.

---

## 1. Current state assessment

What already works in the repo:

- Stack is portable: Electron 37 + React 19 + Vite 8, single JSON DB, no native modules (`docx` is pure JS — no `better-sqlite3`, `keytar`, `sharp`, `node-pty`, etc.). Nothing compiles natively.
- Paths use `os.homedir()` + `path.join` throughout (`electron/storage.cjs:67`).
- `dist:mac` script and `mac` target block already exist in `package.json` (dmg + zip, arm64 + x64).
- CI matrix already runs `macos-latest` (`.github/workflows/build.yml`).
- `app.on('window-all-closed')` correctly skips quit on darwin (`electron/main.cjs:631`).

What's missing:

- No menu template — Cmd+C/V/X/A/Z and the standard macOS app menu won't behave correctly.
- No `.icns` icon, no display-name metadata in `extendInfo`.
- `hardenedRuntime: false`, `gatekeeperAssess: false`, `identity: null` — i.e. unsigned, unnotarized; users hit Gatekeeper's "damaged" wall.
- MCP config emitted by `buildMcpInfo` used to rely on `process.execPath`; this branch now emits `node` + the unpacked `mcp-cli.cjs` path on darwin.
- `windowsPathToCurrentPlatform` used to map imported Windows asset paths to `/mnt/c/...` on every non-Windows platform; this branch now warns and marks those attachments as re-link-needed on darwin.
- README previously declared "Windows x64 binaries only"; this branch adds macOS install and MCP guidance.
- No Homebrew Cask, no tap repo, no auto-bump workflow.

The codebase is essentially cross-platform. The work is in **packaging, identity, UX polish, and distribution**, not in the application itself.

---

## 2. Repository context

- **Upstream**: `git@github.com:1690834643/scipaper-todo-app.git` — the original Windows-targeted project.
- **Working fork**: `git@github.com:MeiChern/scipaper-todo-app.git` — `origin` on this clone. SSH key access is configured on this machine, so `git push origin mac_adaptation` works without further auth.
- **Committer identity for this branch** (set repo-locally, not globally):
  ```
  git config user.name  "MeiChern"
  git config user.email "meichernpku@outlook.com"
  ```
- **Upstream remote** (optional, useful for pulling fixes from `1690834643`):
  ```
  git remote add upstream git@github.com:1690834643/scipaper-todo-app.git
  git fetch upstream
  ```
- **Contribution path**: development happens on `MeiChern/scipaper-todo-app:mac_adaptation`. Once Phase 4 verification passes, decide between:
  - PR upstream to `1690834643/scipaper-todo-app:main` (gives the original project macOS support).
  - Maintain the fork as the canonical macOS distribution (own release tags, own Homebrew tap).
  - Both — upstream the application changes, keep the tap and CI signing keys on the fork.

## 3. Branch and workflow

- Work happens on `mac_adaptation`, branched from `main` on the fork.
- Each phase below merges via its own PR into `mac_adaptation` (or directly if working solo). Keep commits surgical so any single phase can be reverted without unwinding the others.
- Phase 2 (signing/notarization) requires Apple Developer account credentials — block on that before starting Phase 2; everything else can proceed without it.
- Releases are tagged on the fork (`v1.0.30-mac.1` etc.) so they don't collide with upstream's tag namespace until/unless an upstream PR is merged.

---

## 4. Phase 0 — Local sanity (½ day, no blockers)

1. `npm ci && npm run dev` — confirm dev server + Electron come up on arm64 macOS 26.3.
2. `npm run dist:mac:arm64` — produce **unsigned** arm64 `.dmg` + `.zip`. Use `npm run dist:mac` only when you intentionally want both arm64 and x64.
3. Smoke test: create article → add text block → add image attachment → export docx, markdown, HTML. Confirm `~/Documents/SciPaperTodo/` populates correctly.
4. Confirm `safeStorage.isEncryptionAvailable()` returns true (Keychain backing) and that an LLM provider key persists across relaunch.

**Deliverable**: a screenshotted "it runs locally" report committed to the branch's PR description, plus any electron-builder warnings noted.

---

## 5. Phase 1 — Platform-correctness fixes (½–1 day)

### 5.1 macOS menu template

Add an explicit menu template in `electron/main.cjs` using `Menu.buildFromTemplate` with the standard `appMenu`, `editMenu` (so Cmd+C/V/X/A/Z work in all input contexts), `viewMenu`, `windowMenu`. Keep `autoHideMenuBar: true` for Windows but force the template on darwin. Without this, basic clipboard shortcuts misbehave in some focused inputs on macOS.

### 5.2 App icon and bundle metadata

- Generate `build/icon.icns` from a 1024×1024 source PNG using `iconutil -c icns build/icon.iconset`.
- Add to `package.json`:
  ```json
  "mac": {
    "icon": "build/icon.icns",
    "extendInfo": {
      "CFBundleName": "SciPaper Todo",
      "CFBundleDisplayName": "SciPaper Todo",
      "NSHumanReadableCopyright": "© nee"
    }
  }
  ```

### 5.3 MCP config: prefer `mcp-cli.cjs` over `process.execPath` on darwin

In `electron/main.cjs:84` `buildMcpInfo`, when `process.platform === 'darwin'`, emit a config that uses `node` + the absolute path to `mcp-cli.cjs` *inside the app bundle* (this branch uses `…/SciPaper Todo.app/Contents/Resources/app.asar.unpacked/electron/mcp-cli.cjs`). Two reasons:
- `process.execPath` for the GUI binary contains a space (`SciPaper Todo`) and a `.app/Contents/MacOS/...` path that some MCP clients fail to spawn.
- The CLI entry is already designed for non-Electron runtime use (see `electron/mcp-cli.cjs:7`).

External Node cannot load files or dependencies from Electron's asar archive. Keep the MCP CLI, Electron-side `.cjs` files, and runtime `node_modules` available outside asar. This branch uses `"asarUnpack": ["electron/**/*.cjs", "node_modules/**"]`; verify by spawning `node` against the resolved `app.asar.unpacked` path manually.

For users who specifically want the GUI binary to handle MCP, JSON-encode the path correctly (already implicit via `JSON.stringify`) and document it as the secondary path.

### 5.4 Windows-import path safety

In `electron/storage.cjs:437` `windowsPathToCurrentPlatform`, on darwin the previous `/mnt/c/...` mapping was meaningless. This branch logs a clear warning when a Windows-absolute attachment path is encountered on darwin and surfaces a non-fatal error in the UI ("This attachment was imported from Windows; please re-link it"). Defer the actual re-link UI to a later release unless cross-platform DB sync becomes a priority.

### 5.5 README

Strip the "Windows x64 binaries only" caveat. Add a macOS install section that covers both direct download and `brew install --cask` (after Phase 5 lands). Add a macOS-flavored MCP config snippet using the `node mcp-cli.cjs` form.

---

## 6. Phase 2 — Signing, hardened runtime, notarization (1 day + Apple account lead time)

Without this, every download is gated by Gatekeeper showing "damaged / can't be opened." Users will believe the app is broken.

### 6.1 Apple Developer account

- $99/yr. Required.
- Create a **Developer ID Application** certificate (NOT "Apple Distribution" — that's Mac App Store). Export as `.p12` with a strong password.
- In App Store Connect, generate an **API Key** with the "Developer" role for notarization. Capture: `Issuer ID`, `Key ID`, the `.p8` private key file. Prefer this over app-specific passwords — it's the modern path and survives Apple ID 2FA changes.

### 6.2 electron-builder config changes

In the `mac` block:

```json
"mac": {
  "hardenedRuntime": true,
  "gatekeeperAssess": false,    // keep false — assessment happens post-notarization
  "entitlements": "build/entitlements.mac.plist",
  "entitlementsInherit": "build/entitlements.mac.plist",
  "notarize": true
}
```

Remove `"identity": null` so electron-builder picks up the cert from the keychain (or from `CSC_LINK` / `CSC_KEY_PASSWORD` in CI).

### 6.3 Entitlements

`build/entitlements.mac.plist` — minimal set required for Electron + V8 under hardened runtime:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.cs.disable-library-validation</key>
  <true/>
</dict>
</plist>
```

These three are the canonical Electron set. Do not add network or file-system entitlements unless you target the Mac App Store sandbox.

### 6.4 CI plumbing

In the GitHub repo settings, add secrets:

- `MAC_CERTS` — base64 of the `.p12`
- `MAC_CERTS_PASSWORD` — `.p12` password
- `APPLE_API_KEY` — base64 of the `.p8` private key; the workflow writes it to `$RUNNER_TEMP/AuthKey_<KEY_ID>.p8`
- `APPLE_API_KEY_ID`
- `APPLE_API_ISSUER`

In `.github/workflows/build.yml`, on the macos-latest tag-build step inject:

```yaml
env:
  CSC_LINK: ${{ secrets.MAC_CERTS }}
  CSC_KEY_PASSWORD: ${{ secrets.MAC_CERTS_PASSWORD }}
  APPLE_API_KEY: ${{ runner.temp }}/AuthKey_${{ secrets.APPLE_API_KEY_ID }}.p8
  APPLE_API_KEY_ID: ${{ secrets.APPLE_API_KEY_ID }}
  APPLE_API_ISSUER: ${{ secrets.APPLE_API_ISSUER }}
  GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Keep the existing `CSC_IDENTITY_AUTO_DISCOVERY: 'false'` only on the **non-tag** sanity-check step so PR builds don't try to sign.

### 6.5 Verification

After CI produces a signed dmg from a tagged release:

```sh
codesign --verify --deep --strict --verbose=2 "/Applications/SciPaper Todo.app"
spctl --assess --type execute --verbose=4 "/Applications/SciPaper Todo.app"
# expect: source=Notarized Developer ID
```

Also verify the dmg itself (`spctl --assess --type open --context context:primary-signature`).

---

## 7. Phase 3 — Universal binary decision + auto-update strategy (½ day)

### 7.1 Architectures

Already configured to ship separate `arm64` and `x64` artifacts (`-arm64.dmg`, `-x64.dmg`). Recommend keeping the split — universal doubles the download size for no real benefit when the artifact name already disambiguates. Homebrew Cask can pick the right one via `on_arm` / `on_intel` blocks (Phase 5).

### 7.2 In-app auto-update

**Recommendation: do not add `electron-updater` for v1.** Reasons:

- Brew users get updates via `brew upgrade --cask`. An in-app updater that writes to `/Applications/SciPaper Todo.app` will desync brew's version tracking.
- For non-brew direct-download users, the GitHub release page is the update channel. Document it.
- If we add `electron-updater` later, gate it on a runtime check (e.g., absence of a `.brew-managed` marker file under `Contents/Resources/`) so brew installs skip the auto-updater.

---

## 8. Phase 4 — Verification matrix (½ day)

Before tagging v1 with macOS support:

- Install from dmg, drag to `/Applications`, launch — no Gatekeeper warning.
- `~/Documents/SciPaperTodo/` populates correctly on first run.
- `safeStorage` persists API keys (verify via Keychain Access — entry named `SciPaper Todo` or similar).
- Bundled MCP works from Claude Code using the recommended `node mcp-cli.cjs` config — 68 tools register, an article query returns data.
- docx export with an attached TIFF image (covers the `utif` path on darwin).
- Cmd+Q quits, Cmd+W closes window but app stays running, dock-click reopens window.
- Cmd+C/V/X/A/Z work in all input fields (validates Phase 1 menu template).
- Test on Intel Mac if accessible; otherwise ship arm64-first and add x64 verification post-launch.

---

## 9. Phase 5 — Homebrew Cask distribution (1 day)

Goal: `brew install --cask scipaper-todo` works, version bumps automatically on each GitHub release.

### 9.1 Tap repository

Create a separate public repo named `homebrew-scipaper-todo` under the same GitHub account. Homebrew convention: **tap repo name MUST start with `homebrew-`**. Users will install via:

```sh
brew tap 1690834643/scipaper-todo
brew install --cask scipaper-todo
# or single-shot:
brew install --cask 1690834643/scipaper-todo/scipaper-todo
```

### 9.2 Cask file

`Casks/scipaper-todo.rb` in the tap repo:

```ruby
cask "scipaper-todo" do
  version "1.0.30"

  on_arm do
    url "https://github.com/1690834643/scipaper-todo-app/releases/download/v#{version}/SciPaper-Todo-#{version}-arm64.dmg"
    sha256 "REPLACE_WITH_ARM64_SHA256"
  end

  on_intel do
    url "https://github.com/1690834643/scipaper-todo-app/releases/download/v#{version}/SciPaper-Todo-#{version}-x64.dmg"
    sha256 "REPLACE_WITH_X64_SHA256"
  end

  name "SciPaper Todo"
  desc "Local-first scientific manuscript IDE"
  homepage "https://github.com/1690834643/scipaper-todo-app"

  livecheck do
    url :url
    strategy :github_latest
  end

  auto_updates false   # brew handles updates; no electron-updater in v1

  app "SciPaper Todo.app"

  zap trash: [
    "~/Documents/SciPaperTodo",
    "~/Library/Application Support/SciPaper Todo",
    "~/Library/Preferences/com.nee.scipapertodo.plist",
    "~/Library/Saved Application State/com.nee.scipapertodo.savedState",
    "~/Library/Logs/SciPaper Todo",
  ]
end
```

Notes:
- `livecheck` with `:github_latest` lets `brew livecheck scipaper-todo` detect new releases.
- `zap` cleans user data on `brew uninstall --zap scipaper-todo`. The first entry (`~/Documents/SciPaperTodo`) is the user's data — keep it in `zap` (opt-in via `--zap`) but **never** in regular uninstall, which we get for free since `app` stanza only removes the `.app` bundle.
- The artifact name pattern (`SciPaper-Todo-${version}-${arch}.dmg`) already matches the electron-builder config (`artifactName: "${productName}-${version}-${arch}.${ext}"`) — keep them in sync if either is changed.

### 9.3 Auto-bump workflow

Two viable patterns:

**Pattern A (recommended): tap repo listens for repository_dispatch from main repo.**

In the main repo's `build.yml`, after a successful tagged release, add a step that fires a `repository_dispatch` to the tap repo with the new version + the two SHA256s. The tap repo has a workflow that opens a PR (or commits directly to `main`) updating the cask file.

**Pattern B: cron-based livecheck PR.**

A workflow in the tap repo runs daily, calls `brew livecheck --json scipaper-todo`, and if a new version is detected, runs a script that fetches the dmgs, computes SHAs, and opens a PR. Slower (up to 24h lag) but no cross-repo plumbing.

Recommend Pattern A for instant updates. Sketch of the dispatch step in main repo:

```yaml
- name: Notify tap repo
  if: startsWith(github.ref, 'refs/tags/v')
  run: |
    gh api repos/1690834643/homebrew-scipaper-todo/dispatches \
      -f event_type=new-release \
      -f "client_payload[version]=${GITHUB_REF#refs/tags/v}" \
      -f "client_payload[arm64_sha]=$(shasum -a 256 release/SciPaper-Todo-*-arm64.dmg | awk '{print $1}')" \
      -f "client_payload[x64_sha]=$(shasum -a 256 release/SciPaper-Todo-*-x64.dmg | awk '{print $1}')"
  env:
    GH_TOKEN: ${{ secrets.TAP_DISPATCH_TOKEN }}
```

`TAP_DISPATCH_TOKEN` is a fine-grained PAT with `contents: write` on the tap repo only.

### 9.4 Submission to homebrew-cask (optional, later)

Personal taps work indefinitely. If/when the app meets `homebrew-cask`'s notability requirements (~1k stars or external coverage), submit upstream so users can drop the `tap` step. Until then, the personal tap is the right home — and notarization (Phase 2) is a hard prerequisite for upstream acceptance anyway.

### 9.5 Other macOS package managers

- **MacPorts** — small GUI-app user base, builds from source by default, awkward fit for Electron. Skip.
- **Mac App Store** — requires sandboxing, breaks the JSON-DB-in-`~/Documents` layout and likely the MCP stdio model. Out of scope; revisit only if MAS distribution becomes a strategic goal.
- **Setapp** — curated subscription, requires partnership. Skip.

Conclusion: Homebrew Cask is the only macOS package-manager path that makes sense for v1.

---

## 10. Decisions to lock before starting

1. **Pay for Apple Developer account ($99/yr)?** If no → ship Phase 0/1/3/4/5 with an unsigned dmg and a README note about right-click → Open the first time. Strongly recommend yes; Gatekeeper friction kills adoption. Phase 5 (brew) still works unsigned but feels janky.
2. **Universal vs split arch?** Recommend split (already configured).
3. **In-app auto-updater?** Recommend no for v1 (Section 7.2).
4. **Tap repo name?** Suggest `1690834643/homebrew-scipaper-todo`. Locks in the brew install command shape.

---

## 11. Effort estimate

| Phase | Effort | External blocker |
|---|---|---|
| 0 — local sanity | 0.5 d | none |
| 1 — platform fixes | 0.5–1 d | none |
| 2 — sign + notarize | 1 d | Apple Dev account (1–2 day approval) |
| 3 — arch + auto-update | 0.5 d | none |
| 4 — verification | 0.5 d | none |
| 5 — Homebrew Cask | 1 d | tap repo creation, PAT |
| **Total** | **~4 working days** | + Apple account lead time |

---

## 12. Out of scope for this branch

- Linux binaries (AppImage / deb / Snap / Flatpak).
- Mac App Store submission.
- In-app auto-updater (`electron-updater`).
- Cross-platform DB sync / re-link UI for Windows-imported attachment paths.
- Migrating the JSON DB to SQLite (separate effort, no macOS dependency).
