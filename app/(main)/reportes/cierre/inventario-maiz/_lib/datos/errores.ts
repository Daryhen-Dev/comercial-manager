import { CsDecimal } from "@/lib/cs-decimal/cs-decimal";

export type CargaCierreCodigo =
  | "SIN_CIERRE_PREVIO"
  | "NULL_COLUMN"
  | "INVALID_DECIMAL_TEXT"
  | "UNEXPECTED_TYPE";

/** Context of the failing query, carried so the message says where it broke. */
export type ContextoConsulta = { consulta: string };

export class CargaCierreError extends Error {
  readonly code: CargaCierreCodigo;
  readonly columna?: string;
  readonly consulta?: string;
  readonly causa?: unknown;

  constructor(
    code: CargaCierreCodigo,
    message: string,
    opciones: { columna?: string; consulta?: string; causa?: unknown } = {},
  ) {
    super(message);
    this.name = "CargaCierreError";
    this.code = code;
    this.columna = opciones.columna;
    this.consulta = opciones.consulta;
    this.causa = opciones.causa;
  }
}

/**
 * A branch with no previous closing. Deliberately NOT a `CargaCierreError`: the
 * legacy load crashed here, and the port reproduces that instead of turning it
 * into a typed load error.
 */
export class CargaCierreSinCierrePrevio extends Error {
  constructor() {
    super(
      "The local has no previous closing (CierreTableAdapter.SelectCierreFecha returned no date); the legacy WinForms load crashed here.",
    );
    this.name = "CargaCierreSinCierrePrevio";
  }
}

const tipo = (v: unknown) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v);

function nulo(columna: string, ctx: ContextoConsulta): never {
  throw new CargaCierreError(
    "NULL_COLUMN",
    `Column "${columna}" came back NULL; the legacy WinForms load would throw StrongTypingException.`,
    { columna, consulta: ctx.consulta },
  );
}

function inesperado(columna: string, esperado: string, valor: unknown, ctx: ContextoConsulta): never {
  throw new CargaCierreError(
    "UNEXPECTED_TYPE",
    `Column "${columna}" was expected as ${esperado} but arrived as ${tipo(valor)}.`,
    { columna, consulta: ctx.consulta },
  );
}

export function entero(valor: unknown, columna: string, ctx: ContextoConsulta): number {
  if (valor === null || valor === undefined) nulo(columna, ctx);
  if (typeof valor !== "number") inesperado(columna, "int", valor, ctx);
  return valor;
}

export function texto(valor: unknown, columna: string, ctx: ContextoConsulta): string {
  if (valor === null || valor === undefined) nulo(columna, ctx);
  if (typeof valor !== "string") inesperado(columna, "string", valor, ctx);
  return valor;
}

/**
 * Parses an NVARCHAR that holds a number with `CsDecimal.parse`, which preserves
 * the scale. Prisma would turn a SQL `Decimal` into `decimal.js` and lose it.
 */
export function decimalDeTexto(valor: unknown, columna: string, ctx: ContextoConsulta): CsDecimal {
  if (valor === null || valor === undefined) nulo(columna, ctx);
  if (typeof valor !== "string") inesperado(columna, "NVARCHAR text (CONVERT(NVARCHAR(100), ...))", valor, ctx);
  try {
    return CsDecimal.parse(valor);
  } catch (causa) {
    throw new CargaCierreError(
      "INVALID_DECIMAL_TEXT",
      `Column "${columna}" holds text that Convert.ToDecimal would reject: "${valor}".`,
      { columna, consulta: ctx.consulta, causa },
    );
  }
}

export function fechaHora(valor: unknown, columna: string, ctx: ContextoConsulta): Date {
  if (valor === null || valor === undefined) nulo(columna, ctx);
  if (!(valor instanceof Date)) inesperado(columna, "datetime", valor, ctx);
  return valor;
}
