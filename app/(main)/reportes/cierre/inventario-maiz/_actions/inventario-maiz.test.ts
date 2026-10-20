import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  cargar: vi.fn(),
  calcular: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("../_lib/cargar-vista", () => ({
  cargarVistaInventarioMaiz: mocks.cargar,
}));
vi.mock("../_lib/calcular-vista", () => ({
  calcularVistaInventarioMaiz: mocks.calcular,
  MENSAJE_INVENTARIO_NEGATIVO: "ERROR, Inventario en negativo.",
  MENSAJE_COMPRAS_VENTAS_POR_LIQUIDAR: "ERROR, Compras o ventas por liquidar.",
}));

import { cargarInventarioMaiz } from "./inventario-maiz";
import type { CargaVistaInventarioMaiz } from "../_lib/datos/tipos";

const ADMIN = { user: { IDUsuario: 1, IDLocal: 1, UsuarioRolId: 1 } };
const CAJERO = { user: { IDUsuario: 2, IDLocal: 1, UsuarioRolId: 2 } };

const cargaVacia: CargaVistaInventarioMaiz = {
  productos: [],
  faltantes: { compras: [], ventas: [] },
  estadoInventario: false,
  estadoFaltantes: false,
};

const MENSAJE_NO_ADMIN = "Solo administradores.";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue(ADMIN);
  mocks.cargar.mockResolvedValue(cargaVacia);
  mocks.calcular.mockResolvedValue({
    estado: "calculado",
    productos: [],
    resumen: { stock: "0.00", precio: "0.00", inversion: "0.00" },
  });
});

describe("guard de rol", () => {
  it("sin sesión devuelve el error tipado y no carga nada", async () => {
    mocks.auth.mockResolvedValue(null);
    const r = await cargarInventarioMaiz();
    expect(r).toEqual({ status: "error", error: MENSAJE_NO_ADMIN });
    expect(mocks.cargar).not.toHaveBeenCalled();
    expect(mocks.calcular).not.toHaveBeenCalled();
  });

  it("un usuario sin rol de administrador no llega a la carga", async () => {
    mocks.auth.mockResolvedValue(CAJERO);
    const r = await cargarInventarioMaiz();
    expect(r).toEqual({ status: "error", error: MENSAJE_NO_ADMIN });
    expect(mocks.cargar).not.toHaveBeenCalled();
  });

  it("una sesión a la que le falta IDUsuario tampoco pasa", async () => {
    mocks.auth.mockResolvedValue({ user: { IDLocal: 1, UsuarioRolId: 1 } });
    const r = await cargarInventarioMaiz();
    expect(r).toMatchObject({ status: "error", error: MENSAJE_NO_ADMIN });
    expect(mocks.cargar).not.toHaveBeenCalled();
  });
});

describe("bloqueos", () => {
  it("propaga el mensaje de faltantes y serializa las fechas a ISO", async () => {
    const fecha = new Date("2026-10-14T09:53:04.493Z");
    mocks.cargar.mockResolvedValue({
      ...cargaVacia,
      faltantes: {
        compras: [],
        ventas: [
          {
            idBoletoDetalle: "185325",
            sucursal: "VENTANAS",
            codigo: "4532-1",
            producto: "MAIZ",
            cliente: "CHUQUICONDOR",
            fecha,
          },
        ],
      },
      estadoFaltantes: true,
    });
    mocks.calcular.mockResolvedValue({
      estado: "faltantes-pendientes",
      mensaje: "ERROR, Compras o ventas por liquidar.",
    });

    const r = await cargarInventarioMaiz();

    expect(r).toMatchObject({
      status: "bloqueado",
      mensaje: "ERROR, Compras o ventas por liquidar.",
    });
    if (r.status !== "bloqueado") throw new Error("estado inesperado");
    expect(r.faltantes.ventas[0].fecha).toBe(fecha.toISOString());
    // Nothing crosses the boundary as a Date or a CsDecimal.
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
  });

  it("propaga el mensaje de inventario negativo", async () => {
    mocks.calcular.mockResolvedValue({
      estado: "inventario-negativo",
      mensaje: "ERROR, Inventario en negativo.",
    });
    const r = await cargarInventarioMaiz();
    expect(r).toMatchObject({
      status: "bloqueado",
      mensaje: "ERROR, Inventario en negativo.",
    });
  });
});

describe("resultado calculado", () => {
  it("devuelve filas, resumen y fechaConsulta serializables", async () => {
    const r = await cargarInventarioMaiz();
    expect(r.status).toBe("ok");
    if (r.status !== "ok") throw new Error("estado inesperado");
    expect(r.filas).toEqual([]);
    expect(r.resumen).toEqual({ stock: "0.00", precio: "0.00", inversion: "0.00" });
    expect(new Date(r.fechaConsulta).toISOString()).toBe(r.fechaConsulta);
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
  });
});

describe("errores inesperados", () => {
  it("una excepción de la carga se devuelve como status error", async () => {
    mocks.cargar.mockRejectedValue(new Error("boom"));
    const r = await cargarInventarioMaiz();
    expect(r).toEqual({ status: "error", error: "No se pudo cargar: boom" });
  });
});
