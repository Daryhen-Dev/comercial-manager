import type { EstiloCelda, EstiloCelda as Estilo } from "./tipos";

const VERDE: Estilo = { backColor: "LightGreen", bold: true };
const AMARILLO: Estilo = { backColor: "LightYellow" };
const AMARILLO_BOLD: Estilo = { backColor: "LightYellow", bold: true };

/** Identification row: label in green, its three values in yellow. */
export const ESTILO_FILA_PRODUCTO: Record<number, Estilo> = {
  3: VERDE,
  4: AMARILLO_BOLD,
  6: AMARILLO_BOLD,
  8: AMARILLO_BOLD,
};

/** Column labels of the detail block; column 3 is bold. */
export const ESTILO_CABECERA_DETALLE: Record<number, Estilo> = {
  3: AMARILLO_BOLD,
  4: AMARILLO,
  5: AMARILLO,
  6: AMARILLO,
  7: AMARILLO,
  8: AMARILLO,
  9: AMARILLO,
  10: AMARILLO,
  11: AMARILLO,
  12: AMARILLO,
};

/** The six detail rows: only the description is highlighted. */
export const ESTILO_FILA_DETALLE: Record<number, Estilo> = { 3: AMARILLO_BOLD };

/** Product with no movement. */
export const ESTILO_FILA_SIN_MOV: Record<number, Estilo> = { 3: VERDE };

/** Summary row: labels bold, values plain, all on yellow. */
export const ESTILO_FILA_RESUMEN: Record<number, Estilo> = {
  3: AMARILLO_BOLD,
  4: AMARILLO,
  5: AMARILLO_BOLD,
  6: AMARILLO,
  7: AMARILLO_BOLD,
  8: AMARILLO,
  9: AMARILLO_BOLD,
  10: AMARILLO,
  11: AMARILLO_BOLD,
  12: AMARILLO,
};

export type { EstiloCelda };
