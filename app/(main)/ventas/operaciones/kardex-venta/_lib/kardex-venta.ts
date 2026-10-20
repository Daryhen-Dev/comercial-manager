/**
 * Pure helpers for the Kardex de Venta report. No database, no dependencies:
 * everything here is unit-tested in `kardex-venta.test.ts`.
 */

/**
 * `d/M/yyyy H:mm` in UTC, built by hand: the database datetimes are treated as
 * UTC and displayed without any timezone conversion (project convention).
 *
 * No leading zeros on day, month or hour; minutes always two digits.
 * `null`, `undefined`, `""` and invalid dates render as an em dash.
 */
export function formatFechaVenta(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";

  const dia = date.getUTCDate();
  const mes = date.getUTCMonth() + 1;
  const anio = date.getUTCFullYear();
  const hora = date.getUTCHours();
  const minutos = String(date.getUTCMinutes()).padStart(2, "0");

  return `${dia}/${mes}/${anio} ${hora}:${minutos}`;
}

/**
 * Liquidation date, with the exit timestamp appended when it exists.
 * With no exit date it returns only the liquidation date, so two missing dates
 * give a single em dash rather than `"— · salida —"`.
 */
export function formatFechaMovimiento(
  fechaLiquida: Date | string | null | undefined,
  fechaSalida: Date | string | null | undefined,
): string {
  const base = formatFechaVenta(fechaLiquida);
  return fechaSalida == null ? base : `${base} · salida ${formatFechaVenta(fechaSalida)}`;
}
