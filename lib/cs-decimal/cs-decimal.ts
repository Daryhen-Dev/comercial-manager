/**
 * Exact emulation of .NET Framework `System.Decimal`.
 *
 * value = (-1)^sign * mant * 10^-scale, with 0 <= mant < 2^96 and 0 <= scale <= 28.
 *
 * This exists because the inventory engine must reproduce the legacy WinForms
 * numbers bit for bit. Plain `number` is exact for sums of two-decimal values in
 * this range, but division and rounding drift in the last cent, and the report is
 * read against the legacy screen.
 *
 * Rounding rules differ by operation and are NOT interchangeable:
 * - reducing a mantissa that does not fit (parse overflow, add/sub overflow,
 *   multiplication): half-to-even
 * - formatting to N2 / F / 0.##: half-away-from-zero over the exact magnitude
 */

const MAX_MANT = 1n << 96n;
const MAX_SCALE = 28;

export class CsOverflowError extends Error {
  constructor() {
    super("Valor fuera del rango de System.Decimal.");
    this.name = "CsOverflowError";
  }
}

export class CsDivideByZeroError extends Error {
  constructor() {
    super("Intento de división por cero.");
    this.name = "CsDivideByZeroError";
  }
}

const POW10: bigint[] = Array.from({ length: MAX_SCALE + 1 }, (_, i) => 10n ** BigInt(i));
const pow10 = (n: number): bigint => POW10[n];

/** Half-to-even between `q` (truncated) and `q+1`, given the dropped remainder. */
function halfEven(q: bigint, remainder: bigint, divisor: bigint): bigint {
  const twice = remainder * 2n;
  if (twice > divisor) return q + 1n;
  if (twice < divisor) return q;
  return q % 2n === 0n ? q : q + 1n;
}

/** Shrinks mantissa/scale until they fit, rounding half-to-even while dropping digits. */
function fit(mant: bigint, scale: number): { mant: bigint; scale: number } {
  let m = mant;
  let s = scale;
  while (s > 0 && (m >= MAX_MANT || s > MAX_SCALE)) {
    const q = m / 10n;
    const r = m % 10n;
    m = halfEven(q, r, 10n);
    s -= 1;
  }
  if (m >= MAX_MANT) throw new CsOverflowError();
  return { mant: m, scale: s };
}

export class CsDecimal {
  static readonly ZERO = new CsDecimal(0, 0n, 0);
  static readonly ONE = new CsDecimal(0, 1n, 0);

  private constructor(
    /** 0 = positive, 1 = negative. Zero is always sign 0. */
    readonly sign: 0 | 1,
    readonly mant: bigint,
    readonly scale: number,
  ) {}

  static fromParts(sign: 0 | 1, mant: bigint, scale: number): CsDecimal {
    const fitted = fit(mant, scale);
    return new CsDecimal(fitted.mant === 0n ? 0 : sign, fitted.mant, fitted.scale);
  }

  static from(value: number | bigint): CsDecimal {
    if (typeof value === "bigint") return CsDecimal.fromParts(value < 0n ? 1 : 0, value < 0n ? -value : value, 0);
    if (!Number.isFinite(value)) throw new CsOverflowError();
    return CsDecimal.parse(String(value));
  }

  /**
   * `Convert.ToDecimal(string)`: accepts a sign and thousands separators, requires
   * digits, and preserves the scale written in the text (`"15.010"` keeps scale 3).
   */
  static parse(texto: string): CsDecimal {
    const limpio = String(texto).trim().replaceAll(",", "");
    const m = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(limpio);
    if (!m || (m[2] === "" && (m[3] ?? "") === "")) {
      throw new Error(`Texto decimal inválido: ${JSON.stringify(texto)}`);
    }
    const negativo = m[1] === "-";
    const entero = m[2] ?? "";
    const fraccion = m[3] ?? "";
    const mant = BigInt(`${entero}${fraccion}` || "0");
    const fitted = fit(mant, fraccion.length);
    return new CsDecimal(fitted.mant === 0n ? 0 : negativo ? 1 : 0, fitted.mant, fitted.scale);
  }

  get isZero(): boolean {
    return this.mant === 0n;
  }

  /** Unsigned mantissa at `targetScale`, valid only when targetScale >= this.scale. */
  private scaledMant(targetScale: number): bigint {
    return this.mant * pow10(targetScale - this.scale);
  }

  private signedMant(targetScale: number): bigint {
    const v = this.scaledMant(targetScale);
    return this.sign === 1 ? -v : v;
  }

  add(other: CsDecimal): CsDecimal {
    const s = Math.max(this.scale, other.scale);
    const sum = this.signedMant(s) + other.signedMant(s);
    return CsDecimal.fromParts(sum < 0n ? 1 : 0, sum < 0n ? -sum : sum, s);
  }

  sub(other: CsDecimal): CsDecimal {
    return this.add(other.negate());
  }

  negate(): CsDecimal {
    if (this.isZero) return this;
    return new CsDecimal(this.sign === 1 ? 0 : 1, this.mant, this.scale);
  }

  abs(): CsDecimal {
    return this.sign === 1 ? this.negate() : this;
  }

  mul(other: CsDecimal): CsDecimal {
    const scale = this.scale + other.scale;
    // .NET VarDecMul: a zero product keeps the combined scale only while the other
    // operand fits in 32 bits; otherwise the scale collapses to 0.
    if (this.isZero || other.isZero) {
      const otro = this.isZero ? other : this;
      const s = otro.mant < 1n << 32n ? Math.min(scale, MAX_SCALE) : 0;
      return CsDecimal.fromParts(0, 0n, s);
    }
    const sign: 0 | 1 = this.sign === other.sign ? 0 : 1;
    return CsDecimal.fromParts(sign, this.mant * other.mant, scale);
  }

  div(other: CsDecimal): CsDecimal {
    if (other.isZero) throw new CsDivideByZeroError();

    const sign: 0 | 1 = this.sign === other.sign ? 0 : 1;
    if (this.isZero) return CsDecimal.fromParts(0, 0n, Math.min(other.scale, MAX_SCALE));

    // a/b = (am * 10^bs) / (bm * 10^as)
    let num = this.mant * pow10(other.scale);
    let den = other.mant * pow10(this.scale);

    let cociente = 0n;
    let scale = 0;
    let resto = num;

    const entero = num / den;
    cociente = entero;
    resto = num % den;

    while (resto !== 0n && scale < MAX_SCALE) {
      resto *= 10n;
      cociente = cociente * 10n + resto / den;
      resto %= den;
      scale += 1;
    }

    let inexacto = false;
    if (resto !== 0n) {
      inexacto = true;
      cociente = halfEven(cociente, resto, den);
    }

    if (cociente >= MAX_MANT) {
      const fitted = fit(cociente, scale);
      cociente = fitted.mant;
      scale = fitted.scale;
    }

    // .NET drops trailing zeros of an inexact quotient so `1/3` reads as 0.3333...
    if (inexacto) {
      while (scale > 0 && cociente % 10n === 0n) {
        cociente /= 10n;
        scale -= 1;
      }
    }

    return CsDecimal.fromParts(sign, cociente, scale);
  }

  cmp(other: CsDecimal): -1 | 0 | 1 {
    const s = Math.max(this.scale, other.scale);
    const a = this.signedMant(s);
    const b = other.signedMant(s);
    return a < b ? -1 : a > b ? 1 : 0;
  }

  lt(other: CsDecimal): boolean {
    return this.cmp(other) < 0;
  }

  lte(other: CsDecimal): boolean {
    return this.cmp(other) <= 0;
  }

  gt(other: CsDecimal): boolean {
    return this.cmp(other) > 0;
  }

  gte(other: CsDecimal): boolean {
    return this.cmp(other) >= 0;
  }

  eq(other: CsDecimal): boolean {
    return this.cmp(other) === 0;
  }

  /** Truncation toward zero, as SqlClient does when sending to Decimal(18,2). */
  truncateToScale(n: number): CsDecimal {
    if (n >= this.scale) return this;
    const q = this.mant / pow10(this.scale - n);
    return CsDecimal.fromParts(this.sign, q, n);
  }

  /** `Math.Round(d, n)`: half-to-even. */
  roundToScale(n: number): CsDecimal {
    if (n >= this.scale) return this;
    const divisor = pow10(this.scale - n);
    const q = this.mant / divisor;
    const r = this.mant % divisor;
    return CsDecimal.fromParts(this.sign, halfEven(q, r, divisor), n);
  }

  /** Every digit of the scale is printed: `15.010`, `0.0`. */
  toString(): string {
    const digits = this.mant.toString().padStart(this.scale + 1, "0");
    const entero = digits.slice(0, digits.length - this.scale);
    const fraccion = this.scale > 0 ? `.${digits.slice(digits.length - this.scale)}` : "";
    return `${this.sign === 1 ? "-" : ""}${entero}${fraccion}`;
  }

  toNumber(): number {
    return Number(this.toString());
  }

  /**
   * `ToString` in invariant culture. `N2` groups thousands with commas, `F` does
   * not; both print two decimals and round half-away-from-zero on the magnitude.
   */
  format(formato: "N2" | "F" | "0.##" | "0.####"): string {
    if (formato === "N2" || formato === "F") {
      const redondeado = this.roundHalfAway(2);
      const [entero, fraccion] = redondeado.toString().split(".");
      const agrupado =
        formato === "N2" ? entero.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : entero;
      return `${agrupado}.${(fraccion ?? "").padEnd(2, "0")}`;
    }
    const decimales = formato === "0.##" ? 2 : 4;
    const redondeado = this.roundHalfAway(decimales);
    const texto = redondeado.toString();
    return texto.includes(".") ? texto.replace(/0+$/, "").replace(/\.$/, "") : texto;
  }

  /** Rounds the exact magnitude to `n` decimals with midpoint away from zero. */
  private roundHalfAway(n: number): CsDecimal {
    if (n >= this.scale) return this;
    const divisor = pow10(this.scale - n);
    const q = this.mant / divisor;
    const r = this.mant % divisor;
    const sube = r * 2n >= divisor;
    return CsDecimal.fromParts(this.sign, sube ? q + 1n : q, n);
  }
}
