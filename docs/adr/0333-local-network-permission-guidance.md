# ADR 0333: The error card offers the macOS Local Network pane

- Status: Accepted
- Date: 2026-10-25
- Deciders: PI-Desktop maintainers
- Related: [ADR 0332](0332-macos-opaque-window-surface.md) ·
  [ADR 0168](0168-external-url-opening.md) ·
  [06-delivery/06-release-runbook](../spec/06-delivery/06-release-runbook.md) ·
  issue #573

## Context

On macOS 15+, an app that reaches a LAN address must hold Local Network access
(TCC). The grant is attributed to the *code signature*: macOS shows the
one-time prompt only when it can attribute the connecting binary to an
identified app bundle.

Two properties of PI-Desktop's distribution interact badly with that:

1. The signed release lane (Developer ID + notarization) carries
   `NSLocalNetworkUsageDescription` and prompts correctly. Local
   `CSC_IDENTITY_AUTO_DISCOVERY=false` builds and hand-built DMGs end up
   **adhoc-signed**. An adhoc identity has no team to attribute, so macOS never
   shows the prompt, and LAN connects from the app and its
   `ELECTRON_RUN_AS_NODE` agent sidecar fail at once.
2. The failure surfaces as `EHOSTUNREACH` within milliseconds — the packet is
   rejected before it leaves the host — which reads like a routing or firewall
   problem. Nothing in the UI distinguishes it from a wrong base URL.

Measured on macOS 27, Apple Silicon: from the app's own binary,
`net.connect` to the LAN gateway and an mDNS multicast both fail `EHOSTUNREACH`
in ~5 ms, while `nc`/`ping` from platform-signed system binaries succeed. The
same app binary, re-signed adhoc with `codesign`, still fails — only a real
signing identity (or a manual grant in System Settings) changes the verdict.

The agent runtime already reports a coarse `networkCategory` with every
`NETWORK_ERROR` (`unreachable` for the `EHOSTUNREACH`/`ENETUNREACH` family), so
the renderer can recognize this case without new plumbing. The main process
already owns every external-URL decision (ADR 0168); a deep link must not
become the first renderer-supplied scheme.

## Decision

- The error card, for `NETWORK_ERROR` with `networkCategory: "unreachable"`,
  shows an **Open Local Network settings** action next to the existing
  actions. It invokes a new `appOpenLocalNetworkSettings` IPC channel.
- The pane URL is a **main-owned constant**
  (`electron/main/local-network-settings.ts`). The channel takes no renderer
  input, so the D330/ADR 0168 boundary — renderer- and plugin-supplied strings
  never reach `shell.openExternal` — is preserved. A deep link into a System
  Settings pane is a platform affordance, not user content.
- No in-app probe of Local Network status: TCC for the local-network
  permission has no query API. The action simply opens the pane where the user
  can see and flip the toggle; the next turn is the test.

## Consequences

- A user on macOS 15+ with an adhoc or unsigned build gets a one-click path to
  the toggle instead of an unexplained `EHOSTUNREACH`.
- The signed lane keeps prompting as before; the action is harmless there (the
  pane shows the app already granted).
- The label is a user-visible string: `errors.action.openLocalNetworkSettings`
  is added to all nine locale catalogs under the type-parity constraint.
- Platform-wise the action is offered everywhere; on non-macOS the pane URL is
  meaningless but the channel simply fails to open (it is macOS's scheme), and
  the `unreachable` category remains correct guidance for VPN/routing issues.
  A future platform-specific gate can hide the button once there is evidence
  it misleads.

## Alternatives considered

- **Detect the adhoc signature at startup and warn.** A banner in front of
  every local-build user, most of whom never touch a LAN provider, is noise;
  and TCC behavior varies by macOS version, so the warning would claim things
  the OS has not decided yet.
- **Trigger the TCC prompt proactively** (e.g. an mDNS browse at startup).
  This is exactly what an unattributed build cannot do — the prompt only
  exists for attributable apps. Nothing the app can code changes that.
- **Copy-only guidance** ("check System Settings → Local Network"). The pane
  is buried two levels deep; an action is the difference between instructions
  and a fix.

## Evidence

- Measured A/B on macOS 27 arm64: app binary `EHOSTUNREACH` in ~5 ms to the
  LAN gateway and mDNS; system `nc`/`ping` succeed on the same second; app
  binary re-signed adhoc still blocked; `x-apple.systempreferences:
  com.apple.Local-Network-Settings-Extension` opens the pane.
- Runbook, "Local Network permission" section, documents the packaging rule
  and this fallback path.
- Covered by `apps/desktop/test/local-network-settings.test.mjs`.
