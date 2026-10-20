/**
 * Pure window calculation for the hand-rolled virtualizer. No library, no React:
 * `ReportTable` materializes the result with two spacer rows.
 */

export type VentanaVirtual = { primera: number; ultima: number };

/** Rows at or below this count are rendered entirely; the machinery is not worth it. */
export const UMBRAL_FILAS_VIRTUALIZACION = 150;
/** Row height in px until the first real row is measured. */
export const ALTO_FILA_FALLBACK = 33;
/** Extra rows above and below the visible window. */
export const OVERSCAN_FILAS = 4;
/** Container height in px while `clientHeight` is not readable. */
export const ALTO_CONTENEDOR_FALLBACK = 600;

function clamp(valor: number, min: number, max: number): number {
  return Math.min(Math.max(valor, min), max);
}

export function calcularVentanaVirtual({
  rowCount,
  scrollTop,
  containerHeight,
  rowHeight,
  overscan = OVERSCAN_FILAS,
}: {
  rowCount: number;
  scrollTop: number;
  containerHeight: number;
  rowHeight: number;
  overscan?: number;
}): VentanaVirtual {
  if (rowCount <= 0) return { primera: 0, ultima: -1 };
  if (containerHeight <= 0 || rowHeight <= 0) {
    return { primera: 0, ultima: rowCount - 1 };
  }

  const ultimaFila = rowCount - 1;
  const primera = clamp(
    Math.floor(scrollTop / rowHeight) - overscan,
    0,
    ultimaFila,
  );
  const ultima = clamp(
    primera + Math.ceil(containerHeight / rowHeight) + overscan,
    0,
    ultimaFila,
  );

  return { primera: clamp(primera, 0, ultima), ultima };
}
