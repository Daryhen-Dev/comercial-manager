"use server";

import { auth } from "@/auth";

import {
  buscarCierresPorSucursal,
  traerCabeceraCierre,
  traerInventarioMaiz,
} from "../_lib/datos/consultas";
import {
  calcularTotales,
  mapearCabecera,
  mapearCierreBusqueda,
  mapearInventarioMaiz,
} from "../_lib/datos/mapeadores";
import type { CierreOption, ResultadoReporteMaiz } from "../_lib/tipos";

const MENSAJE_NO_ADMIN = "Solo administradores.";

/** The search string is user input, so it is bounded before it reaches SQL. */
const LARGO_MAXIMO_BUSQUEDA = 40;

type Sesion = {
  idLocal: number;
};

/**
 * The branch always comes from the session (document §4.7.1/§4.7.4): the client
 * never chooses which branch it is allowed to read.
 */
async function leerSesion(): Promise<Sesion | null> {
  const session = await auth();
  const user = session?.user;

  if (
    !user ||
    typeof user.IDUsuario !== "number" ||
    typeof user.IDLocal !== "number" ||
    user.UsuarioRolId !== 1
  ) {
    return null;
  }

  return { idLocal: user.IDLocal };
}

/**
 * Closings of the signed-in branch, optionally filtered by the `dd/mm/yyyy`
 * rendering of their date. Returns the list the dialog renders; an unexpected
 * failure is thrown on purpose, because the dialog's documented reaction to an
 * error is the "Sin resultados." state (§4.2).
 */
export async function buscarCierres(query: string): Promise<CierreOption[]> {
  const sesion = await leerSesion();
  if (!sesion) throw new Error(MENSAJE_NO_ADMIN);

  const texto = typeof query === "string" ? query.slice(0, LARGO_MAXIMO_BUSQUEDA) : "";
  const filas = await buscarCierresPorSucursal(sesion.idLocal, texto);

  return filas.map(mapearCierreBusqueda);
}

/**
 * Everything the route needs, in one call: the header of the accounting closing
 * (`fechaFinal` included) and the corn section built from the closings the legacy
 * CTE selects.
 *
 * The section is skipped, never faked, when either input is missing (§2.2):
 * no `idCierre` in the URL or no header row (`Conta_Cierre_Caja`) means no
 * section at all.
 */
export async function cargarReporteMaiz(
  idCierre: number | null,
): Promise<ResultadoReporteMaiz> {
  if (!(await leerSesion())) {
    return { status: "error", error: MENSAJE_NO_ADMIN };
  }

  if (idCierre === null) return { status: "sin-cierre" };

  try {
    const cabeceraRaw = await traerCabeceraCierre(idCierre);
    const cabecera = cabeceraRaw ? mapearCabecera(cabeceraRaw) : null;
    const fechaFinal = cabecera?.fechaFinal ? new Date(cabecera.fechaFinal) : null;

    if (!cabecera || !fechaFinal || Number.isNaN(fechaFinal.getTime())) {
      return { status: "sin-cabecera", idCierre };
    }

    const raw = await traerInventarioMaiz(fechaFinal, idCierre);
    const { filas, anomalias } = mapearInventarioMaiz(raw);

    // The legacy turns an unreadable figure into a number in silence. The value
    // is kept (parity), but it is named in the server log so it can be corrected
    // upstream. Never rendered: this is operator output, not report output.
    for (const anomalia of anomalias) {
      console.warn(`[reporte-maiz] valor no parseable: ${anomalia}`);
    }

    return {
      status: "ok",
      idCierre,
      cabecera,
      filas,
      totales: calcularTotales(filas),
    };
  } catch (error) {
    return {
      status: "error",
      error: `No se pudo cargar: ${(error as Error).message}`,
    };
  }
}
