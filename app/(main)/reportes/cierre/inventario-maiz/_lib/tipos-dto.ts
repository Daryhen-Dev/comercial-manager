import type { DatoValidacionCyV } from "./datos/tipos";
import type { FilaGrilla } from "./grilla/tipos";
import type { ResumenMaizDTO } from "./sesion/mapeo-dto";

/** Nothing crosses the server/client boundary as CsDecimal or Date. */
export type FilaFaltanteDTO = {
  idBoletoDetalle: string;
  sucursal: string;
  codigo: string;
  producto: string;
  cliente: string;
  /** ISO 8601. */
  fecha: string;
};

export type ResultadoInventarioMaiz =
  | {
      status: "bloqueado";
      mensaje: string;
      faltantes: { compras: FilaFaltanteDTO[]; ventas: FilaFaltanteDTO[] };
    }
  | {
      status: "ok";
      filas: FilaGrilla[];
      resumen: ResumenMaizDTO;
      /** ISO 8601. */
      fechaConsulta: string;
    }
  | { status: "error"; error: string };

export function aFilaFaltante(v: DatoValidacionCyV): FilaFaltanteDTO {
  return {
    idBoletoDetalle: v.idBoletoDetalle,
    sucursal: v.sucursal,
    codigo: v.codigo,
    producto: v.producto,
    cliente: v.cliente,
    fecha: v.fecha.toISOString(),
  };
}
