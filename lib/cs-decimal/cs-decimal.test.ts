import { describe, expect, it } from "vitest";

import {
  CsDecimal,
  CsDivideByZeroError,
  CsOverflowError,
} from "./cs-decimal";

const d = (s: string) => CsDecimal.parse(s);

describe("parse", () => {
  it("conserva la escala del texto", () => {
    expect(d("15.010").toString()).toBe("15.010");
    expect(d("0.0").toString()).toBe("0.0");
    expect(d("7").toString()).toBe("7");
  });

  it("acepta signo y separadores de miles", () => {
    expect(d("-1,234.5").toString()).toBe("-1234.5");
    expect(d("+42").toString()).toBe("42");
  });

  it("rechaza texto que no es decimal", () => {
    expect(() => d("abc")).toThrow();
    expect(() => d("")).toThrow();
    expect(() => d("1.2.3")).toThrow();
  });
});

describe("add y sub", () => {
  it("alinea escalas al máximo", () => {
    expect(d("1.5").add(d("2.25")).toString()).toBe("3.75");
    expect(d("1").add(d("0.001")).toString()).toBe("1.001");
  });

  it("resta y conserva el signo", () => {
    expect(d("2.25").sub(d("1.5")).toString()).toBe("0.75");
    expect(d("1").sub(d("3")).toString()).toBe("-2");
  });

  it("sumar cero no cambia la escala del otro", () => {
    expect(d("5.10").add(CsDecimal.ZERO).toString()).toBe("5.10");
  });
});

describe("mul", () => {
  it("la escala es la suma de las escalas", () => {
    expect(d("2.5").mul(d("4")).toString()).toBe("10.0");
    expect(d("0.1").mul(d("0.2")).toString()).toBe("0.02");
  });

  it("aplica el signo", () => {
    expect(d("-3").mul(d("2")).toString()).toBe("-6");
    expect(d("-3").mul(d("-2")).toString()).toBe("6");
  });

  it("producto con cero conserva la escala combinada si el otro entra en 32 bits", () => {
    expect(d("0").mul(d("1.50")).toString()).toBe("0.00");
  });
});

describe("div", () => {
  it("divide exacto", () => {
    expect(d("10").div(d("4")).toString()).toBe("2.5");
  });

  it("repite hasta 28 dígitos y normaliza ceros finales", () => {
    expect(d("1").div(d("3")).toString()).toBe("0.3333333333333333333333333333");
  });

  it("lanza en división por cero", () => {
    expect(() => d("1").div(d("0"))).toThrow(CsDivideByZeroError);
  });
});

describe("comparaciones", () => {
  it("compara valores con distinta escala", () => {
    expect(d("1.50").eq(d("1.5"))).toBe(true);
    expect(d("1.5").lt(d("1.50")).valueOf()).toBe(false);
    expect(d("1.5").lte(d("1.50"))).toBe(true);
    expect(d("-2").lt(d("1"))).toBe(true);
  });

  it("cero es cero en cualquier escala", () => {
    expect(d("0.000").isZero).toBe(true);
  });
});

describe("format", () => {
  it("N2 agrupa miles y usa dos decimales", () => {
    expect(d("1234.567").format("N2")).toBe("1,234.57");
    expect(d("-1234.5").format("N2")).toBe("-1,234.50");
  });

  it("F no agrupa", () => {
    expect(d("1234.567").format("F")).toBe("1234.57");
    expect(d("0").format("F")).toBe("0.00");
  });

  it("redondea mitad-alejada-de-cero al formatear", () => {
    expect(d("2.345").format("N2")).toBe("2.35");
    expect(d("2.355").format("N2")).toBe("2.36");
    expect(d("-2.345").format("N2")).toBe("-2.35");
    expect(d("0.005").format("F")).toBe("0.01");
  });

  it("0.## recorta ceros finales", () => {
    expect(d("1.500").format("0.##")).toBe("1.5");
    expect(d("2.000").format("0.##")).toBe("2");
  });
});

describe("redondeo de escala", () => {
  it("truncateToScale trunca hacia cero", () => {
    expect(d("-1.239").truncateToScale(2).toString()).toBe("-1.23");
    expect(d("1.239").truncateToScale(2).toString()).toBe("1.23");
  });

  it("roundToScale usa mitad-a-par", () => {
    expect(d("2.345").roundToScale(2).toString()).toBe("2.34");
    expect(d("2.355").roundToScale(2).toString()).toBe("2.36");
  });
});

describe("límites de System.Decimal", () => {
  it("desborda cuando el entero no entra en 96 bits", () => {
    expect(() => CsDecimal.fromParts(0, 1n << 96n, 0)).toThrow(CsOverflowError);
  });

  it("acepta el máximo mantisa en escala 0", () => {
    const max = (1n << 96n) - 1n;
    expect(CsDecimal.fromParts(0, max, 0).toString()).toBe(max.toString());
  });
});
