import { it, expect, vi } from "vitest";
import { createHmac } from "node:crypto";
import { getBitsoBalance, bitsoAuthorization } from "../server/bitso.js";
it("firma exactamente GET /api/v3/balance/ sin cuerpo y conserva monedas", async () => {
  const nonce = "1790000000000000",
    signature = createHmac("sha256", "test-secret")
      .update(nonce + "GET/api/v3/balance/")
      .digest("hex");
  expect(bitsoAuthorization("test-key", "test-secret", nonce)).toBe(
    `Bitso test-key:${nonce}:${signature}`,
  );
  const fetcher = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      success: true,
      payload: {
        balances: [
          {
            currency: "mxn",
            total: "200.00",
            available: "180.00",
            locked: "20.00",
          },
          { currency: "btc", total: "0.001", available: "0.001", locked: "0" },
        ],
      },
    }),
  });
  const result = await getBitsoBalance({
    key: "test-key",
    secret: "test-secret",
    nonce,
    fetcher,
  });
  expect(fetcher.mock.calls[0][0]).toBe("https://bitso.com/api/v3/balance/");
  expect(result.balances[1].total).toBe("0.001");
  expect(JSON.stringify(result)).not.toContain("test-secret");
});
