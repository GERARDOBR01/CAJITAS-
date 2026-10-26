import { describe, expect, it } from "vitest";
import { PARENT, addressFor, readLaunch } from "../src/navigation/launch.js";

const read = (search, cloudConfigured = true, ownerTools = false) =>
  readLaunch(search, { cloudConfigured, ownerTools });

describe("readLaunch", () => {
  it("opens the cajitas when nothing is asked", () => {
    expect(read("")).toEqual({ tab: "goals", inviteCode: "", gmail: "" });
  });

  it("an old link to the practice tour opens the cajitas", () => {
    expect(read("?tutorial=1").tab).toBe("goals");
  });

  it("opens Mi cuenta only when the account exists in this install", () => {
    expect(read("?tab=account").tab).toBe("account");
    expect(read("?tab=account", false).tab).toBe("goals");
    expect(read("?tab=other").tab).toBe("goals");
  });

  it("opens Mi pareja with the partner's code", () => {
    expect(read("?pareja=ABC123")).toEqual({
      tab: "partner",
      inviteCode: "ABC123",
      gmail: "",
    });
  });

  it("Gmail only matters with the owner's tools", () => {
    expect(read("?gmail=connected")).toMatchObject({
      tab: "goals",
      gmail: "",
    });
    expect(read("?gmail=connected", true, true)).toMatchObject({
      tab: "connections",
      gmail: "connected",
    });
    expect(read("?pareja=ABC123&gmail=connected", true, true).tab).toBe(
      "connections",
    );
  });
});

describe("addressFor", () => {
  const base = "https://x.test/CAJITAS-/";
  it("drops what a link asked for once, and keeps the rest", () => {
    expect(
      addressFor(
        `${base}?pareja=ABC&gmail=connected&tab=account&tutorial=1&x=1#h`,
      ),
    ).toBe("/CAJITAS-/?x=1#h");
  });

  it("leaves a clean address alone", () => {
    expect(addressFor(`${base}?x=1`)).toBe("/CAJITAS-/?x=1");
  });
});

describe("back", () => {
  it("every screen leads back to Ajustes or home, never in a loop", () => {
    for (const [tab, parent] of Object.entries(PARENT)) {
      expect(["goals", "settings"]).toContain(parent);
      expect(parent).not.toBe(tab);
    }
    expect(PARENT.settings).toBe("goals");
  });
});
