import { describe, expect, it } from "vitest";

import { formatFechaMovimiento, formatFechaVenta } from "./kardex-venta";

describe("formatFechaVenta", () => {
  it("usa d/M/yyyy H:mm sin ceros iniciales", () => {
    expect(formatFechaVenta(new Date("2026-08-17T15:47:00.000Z"))).toBe(
      "17/8/2026 15:47",
    );
  });

  it("formatea día, mes y hora de un dígito", () => {
    expect(formatFechaVenta(new Date("2026-01-05T09:07:00.000Z"))).toBe(
      "5/1/2026 9:07",
    );
  });

  it("siempre dos dígitos en los minutos", () => {
    expect(formatFechaVenta(new Date("2026-03-12T08:05:00.000Z"))).toBe(
      "12/3/2026 8:05",
    );
  });

  it("acepta un string", () => {
    expect(formatFechaVenta("2026-08-17T15:47:00.000Z")).toBe("17/8/2026 15:47");
  });

  it("devuelve guion largo para valores ausentes o inválidos", () => {
    expect(formatFechaVenta(null)).toBe("—");
    expect(formatFechaVenta(undefined)).toBe("—");
    expect(formatFechaVenta("")).toBe("—");
    expect(formatFechaVenta("no-es-fecha")).toBe("—");
  });
});

describe("formatFechaMovimiento", () => {
  it("agrega la salida cuando existe", () => {
    expect(
      formatFechaMovimiento(
        new Date("2026-08-17T15:47:00.000Z"),
        new Date("2026-08-17T17:10:00.000Z"),
      ),
    ).toBe("17/8/2026 15:47 · salida 17/8/2026 17:10");
  });

  it("devuelve solo la fecha líquida cuando no hay salida", () => {
    expect(
      formatFechaMovimiento(new Date("2026-08-17T15:47:00.000Z"), null),
    ).toBe("17/8/2026 15:47");
    expect(
      formatFechaMovimiento(new Date("2026-08-17T15:47:00.000Z"), undefined),
    ).toBe("17/8/2026 15:47");
  });

  it("devuelve un solo guion cuando faltan ambas fechas", () => {
    expect(formatFechaMovimiento(null, null)).toBe("—");
  });
});
