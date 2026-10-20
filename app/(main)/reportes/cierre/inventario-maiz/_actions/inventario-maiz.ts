"use server";

import { auth } from "@/auth";

import { calcularVistaInventarioMaiz } from "../_lib/calcular-vista";
import { cargarVistaInventarioMaiz } from "../_lib/cargar-vista";
import { proyectarInventarioAdmin } from "../_lib/grilla/proyectar-inventario-admin";
import { aFilaFaltante, type ResultadoInventarioMaiz } from "../_lib/tipos-dto";

const MENSAJE_NO_ADMIN = "Solo administradores.";

/**
 * Read-only load. Returns a typed error instead of throwing, except for an
 * unexpected failure, which is reported as `status: "error"`.
 *
 * The role check uses `UsuarioRolId === 1` (this system's authoritative field)
 * rather than the document's `RolUsuario === "ADMINISTRADOR"`, which is only the
 * display name here.
 */
export async function cargarInventarioMaiz(): Promise<ResultadoInventarioMaiz> {
  const session = await auth();
  const user = session?.user;

  if (
    !user ||
    typeof user.IDUsuario !== "number" ||
    typeof user.IDLocal !== "number" ||
    user.UsuarioRolId !== 1
  ) {
    return { status: "error", error: MENSAJE_NO_ADMIN };
  }

  try {
    const carga = await cargarVistaInventarioMaiz();
    const vista = await calcularVistaInventarioMaiz(carga);

    if (vista.estado !== "calculado") {
      return {
        status: "bloqueado",
        mensaje: vista.mensaje,
        faltantes: {
          compras: carga.faltantes.compras.map(aFilaFaltante),
          ventas: carga.faltantes.ventas.map(aFilaFaltante),
        },
      };
    }

    const filas = proyectarInventarioAdmin(
      vista.productos.map(({ producto, calculo }) => ({ producto, calculo })),
    );

    return {
      status: "ok",
      filas,
      resumen: vista.resumen,
      fechaConsulta: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "error",
      error: `No se pudo cargar: ${(error as Error).message}`,
    };
  }
}
