import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const paneModule = await readFile(
  new URL("../electron/main/local-network-settings.ts", import.meta.url),
  "utf8",
);
const protocol = await readFile(
  new URL("../../../packages/shared/src/protocol.ts", import.meta.url),
  "utf8",
);
const appIpc = await readFile(
  new URL("../electron/main/ipc/app-ipc.ts", import.meta.url),
  "utf8",
);
const transcript = await readFile(
  new URL("../src/features/chat/transcript/shared.tsx", import.meta.url),
  "utf8",
);
const en = await readFile(
  new URL("../../../packages/i18n/src/locales/en/index.ts", import.meta.url),
  "utf8",
);

test("the Local Network pane URL is a main-owned constant, never caller-supplied", () => {
  assert.match(
    paneModule,
    /export const LOCAL_NETWORK_PANE_URL =\s*\n\s*"x-apple\.systempreferences:com\.apple\.Local-Network-Settings-Extension";/,
  );
  // openExternal is only called with the constant, and the handler takes no
  // input from the renderer (D330: renderer- or plugin-supplied schemes never
  // reach the OS).
  assert.doesNotMatch(paneModule, /openExternal\((?!\(LOCAL_NETWORK_PANE_URL\)|LOCAL_NETWORK_PANE_URL)/);
  assert.match(paneModule, /shell\.openExternal\(LOCAL_NETWORK_PANE_URL\)/);
});

test("the IPC channel exists, is registered without renderer input, and is wired in the renderer API", () => {
  assert.match(protocol, /appOpenLocalNetworkSettings: "pi-desktop\/app\/openLocalNetworkSettings"/);
  assert.match(appIpc, /IPC\.invoke\.appOpenLocalNetworkSettings/);
  // The handler body must not read any argument from the event.
  const handler = appIpc.slice(
    appIpc.indexOf("appOpenLocalNetworkSettings"),
    appIpc.indexOf("appOpenLocalNetworkSettings") + 300,
  );
  assert.ok(!/input|args/.test(handler.slice(handler.indexOf("=>"))));
  // The renderer wrapper passes no payload either.
  assert.match(
    transcript.replace(/\s+/g, " "),
    /api\.openLocalNetworkSettings\(\)\.catch/,
  );
});

test("the error card offers the pane only for unreachable LAN-class network failures", () => {
  // Gated on the coarse category, not on a raw errno string.
  assert.match(transcript, /networkCategory === "unreachable"/);
  assert.match(transcript, /error\.code === "NETWORK_ERROR" && networkCategory === "unreachable"/);
});

test("the action label exists in every locale catalog", async () => {
  const locales = [
    "en",
    "zh-CN",
    "zh-TW",
    "tr",
    "de",
    "es",
    "fr",
    "ko",
    "pt-BR",
  ];
  for (const locale of locales) {
    const source = await readFile(
      new URL(`../../../packages/i18n/src/locales/${locale}/index.ts`, import.meta.url),
      "utf8",
    );
    assert.match(
      source,
      /openLocalNetworkSettings/,
      `${locale} misses the key`,
    );
  }
  // The English label anchors the key's meaning; type parity enforces the rest.
  assert.match(en, /openLocalNetworkSettings: "Open Local Network settings"/);
});
