import { isNative } from "./platform.js";
import { handleWebConnection, listenForGmailLink } from "./gmail/connection.js";
import { listenForBack } from "./navigation/native.js";

/** What the app listens to once it is on screen: Gmail coming back, and the
 * back button on the phone. */
export async function setupNativeEvents() {
  if (!isNative) return handleWebConnection();
  await listenForGmailLink();
  await listenForBack();
}
