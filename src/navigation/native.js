/** The phone's back button: closes an open dialog, then goes back, and with
 * nothing left to go back to it means "home" (see useNavigation). */
export async function listenForBack() {
  const { App } = await import("@capacitor/app");
  await App.addListener("backButton", ({ canGoBack }) => {
    const dialog = document.querySelector("dialog[open]");
    if (dialog) dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    else if (canGoBack) history.back();
    else window.dispatchEvent(new Event("guardadito:back"));
  });
}
