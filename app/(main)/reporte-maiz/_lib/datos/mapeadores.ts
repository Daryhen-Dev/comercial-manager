import type {
  CabeceraCierre,
  CierreOption,
  FilaInventarioMaiz,
  TotalesInventarioMaiz,
} from "../tipos";
import type {
  RawCabeceraCierre,
  RawCierreBusqueda,
  RawInventarioMaiz,
} from "./consultas";

/**
 * Text → number, exactly as the legacy does it (§5.4).
 *
 * The columns of `Cierre_Producto` are `NVarchar(100)`, so every figure arrives
 * as text. The algorithm strips spaces and commas and hands the rest to
 * `Number`, so an English layout works and a Spanish one does not:
 *
 *   "1,234.56"    → 1234.56   correct, that is the intended layout
 *   "1 234.56"    → 1234.56   spaces are stripped too
 *   "1234,56"     → 123456    the comma is deleted, NOT read as a decimal point
 *   "1.234,56"    → 1.23456   same trap, off by three orders of magnitude
 *   "1.234.567,89"→ 0         two dots left over → NaN → 0
 *   "abc"         → 0
 *
 * The document claims `"1.234,56"` becomes `0`; it does not, and the real figure
 * (`1.23456`) is worse than the documented one because it is finite. That is
 * documented risk B-6 and the reason `esNumeracionAnomala` exists: the mapping
 * stays faithful, and the caller logs what it could not read instead of losing it
 * silently.
 */
export function aNumero(valor: string | number | null | undefined): number {
  if (valor === null || valor === undefined || valor === "") return 0;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;

  const n = Number(valor.replace(/\s/g, "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * True when the text is not in the layout `aNumero` understands: a decimal comma
 * or something that is not a number at all. The value is still mapped through
 * `aNumero` (whatever it produces); this only feeds the server log.
 */
export function esNumeracionAnomala(valor: string | null | undefined): boolean {
  if (valor === null || valor === undefined) return false;
  const texto = valor.trim().replace(/\s/g, "");
  if (texto === "") return false;

  // Thousands with a comma every three digits and an optional dot decimal:
  // `1,234.56`, `12,345,678.90`, `1,234`, `1234.56`, `1234`. Anything else is a
  // layout `aNumero` cannot read, including the Spanish `1234,56`.
  if (/^-?\d{1,3}(,\d{3})*(\.\d+)?$/.test(texto)) return false;
  if (/^-?\d+(\.\d+)?$/.test(texto)) return false;

  return true;
}

/** `"MAIZ" + " " + Local` already comes composed from SQL; this only guards NULL. */
export function mapearFilaMaiz(raw: RawInventarioMaiz): FilaInventarioMaiz {
  return {
    idCierre: raw.IdCierre,
    producto: raw.Producto ?? "",
    stock: aNumero(raw.stock),
    precio: aNumero(raw.precio),
    inversion: aNumero(raw.inversion),
    utilidadQQ: aNumero(raw.UtilidadQQ),
    utilidadTotal: aNumero(raw.UtilidadTotal),
  };
}

export type InventarioMaizMapeado = {
  filas: FilaInventarioMaiz[];
  /** Human-readable notes for the server log; never rendered. */
  anomalias: string[];
};

export function mapearInventarioMaiz(raw: RawInventarioMaiz[]): InventarioMaizMapeado {
  const anomalias: string[] = [];

  for (const fila of raw) {
    const campos: [string, string | null][] = [
      ["Cantidad", fila.stock],
      ["Precio", fila.precio],
      ["Inversion", fila.inversion],
      ["UtilidadQQ", fila.UtilidadQQ],
      ["UtilidadTotal", fila.UtilidadTotal],
    ];

    for (const [campo, valor] of campos) {
      if (esNumeracionAnomala(valor)) {
        anomalias.push(
          `${campo}="${valor}" en el cierre ${fila.IdCierre} (${fila.Producto ?? "sin producto"})`,
        );
      }
    }
  }

  return { filas: raw.map(mapearFilaMaiz), anomalias };
}

/**
 * The footer (§5.5.1). The price is the **weighted average** `inversion / stock`,
 * not the sum of prices; with no stock it is `0` instead of a division error.
 * No utility totals: see `TotalesInventarioMaiz`.
 */
export function calcularTotales(filas: FilaInventarioMaiz[]): TotalesInventarioMaiz {
  let stock = 0;
  let inversion = 0;

  for (const fila of filas) {
    stock += fila.stock;
    inversion += fila.inversion;
  }

  return {
    stock,
    precio: stock !== 0 ? inversion / stock : 0,
    inversion,
  };
}

/**
 * `?idCierre=` → a usable id, or `null` for "no selection".
 *
 * The legacy does a bare `Number(idCierre)`, which lets `12.5` and `-3` reach the
 * Int parameter. Requiring a positive integer (decision D8) keeps every
 * degenerate case of the document (`abc`, `0`, missing) on the same "no
 * selection" path.
 */
export function resolverIdCierre(valor: string | string[] | undefined): number | null {
  if (valor === undefined || Array.isArray(valor)) return null;
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const aIso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

export function mapearCierreBusqueda(raw: RawCierreBusqueda): CierreOption {
  return {
    idCierre: raw.IdCierre,
    fechaInicial: aIso(raw.FechaInicial),
    fecha: aIso(raw.Fecha),
  };
}

export function mapearCabecera(raw: RawCabeceraCierre): CabeceraCierre {
  return {
    usuario: raw.USUARIO ?? null,
    sucursal: raw.sucursal ?? null,
    fechaInicial: aIso(raw.fechaInicial),
    fechaFinal: aIso(raw.fechaFinal),
  };
}
