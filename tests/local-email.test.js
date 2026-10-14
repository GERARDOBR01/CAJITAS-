import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_EMAIL_BYTES, parseLocalEmail } from "../src/mail/parseEmail.js";
import {
  applyLocalReceipt,
  possibleLocalMatches,
} from "../src/mail/receiptImport.js";
import {
  balance,
  correctManualEntry,
  initialData,
  possibleReceiptMatches,
  validateBackup,
} from "../src/domain.js";

const now = new Date("2026-10-14T12:00:00Z");
const fixture = async (name) =>
  new Uint8Array(
    await readFile(new URL(`./fixtures/${name}`, import.meta.url)),
  );
const parse = (input, options) => parseLocalEmail(input, { now, ...options });
const email = (body, headers = "") =>
  `From: Ejemplo <aviso@example.invalid>\r\nSubject: Deposito recibido\r\nDate: Thu, 1 Oct 2026 12:00:00 -0600\r\n${headers}\r\n${body}`;
const localId = (digit = "a") => `local-email:${digit.repeat(64)}`;
const receipt = (overrides = {}) => ({
  id: localId(),
  provider: "Nu",
  amountCents: 120050,
  at: "2026-10-01T18:00:00.000Z",
  ...overrides,
});
const goal = (overrides = {}) => ({
  id: "g1",
  name: "Viaje",
  provider: "Nu",
  icon: "star",
  targetCents: 1000000,
  unlockDate: "2026-11-01",
  entries: [],
  ...overrides,
});
const data = (goals = [goal()]) => ({ ...initialData(), goals });

describe("lectura local de correo sin confianza en el remitente", () => {
  it("extrae candidatos de un EML anónimo y exige revisión", async () => {
    const result = await parse(await fixture("local-receipt-plain.eml"));
    expect(result).toMatchObject({
      subject: "Deposito recibido",
      amountCents: 120050,
      at: "2026-10-01T18:00:00.000Z",
      authenticated: false,
      requiresReview: true,
      recognized: true,
    });
    expect(result.id).toMatch(/^local-email:[a-f0-9]{64}$/);
    expect(result.from).toContain("example.invalid");
    expect(result).not.toHaveProperty("provider");
    expect(result).not.toHaveProperty("body");
    expect(result.warnings.join(" ")).toContain("no autentica");
  });

  it("prefiere plain, decodifica QP/RFC2047 y omite adjuntos y calendario", async () => {
    const result = await parse(await fixture("local-receipt-multipart.eml"));
    expect(result.subject).toBe("Depósito recibido");
    expect(result.amountCents).toBe(120050);
    expect(result.preview).toContain("información requiere revisión");
    expect(result.preview).not.toMatch(/9,999|7,000|8,000|script/);
  });

  it("convierte HTML en texto sin ejecutar código ni cargar recursos", async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("No network");
    });
    vi.stubGlobal("fetch", fetchSpy);
    const result = await parse(await fixture("local-receipt-html.eml"));
    expect(result.amountCents).toBe(120050);
    expect(result.preview).not.toMatch(/<|script|globalThis|99,999|https:/);
    expect(globalThis.mailExecuted).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.authenticated).toBe(false);
    vi.unstubAllGlobals();
  });

  it("maneja base64 UTF-8, Latin1 y encabezados de asunto base64", async () => {
    const utf = await parse(
      email(
        Buffer.from("Depósito recibido: $45.29 MXN").toString("base64"),
        "Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n",
      ),
    );
    expect(utf.amountCents).toBe(4529);
    const latin = await parse(
      email(
        "Dep=F3sito recibido: $0.29 MXN",
        "Content-Type: text/plain; charset=ISO-8859-1\r\nContent-Transfer-Encoding: quoted-printable\r\n",
      ),
    );
    expect(latin.preview).toContain("Depósito");
    expect(latin.amountCents).toBe(29);
    const subject =
      "=?UTF-8?B?" + Buffer.from("Depósito recibido").toString("base64") + "?=";
    const encoded = await parse(
      email("Monto recibido: $1.00 MXN").replace(
        "Subject: Deposito recibido",
        `Subject: ${subject}`,
      ),
    );
    expect(encoded.subject).toBe("Depósito recibido");
  });

  it("conserva la identidad entre distintas codificaciones MIME", async () => {
    const text = "Depósito recibido: $45.29 MXN";
    const plain = email(text, "Content-Type: text/plain; charset=UTF-8\r\n");
    const b64 = email(
      Buffer.from(text).toString("base64"),
      "Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n",
    );
    expect((await parse(plain)).id).toBe((await parse(b64)).id);
    const messageId = "Message-ID: <identidad@example.invalid>\r\n";
    expect((await parse(email("Primer contenido", messageId))).id).toBe(
      (await parse(email("Contenido distinto", messageId))).id,
    );
    const future = email(text).replace(
      "Thu, 1 Oct 2026 12:00:00 -0600",
      "Thu, 15 Oct 2026 12:00:00 -0600",
    );
    expect((await parse(future)).id).toBe(
      (await parse(future, { now: new Date("2026-10-16T12:00:00Z") })).id,
    );
  });

  it("permite texto pegado sin inventar remitente ni fecha", async () => {
    const result = await parse(
      "Transferencia recibida. Monto recibido: $123.45 MXN",
      { format: "text" },
    );
    expect(result).toMatchObject({
      from: "",
      subject: "",
      at: null,
      amountCents: 12345,
      requiresReview: true,
    });
    const unknown = await parse("Documento cualquiera", { format: "text" });
    expect(unknown).toMatchObject({
      at: null,
      amountCents: null,
      recognized: false,
    });
    expect(unknown.warnings.length).toBeGreaterThan(1);
  });

  it("no elige entre montos MXN distintos ni acepta montos inválidos", async () => {
    const ambiguous = await parse(
      email("Deposito recibido: $1,200.50 MXN. Saldo: $3,000.00 MXN"),
    );
    expect(ambiguous.amountCents).toBeNull();
    expect(ambiguous.warnings.join(" ")).toContain("varios montos");
    for (const amount of [
      "$0 MXN",
      "$1000000001 MXN",
      "$1.234 MXN",
      "$1,20 MXN",
      "$100 USD",
    ])
      expect(
        (await parse(email(`Monto recibido: ${amount}`))).amountCents,
      ).toBeNull();
  });

  it.each(["pendiente", "rechazada", "cancelado", "Promoción", "cashback"])(
    "no sugiere un depósito al mencionar %s",
    async (status) => {
      const result = await parse(email(`Monto recibido: $100 MXN. ${status}`));
      expect(result.amountCents).toBeNull();
      expect(result.recognized).toBe(false);
    },
  );

  it("no sugiere fechas imposibles o futuras", async () => {
    for (const date of [
      "Tue, 31 Feb 2026 12:00:00 -0600",
      "Thu, 15 Oct 2026 12:00:00 -0600",
      "2026-10-01T25:00:00Z",
      "sin fecha",
    ])
      expect(
        (
          await parse(
            email("Monto recibido: $1 MXN").replace(
              "Thu, 1 Oct 2026 12:00:00 -0600",
              date,
            ),
          )
        ).at,
      ).toBeNull();
  });

  it("limita tamaño real en bytes, encabezados, partes y profundidad", async () => {
    await expect(parse("a".repeat(MAX_EMAIL_BYTES + 1))).rejects.toThrow(
      /2 MiB/,
    );
    await expect(parse("é".repeat(MAX_EMAIL_BYTES / 2 + 1))).rejects.toThrow(
      /2 MiB/,
    );
    await expect(parse(new Uint8Array(MAX_EMAIL_BYTES + 1))).rejects.toThrow(
      /2 MiB/,
    );
    await expect(
      parse(new Blob([new Uint8Array(MAX_EMAIL_BYTES + 1)])),
    ).rejects.toThrow(/2 MiB/);
    await expect(
      parse(`Subject: ${"x".repeat(65536)}\n\nbody`),
    ).rejects.toThrow(/encabezados/);
    const many = `Content-Type: multipart/mixed; boundary=x\n\n${"--x\nContent-Type: text/plain\n\na\n".repeat(65)}--x--`;
    await expect(parse(many)).rejects.toThrow(/partes MIME/);
    let nested = "Content-Type: text/plain\n\ntexto";
    for (let i = 0; i < 14; i++)
      nested = `Content-Type: multipart/mixed; boundary=b${i}\n\n--b${i}\n${nested}\n--b${i}--`;
    await expect(parse(nested)).rejects.toThrow(/niveles MIME/);
  });

  it("rechaza base64 malformado y limita la vista previa", async () => {
    await expect(
      parse(email("!!invalid!!", "Content-Transfer-Encoding: base64\r\n")),
    ).rejects.toThrow(/base64/);
    const result = await parse(
      email(`Monto recibido: $1 MXN ${"texto ".repeat(1000)}`),
    );
    expect(result.preview.length).toBeLessThanOrEqual(2000);
  });
});

describe("registro y conciliación revisados de correo local", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });
  afterEach(() => vi.useRealTimers());

  it("registra manual, deduplica y sigue deduplicando tras corregir el movimiento", () => {
    const saved = applyLocalReceipt(data(), receipt(), { goalId: "g1" });
    expect(saved.goals[0].entries[0]).toMatchObject({
      cents: 120050,
      source: "manual",
    });
    expect(balance(saved.goals[0])).toBe(120050);
    expect(applyLocalReceipt(saved, receipt(), { goalId: "g1" })).toBe(saved);
    const edited = correctManualEntry(
      saved,
      "g1",
      saved.goals[0].entries[0].id,
      { cents: 120000, at: "2026-10-02T12:00:00" },
    );
    expect(applyLocalReceipt(edited, receipt(), { goalId: "g1" })).toBe(edited);
    expect(validateBackup(edited).importedIds).toContain(receipt().id);
    expect(
      possibleReceiptMatches(saved, {
        id: "gmail-id",
        provider: "Nu",
        amountCents: 120050,
        at: receipt().at,
      }),
    ).toHaveLength(1);
  });

  it("incluye manual, Gmail y archivo; conciliar preserva originales e historial", () => {
    const entries = [
      { id: "m", cents: 120050, at: receipt().at, source: "manual" },
      { id: "g", cents: 120050, at: receipt().at, source: "gmail" },
      { id: "w", cents: -120050, at: "2026-10-02T18:00:00Z", source: "manual" },
    ];
    const original = data([
      goal({ entries }),
      goal({
        id: "archive",
        archived: true,
        entries: [{ id: "old", cents: 120050, at: receipt().at }],
      }),
      goal({
        id: "other-app",
        provider: "Bitso",
        entries: [{ id: "bitso", cents: 120050, at: receipt().at }],
      }),
    ]);
    expect(
      possibleLocalMatches(original, receipt()).map((match) => match.entryId),
    ).toEqual(["m", "g", "old"]);
    expect(() =>
      applyLocalReceipt(original, receipt(), { goalId: "g1" }),
    ).toThrow(/Elige el movimiento/);
    for (const match of [
      { goalId: "g1", entryId: "g" },
      { goalId: "archive", entryId: "old" },
    ]) {
      const next = applyLocalReceipt(original, receipt(), { match });
      expect(next.goals).toBe(original.goals);
      expect(next.goals).toEqual(original.goals);
      expect(balance(next.goals[0])).toBe(balance(original.goals[0]));
      expect(next.importedIds).toContain(receipt().id);
      expect(original.importedIds).toEqual([]);
    }
  });

  it("exige elección incluso con una coincidencia y admite confirmar un depósito distinto", () => {
    const original = data([
      goal({
        entries: [
          { id: "m", cents: 120050, at: receipt().at, source: "manual" },
        ],
      }),
    ]);
    expect(() =>
      applyLocalReceipt(original, receipt(), { goalId: "g1" }),
    ).toThrow();
    expect(() =>
      applyLocalReceipt(original, receipt(), {
        goalId: "g1",
        match: { goalId: "g1", entryId: "missing" },
      }),
    ).toThrow();
    expect(() =>
      applyLocalReceipt(original, receipt(), {
        goalId: "g1",
        allowDuplicate: "yes",
      }),
    ).toThrow();
    const distinct = applyLocalReceipt(original, receipt(), {
      goalId: "g1",
      allowDuplicate: true,
    });
    expect(balance(distinct.goals[0])).toBe(240100);
  });

  it("rechaza app incompatible, destino archivado o inexistente y fechas/montos inválidos", () => {
    for (const overrides of [
      { id: "not-local" },
      { provider: undefined },
      { provider: "Fake" },
      { amountCents: 0 },
      { amountCents: -1 },
      { amountCents: 1.5 },
      { amountCents: 1e11 + 1 },
      { at: "2026-02-30T12:00:00Z" },
      { at: "2026-10-15T12:00:00Z" },
      { at: "2026-10-01T24:01:00Z" },
    ])
      expect(() =>
        applyLocalReceipt(data(), receipt(overrides), { goalId: "g1" }),
      ).toThrow();
    expect(() =>
      applyLocalReceipt(data(), receipt({ provider: "Bitso" }), {
        goalId: "g1",
      }),
    ).toThrow(/misma app/);
    expect(() =>
      applyLocalReceipt(data([goal({ archived: true })]), receipt(), {
        goalId: "g1",
      }),
    ).toThrow(/activa/);
    expect(() =>
      applyLocalReceipt(data(), receipt(), { goalId: "missing" }),
    ).toThrow();
  });

  it("no oculta un saldo negativo previo al añadir un depósito", () => {
    const invalid = data([
      goal({ entries: [{ id: "w", cents: -1, at: "2026-09-01T12:00:00Z" }] }),
    ]);
    expect(() =>
      applyLocalReceipt(invalid, receipt(), { goalId: "g1" }),
    ).toThrow(/historial/);
    expect(invalid.goals[0].entries).toHaveLength(1);
  });
});
