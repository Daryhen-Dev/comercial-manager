import type { DatoProducto } from "../datos/tipos";
import type { ResultadoInventario } from "../motor/inventario";

export type CeldaGrilla = string | number | null;
export type ColorCelda = "LightBlue" | "LightGreen" | "LightYellow";

export interface EstiloCelda {
  backColor?: ColorCelda;
  bold?: boolean;
}

/** The projection only emits the six `inv-*` kinds. */
export type KindFilaGrillaInvetario =
  | "inv-vacia"
  | "inv-producto"
  | "inv-descripcion"
  | "inv-detalle"
  | "inv-sin-mov-producto"
  | "inv-sin-mov-resumen";

export interface FilaGrilla {
  kind: KindFilaGrillaInvetario;
  /** Always 18 cells; index = DataGridView column index; unset cells are null. */
  celdas: CeldaGrilla[];
  /** How many values the legacy passed to Rows.Add. */
  celdasLegacy: number;
  idProducto?: number;
  estiloFila?: EstiloCelda;
  estiloCeldas?: Record<number, EstiloCelda>;
}

/** Exactly `{ producto, calculo }`: the action drops `fechaCierre`. */
export type EntradaGrilla = {
  producto: DatoProducto;
  calculo: ResultadoInventario;
};

export const CELDAS_TOTALES = 18;

export type DefinicionColumna = {
  indice: number;
  name: string;
  headerText: string;
  width: number;
  align: "left" | "right";
  visible: boolean;
};

/**
 * The 18 original DataGridView columns. Columns 0-2 are hidden; widths are the
 * minimum in px, since on the web the column grows to fit its content.
 */
export const COLUMNAS_GRILLA: DefinicionColumna[] = [
  { indice: 0, name: "IDVer", headerText: "Ver", width: 50, align: "left", visible: false },
  { indice: 1, name: "IDProducto", headerText: "IDPRODUCTO", width: 100, align: "left", visible: false },
  { indice: 2, name: "CoVe", headerText: "COMPRAVENTA", width: 100, align: "left", visible: false },
  { indice: 3, name: "Producto", headerText: "PRODUCTO", width: 160, align: "left", visible: true },
  { indice: 4, name: "PDia", headerText: "PRE. DIA", width: 90, align: "right", visible: true },
  { indice: 5, name: "QQBruto", headerText: "BRUTO", width: 90, align: "right", visible: true },
  { indice: 6, name: "Neto", headerText: "NETO", width: 85, align: "right", visible: true },
  { indice: 7, name: "Precio", headerText: "PRECIO", width: 85, align: "right", visible: true },
  { indice: 8, name: "Efectivo", headerText: "EFECTIVO", width: 90, align: "right", visible: true },
  { indice: 9, name: "CompraVenta", headerText: "COMISION", width: 90, align: "right", visible: true },
  { indice: 10, name: "Cheque", headerText: "CHEQUE", width: 90, align: "right", visible: true },
  { indice: 11, name: "Retencion", headerText: "RETENCION", width: 90, align: "right", visible: true },
  { indice: 12, name: "Pendiente", headerText: "PENDIENTE", width: 90, align: "right", visible: true },
  { indice: 13, name: "VTotal", headerText: "VTOTAL", width: 90, align: "right", visible: true },
  { indice: 14, name: "Humedad", headerText: "HUME.", width: 80, align: "right", visible: true },
  { indice: 15, name: "Impureza", headerText: "IMPU.", width: 80, align: "right", visible: true },
  { indice: 16, name: "Porcentaje", headerText: "EMBO.", width: 80, align: "right", visible: true },
  { indice: 17, name: "Merma", headerText: "ANTICIPO", width: 80, align: "right", visible: true },
];
