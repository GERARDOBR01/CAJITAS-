import { describe, it, expect, vi } from "vitest";
import { initialData, STORAGE_KEY } from "../src/domain.js";
import { createJournalStore } from "../src/journal/store.js";
import { memoryStorage } from "../src/journal/memoryStorage.js";
import { restoreWithoutReminders } from "../src/pet/reminders.js";

const goal = (id) => ({
  id,
  name: `Meta ${id}`,
  provider: "Nu",
  icon: "star",
  targetCents: 100000,
  unlockDate: "",
  entries: [],
});
const withGoal = (data, id = "a") => ({
  ...data,
  goals: [...data.goals, goal(id)],
});
const open = (initial = null, options = {}) => {
  const storage = memoryStorage(initial);
  let clock = 1000;
  const store = createJournalStore({
    storage,
    now: () => clock++,
    ...options,
  });
  const events = [];
  store.subscribe((event) => events.push(event.type));
  return { store, storage, events };
};

describe("journal store", () => {
  it("starts empty when nothing is stored", () => {
    const { store } = open();
    expect(store.get().goals).toEqual([]);
    expect(store.getSnapshot().recovery).toBeNull();
  });

  it("saves, stamps a growing savedAt and tells listeners", () => {
    const { store, storage, events } = open();
    expect(store.save(withGoal(store.get()))).toEqual({ ok: true });
    const first = store.get().savedAt;
    expect(JSON.parse(storage.read()).goals).toHaveLength(1);
    store.save(withGoal(store.get(), "b"));
    expect(store.get().savedAt).toBeGreaterThan(first);
    expect(events).toEqual(["saved", "saved"]);
  });

  it("keeps savedAt growing even when the clock goes back", () => {
    const { store } = open(null, { now: () => 5 });
    store.save(withGoal(store.get()));
    store.save(withGoal(store.get(), "b"));
    expect(store.get().savedAt).toBe(6);
  });

  it("refuses a change made from an older copy", () => {
    const { store } = open();
    const old = store.get();
    store.save(withGoal(old));
    expect(store.save(withGoal(old, "b"))).toEqual({
      ok: false,
      reason: "stale",
    });
    expect(store.get().goals).toHaveLength(1);
  });

  it("refuses to save over text that changed in storage behind its back", () => {
    const { store, storage } = open();
    storage.write(JSON.stringify(withGoal(initialData(), "other")));
    expect(store.save(withGoal(store.get()))).toEqual({
      ok: false,
      reason: "stale",
    });
  });

  it("holds on to unreadable data until it is replaced", () => {
    const { store, storage } = open("{not json");
    expect(store.getSnapshot().recovery).toBe("unreadable");
    expect(store.save(withGoal(store.get()))).toEqual({
      ok: false,
      reason: "recovery",
    });
    expect(storage.read()).toBe("{not json");
    expect(store.readRaw()).toBe("{not json");
    expect(store.replace(withGoal(initialData())).ok).toBe(true);
    expect(store.getSnapshot().recovery).toBeNull();
    expect(store.save(withGoal(store.get(), "b")).ok).toBe(true);
  });

  it("reports a full storage and keeps the previous journal", () => {
    const { store, storage } = open();
    storage.failNextWrite(
      Object.assign(new Error("full"), { name: "QuotaExceededError" }),
    );
    expect(store.save(withGoal(store.get()))).toEqual({
      ok: false,
      reason: "quota",
    });
    expect(store.get().goals).toEqual([]);
    expect(store.save(withGoal(store.get())).ok).toBe(true);
  });

  it("explains an invalid journal with the validation message", () => {
    const { store } = open();
    const result = store.save({ ...store.get(), goals: "no" });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("invalid");
    expect(result.message).toMatch(/respaldo compatible/);
  });

  it("follows another tab and stops following if it wrote garbage", () => {
    const { store, storage, events } = open();
    storage.external(JSON.stringify(withGoal(initialData(), "tab2")));
    expect(store.get().goals[0].id).toBe("tab2");
    storage.external("garbage");
    expect(store.getSnapshot().recovery).toBe("external");
    expect(events).toEqual(["external", "external-invalid"]);
    expect(store.save(withGoal(store.get())).reason).toBe("recovery");
  });

  it("takes a copy from the account without sending it back", () => {
    const { store, storage, events } = open();
    const remote = { ...withGoal(initialData()), savedAt: 9999 };
    store.replace(remote, { remote: true });
    expect(store.get().savedAt).toBe(9999);
    expect(JSON.parse(storage.read()).savedAt).toBe(9999);
    expect(events).toEqual(["replaced"]);
  });

  it("counts a restore as a new save so the account gets it", () => {
    const { store, events } = open();
    store.save(withGoal(store.get()));
    store.replace(withGoal(initialData(), "restored"));
    expect(store.get().goals[0].id).toBe("restored");
    expect(events).toEqual(["saved", "saved"]);
  });

  it("keeps a second copy and says when it fails", async () => {
    const replica = vi
      .fn()
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error("no"));
    const { store, events } = open(null, { replica });
    store.save(withGoal(store.get()));
    store.save(withGoal(store.get(), "b"));
    await Promise.resolve();
    await Promise.resolve();
    expect(replica).toHaveBeenCalledTimes(2);
    expect(events).toContain("replica-failed");
    expect(store.get().goals).toHaveLength(2);
  });

  it("stores under the key the app has always used", () => {
    expect(STORAGE_KEY).toBe("guardadito:v1");
  });
});

describe("restoreWithoutReminders", () => {
  it("turns reminders off and leaves the rest alone", () => {
    const data = initialData();
    data.preferences.reminder.enabled = true;
    const restored = restoreWithoutReminders(data);
    expect(restored.preferences.reminder.enabled).toBe(false);
    expect(restored.preferences.reminder.time).toBe(
      data.preferences.reminder.time,
    );
    expect(data.preferences.reminder.enabled).toBe(true);
  });
});
