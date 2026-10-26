import { isNative } from "../platform.js";
import { upcomingNotifications } from "../pet/reminders.js";

const LEGACY_REMINDER_ID = 71401;
const REMINDER_IDS = Array.from({ length: 12 }, (_, i) => 71500 + i);
let reminderListeners = false;

/** Ask for permission once, when the person turns reminders on. */
export async function allowReminders() {
  if (!isNative) return;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  const permission = await LocalNotifications.requestPermissions();
  if (permission.display !== "granted")
    throw new Error(
      "No se activó el recordatorio. Puedes permitir las notificaciones en los ajustes de tu dispositivo.",
    );
}

/** Replace the scheduled notifications with the next ones for this data.
 * Each one is a single dated notification so quincenas and rotating messages
 * stay exact. Returns the ids of the messages used, to avoid repeats. */
export async function syncReminders(data, now = new Date()) {
  const plan = upcomingNotifications(data, now);
  if (!isNative) return plan.recent;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  await LocalNotifications.cancel({
    notifications: [LEGACY_REMINDER_ID, ...REMINDER_IDS].map((id) => ({ id })),
  });
  if (!plan.items.length) return plan.recent;
  const { display } = await LocalNotifications.checkPermissions();
  if (display !== "granted") return plan.recent;
  await LocalNotifications.schedule({
    notifications: plan.items.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      schedule: { at: item.at, allowWhileIdle: false },
      actionTypeId: "cajitas-checkin",
      extra: { goalId: item.goalId },
    })),
  });
  return plan.recent;
}

/** Tapping a reminder opens the record dialog of that cajita; "Ahora no" only
 * acknowledges it. */
export async function listenToReminders(onAction) {
  if (!isNative || reminderListeners) return;
  reminderListeners = true;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  await LocalNotifications.registerActionTypes({
    types: [
      {
        id: "cajitas-checkin",
        actions: [
          { id: "save", title: "Guardar dinero", foreground: true },
          { id: "later", title: "Ahora no", foreground: false },
        ],
      },
    ],
  });
  await LocalNotifications.addListener(
    "localNotificationActionPerformed",
    ({ actionId, notification }) =>
      onAction({
        action: actionId === "later" ? "later" : "save",
        goalId: notification.extra?.goalId,
      }),
  );
}
