import { describe, expect, it } from "vitest";
import { addressFor, readLaunch } from "../src/navigation/launch.js";

const read = (search, cloudConfigured = true) =>
  readLaunch(search, { cloudConfigured });

describe("readLaunch", () => {
  it("opens the cajitas when nothing is asked", () => {
    expect(read("")).toEqual({ tab: "goals", inviteCode: "", gmail: "" });
  });

  it("opens the tutorial", () => {
    expect(read("?tutorial=1").tab).toBe("tutorial");
    expect(read("?tutorial=0").tab).toBe("goals");
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

  it("opens Conexiones when Gmail comes back, whichever way it ended", () => {
    expect(read("?gmail=connected")).toMatchObject({
      tab: "connections",
      gmail: "connected",
    });
    expect(read("?gmail=cancelled").gmail).toBe("cancelled");
  });

  it("lets a link ask for several; the later screen wins", () => {
    expect(read("?tutorial=1&pareja=ABC123").tab).toBe("partner");
    expect(read("?pareja=ABC123&gmail=connected").tab).toBe("connections");
  });
});

describe("addressFor", () => {
  const base = "https://x.test/CAJITAS-/";
  it("keeps the tutorial in the address while it is open", () => {
    expect(addressFor(base, "tutorial")).toBe("/CAJITAS-/?tutorial=1");
  });

  it("drops it when the person leaves the tutorial", () => {
    expect(addressFor(`${base}?tutorial=1`, "goals")).toBe("/CAJITAS-/");
  });

  it("drops what a link asked for once, and keeps the rest", () => {
    expect(
      addressFor(
        `${base}?pareja=ABC&gmail=connected&tab=account&x=1#h`,
        "partner",
      ),
    ).toBe("/CAJITAS-/?x=1#h");
  });

  it("leaves a clean address alone", () => {
    expect(addressFor(`${base}?x=1`, "goals")).toBe("/CAJITAS-/?x=1");
  });
});
