import { describe, expect, it } from "vitest";

import { fmt, fmtFechaHoraUtc, fmtFechaUtc } from "./fmt";

describe("fmt — números del reporte", () => {
  it("usa en-US, coma de miles y dos decimales fijos", () => {
    expect(fmt(1234.5)).toBe("1,234.50");
    expect(fmt(0)).toBe("0.00");
    expect(fmt(15726.126546)).toBe("15,726.13");
  });

  it("no imprime un cero negativo, que se lee como defecto", () => {
    expect(fmt(-0)).toBe("0.00");
    expect(fmt(-0.0000001)).toBe("0.00");
    expect(fmt(-0.004)).toBe("0.00");
  });

  it("conserva el redondeo y el signo de un valor distinto de cero", () => {
    expect(fmt(-0.005)).toBe("-0.01");
    expect(fmt(-1.234)).toBe("-1.23");
  });

  it("respeta la cantidad de decimales pedida", () => {
    expect(fmt(1.005, 3)).toBe("1.005");
    expect(fmt(-0.0001, 3)).toBe("0.000");
  });
});

describe("fmtFechaUtc / fmtFechaHoraUtc — el selector formatea en UTC", () => {
  it("imprime dd/mm/yyyy hh:mm sin coma y en 24 horas", () => {
    expect(fmtFechaHoraUtc("2025-09-30T18:30:00.000Z")).toBe("30/09/2025 18:30");
    expect(fmtFechaHoraUtc("2025-09-01T08:05:00.000Z")).toBe("01/09/2025 08:05");
  });

  it("no corre la fecha con la zona del proceso", () => {
    // 23:30 UTC es el día siguiente en media Europa: debe seguir siendo 30/09.
    expect(fmtFechaHoraUtc("2025-09-30T23:30:00.000Z")).toBe("30/09/2025 23:30");
    expect(fmtFechaHoraUtc("2025-10-01T00:15:00.000Z")).toBe("01/10/2025 00:15");
  });

  it("imprime sólo la fecha cuando alcanza", () => {
    expect(fmtFechaUtc("2025-09-30T18:30:00.000Z")).toBe("30/09/2025");
  });

  it("devuelve vacío con null o un valor inválido", () => {
    expect(fmtFechaUtc(null)).toBe("");
    expect(fmtFechaHoraUtc(null)).toBe("");
    expect(fmtFechaHoraUtc("no-es-fecha")).toBe("");
  });
});
