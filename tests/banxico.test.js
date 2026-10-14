import { describe, it, expect, vi } from "vitest";
import { getRates } from "../server/banxico.js";
const body = {
  bmx: {
    series: [
      {
        idSerie: "SF282",
        titulo: "Cetes a 28 días",
        datos: [{ fecha: "01/09/2026", dato: "7.12" }],
      },
      { idSerie: "SF43783", datos: [{ fecha: "02/09/2026", dato: "8.1234" }] },
    ],
  },
};
describe("Banxico con API mockeada (tasas sintéticas de prueba)", () => {
  it("usa header del servidor, IDs oficiales y fecha de cada publicación", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => body });
    const result = await getRates({ token: "test-token", fetcher });
    expect(fetcher.mock.calls[0][0]).toContain("SF43783,SF282/datos/oportuno");
    expect(fetcher.mock.calls[0][1].headers["Bmx-Token"]).toBe("test-token");
    expect(result.rates).toMatchObject([
      { id: "SF43783", annualRate: 8.1234, date: "02/09/2026" },
      { id: "SF282", annualRate: 7.12 },
    ]);
    expect(JSON.stringify(result)).not.toContain("test-token");
  });
  it("no inventa tasas ante N/E o serie ausente", async () => {
    const result = await getRates({
      token: "test",
      fetcher: async () => ({
        ok: true,
        json: async () => ({
          bmx: { series: [{ idSerie: "SF282", datos: [{ dato: "N/E" }] }] },
        }),
      }),
    });
    expect(
      result.rates.every((r) => r.annualRate === null && !r.available),
    ).toBe(true);
  });
  it("no consulta sin token y reporta fallos upstream", async () => {
    const fetcher = vi.fn();
    await expect(getRates({ token: "", fetcher })).rejects.toMatchObject({
      status: 503,
    });
    expect(fetcher).not.toHaveBeenCalled();
    await expect(
      getRates({ token: "test", fetcher: async () => ({ ok: false }) }),
    ).rejects.toMatchObject({ status: 502 });
  });
});
