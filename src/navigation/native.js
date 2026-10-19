/** The phone's back button: closes an open dialog, then goes back. With
 * nothing left to go back to, `guardadito:back` asks the screens to go home
 * (see useNavigation); if none does because the person is already home, the
 * app closes, as on any Android app. */
export async function listenForBack() {
  const { App } = await import("@capacitor/app");
  await App.addListener("backButton", async ({ canGoBack }) => {
    const dialog = document.querySelector("dialog[open]");
    if (dialog) dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    else if (canGoBack) history.back();
    else if (
      window.dispatchEvent(new Event("guardadito:back", { cancelable: true }))
    )
      await App.exitApp();
  });
}
