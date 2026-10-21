/**
 * Main-owned deep link into the macOS Local Network privacy pane.
 *
 * The renderer never supplies the URL: the scheme is a fixed constant here, so
 * nothing renderer- or plugin-supplied can point `shell.openExternal` at an
 * arbitrary scheme (D330, ADR 0168). The pane URL is documented macOS behavior;
 * `open` resolves it even when System Settings is not running yet.
 */
import { shell } from "electron";

export const LOCAL_NETWORK_PANE_URL =
  "x-apple.systempreferences:com.apple.Local-Network-Settings-Extension";

/**
 * Open the Local Network pane of System Settings. Returns whether the OS
 * accepted the open request; the URL is a constant, so a `false` here means the
 * platform has no such pane (every macOS 15+ build has one) and the caller
 * should fall back to telling the user where to click.
 */
export async function openLocalNetworkPane(): Promise<boolean> {
  try {
    await shell.openExternal(LOCAL_NETWORK_PANE_URL);
    return true;
  } catch {
    return false;
  }
}
