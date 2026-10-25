import { describe, expect, it } from "vitest";
import { initialData } from "../src/domain.js";
import {
  forgetPrevious,
  keepPrevious,
  readPrevious,
} from "../src/journal/previous.js";
import { knownPushService } from "../server/push.js";
import { CLOUD_LIMIT_BYTES, cloudBytes } from "../src/cloud/useCloud.js";

function memory() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}
const withGoal = (name) => ({
  ...initialData(),
  goals: [
    {
      id: name,
      name,
      targetCents: 100000,
      unlockDate: null,
      provider: "Nu",
      icon: "star",
      entries: [],
    },
  ],
});

describe("la versión anterior del teléfono", () => {
  it("se guarda antes de que la cuenta la reemplace y se puede leer", () => {
    const storage = memory();
    expect(
      keepPrevious(withGoal("viaje"), withGoal("otra"), {
        storage,
        now: () => 7,
      }),
    ).toBe(true);
    const saved = readPrevious(storage);
    expect(saved.at).toBe(7);
    expect(saved.data.goals[0].name).toBe("viaje");
    forgetPrevious(storage);
    expect(readPrevious(storage)).toBeNull();
  });
  it("no guarda un teléfono vacío ni las mismas cajitas", () => {
    const storage = memory();
    expect(keepPrevious(initialData(), withGoal("a"), { storage })).toBe(false);
    expect(keepPrevious(withGoal("a"), withGoal("a"), { storage })).toBe(false);
    expect(readPrevious(storage)).toBeNull();
  });
  it("una copia dañada no truena", () => {
    const storage = memory();
    storage.setItem("guardadito:previous", "{roto");
    expect(readPrevious(storage)).toBeNull();
  });
});

describe("avisos", () => {
  it("solo se mandan a los servicios de push de los navegadores", () => {
    expect(knownPushService("https://web.push.apple.com/QGx")).toBe(true);
    expect(knownPushService("https://fcm.googleapis.com/fcm/send/abc")).toBe(
      true,
    );
    expect(
      knownPushService("https://wns2-by3p.notify.windows.com/w/?token=x"),
    ).toBe(true);
    expect(knownPushService("https://evil.test/x")).toBe(false);
    expect(knownPushService("http://web.push.apple.com/x")).toBe(false);
    expect(knownPushService("https://web.push.apple.com.evil.test/x")).toBe(
      false,
    );
    expect(knownPushService("no es url")).toBe(false);
  });
});

describe("tamaño en la cuenta", () => {
  it("cuenta bytes, no letras: los acentos pesan más", () => {
    const data = { ...initialData(), note: "ñ".repeat(1000) };
    expect(cloudBytes(data)).toBeGreaterThan(JSON.stringify(data).length);
    expect(CLOUD_LIMIT_BYTES).toBeLessThan(1048576);
  });
});
