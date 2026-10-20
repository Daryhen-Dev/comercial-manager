/** Fixed locale: the legacy screen printed in `es-EC`. */
const LOCALE = "es-EC";

export function formatoFechaLarga(d: Date): string {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: "full" }).format(d);
}

export function formatoHora(d: Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}
