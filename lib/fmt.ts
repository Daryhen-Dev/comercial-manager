/**
 * Fixed-locale number formatting: `en-US`, always exactly two decimals.
 * Parity with the legacy report depends on this never using the browser locale.
 */
export function fmt(n: number, decimals = 2): string {
  const texto = n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  // A value that rounds to zero is printed as zero: `-0.00` is a rounding
  // artefact, not information, and reads as a defect in a financial table.
  // The rounding itself stays exactly `toLocaleString`'s (so `-0.005` is still
  // `-0.01`); only the sign of an all-zero rendering is dropped.
  return texto.startsWith("-") && /^-0(\.0*)?$/.test(texto) ? texto.slice(1) : texto;
}

/**
 * `dd/mm/yyyy` and `dd/mm/yyyy hh:mm`, rendered in **UTC**.
 *
 * The legacy selector formats with `timeZone: "UTC"` and `hourCycle: "h23"`,
 * and that is not cosmetic: the database stores bare `DateTime` values, so
 * formatting in the browser's zone would shift a closing by a day for anyone
 * east or west of the server. The parts are assembled by hand because
 * `toLocaleString` inserts a comma between the date and the time.
 */
function partesUtc(iso: string) {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;

  const partes = new Intl.DateTimeFormat("es-EC", {
    timeZone: "UTC",
    hourCycle: "h23",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(fecha);

  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value ?? "";

  return {
    fecha: `${valor("day")}/${valor("month")}/${valor("year")}`,
    hora: `${valor("hour")}:${valor("minute")}`,
  };
}

export function fmtFechaUtc(iso: string | null): string {
  return iso ? (partesUtc(iso)?.fecha ?? "") : "";
}

export function fmtFechaHoraUtc(iso: string | null): string {
  if (!iso) return "";
  const p = partesUtc(iso);
  return p ? `${p.fecha} ${p.hora}` : "";
}
