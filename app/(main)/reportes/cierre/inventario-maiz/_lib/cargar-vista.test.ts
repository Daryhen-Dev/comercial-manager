import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const mocks = vi.hoisted(() => ({
  sucursales: vi.fn(),
  productos: vi.fn(),
  fecha: vi.fn(),
  validarCompra: vi.fn(),
  validarVenta: vi.fn(),
  log: [] as string[],
}));

vi.mock("./datos/consultas", () => ({
  traerSucursales: mocks.sucursales,
  traerProductosFormulaMaiz: mocks.productos,
  traerFechaCierre: mocks.fecha,
  traerValidacionCompra: mocks.validarCompra,
  traerValidacionVenta: mocks.validarVenta,
}));

import { cargarVistaInventarioMaiz } from "./cargar-vista";

const FILA_PRODUCTO = {
  IDProducto: 1,
  IDLocal: 1,
  Sucursal: "VENTANAS",
  PRODUCTO: "MAIZ",
  HUMEDAD_SECO: "13",
  MERMA_AGUA: "0.5",
  SERV_BASICO: "0.02",
  PRECIO: "17",
  PRECIO_MINIMO: "0",
  PRECIO_MAXIMO: "0",
  STOCK: "100",
  STOCK_PRECIO: "5",
  STOCK_INVERSION: "500",
  UtilidadQQ: "0",
  UtilidadTotal: "0",
  PrecioDia: "0",
  Humedad: "0",
  Impureza: "0",
};

const FECHA = new Date("2026-10-13T23:29:57.000Z");

const validacion = (id: number) => ({
  IDBoletoDetalle: id,
  Sucursal: "VENTANAS",
  CODIGO: `C-${id}`,
  PRODUCTO: "MAIZ",
  CLIENTE: "CLIENTE",
  FECHA,
});

const validacionVenta = (id: number) => ({
  IDBoletoDetalle: id,
  SUCURSAL: "VENTANAS",
  CODIGO: `V-${id}`,
  PRODUCTO: "MAIZ",
  CLIENTE: "CLIENTE",
  FECHA,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.log.length = 0;
  mocks.sucursales.mockResolvedValue([
    { IDLocal: 1, Sucursal: "VENTANAS" },
    { IDLocal: 3, Sucursal: "VINCES" },
  ]);
  mocks.productos.mockImplementation(async (idLocal: number) => {
    mocks.log.push(`productos:${idLocal}`);
    return idLocal === 1 ? [FILA_PRODUCTO] : [];
  });
  mocks.fecha.mockImplementation(async (idLocal: number) => {
    mocks.log.push(`fecha:${idLocal}`);
    return [{ Fecha: FECHA }];
  });
  mocks.validarCompra.mockResolvedValue([]);
  mocks.validarVenta.mockResolvedValue([]);
});

describe("orden de la carga", () => {
  it("por sucursal consulta primero los productos y después la fecha", async () => {
    await cargarVistaInventarioMaiz();
    expect(mocks.log).toEqual([
      "productos:1",
      "fecha:1",
      "productos:3",
      "fecha:3",
    ]);
  });

  it("consulta la fecha de TODAS las sucursales, aunque no tengan MAIZ", async () => {
    await cargarVistaInventarioMaiz();
    expect(mocks.fecha).toHaveBeenCalledTimes(2);
    expect(mocks.fecha).toHaveBeenCalledWith(3);
  });

  it("solo expone los productos que existen en el último cierre", async () => {
    const carga = await cargarVistaInventarioMaiz();
    expect(carga.productos).toHaveLength(1);
    expect(carga.productos[0].producto.idProducto).toBe(1);
    expect(carga.productos[0].fechaCierre).toEqual(FECHA);
  });
});

describe("faltantes", () => {
  it("acumula las validaciones por producto sin deduplicar", async () => {
    // Una sola sucursal con dos productos MAIZ: la validación se repite por cada uno.
    mocks.sucursales.mockResolvedValue([{ IDLocal: 1, Sucursal: "VENTANAS" }]);
    mocks.productos.mockResolvedValue([
      FILA_PRODUCTO,
      { ...FILA_PRODUCTO, IDProducto: 2 },
    ]);
    mocks.validarCompra.mockResolvedValue([validacion(10)]);
    mocks.validarVenta.mockResolvedValue([validacionVenta(20)]);

    const carga = await cargarVistaInventarioMaiz();

    expect(mocks.validarCompra).toHaveBeenCalledTimes(2);
    expect(carga.faltantes.compras).toHaveLength(2);
    expect(carga.faltantes.ventas).toHaveLength(2);
  });

  it("estadoFaltantes se activa con una sola venta pendiente", async () => {
    mocks.validarVenta.mockResolvedValue([validacionVenta(20)]);
    const carga = await cargarVistaInventarioMaiz();
    expect(carga.estadoFaltantes).toBe(true);
  });

  it("sin comprobantes pendientes queda en false", async () => {
    const carga = await cargarVistaInventarioMaiz();
    expect(carga.estadoFaltantes).toBe(false);
  });
});

describe("estadoInventario", () => {
  it("se activa con stock negativo", async () => {
    mocks.productos.mockResolvedValue([{ ...FILA_PRODUCTO, STOCK: "-0.004" }]);
    const carga = await cargarVistaInventarioMaiz();
    expect(carga.estadoInventario).toBe(true);
  });

  it("stock exactamente cero no bloquea", async () => {
    mocks.productos.mockResolvedValue([{ ...FILA_PRODUCTO, STOCK: "0.00" }]);
    const carga = await cargarVistaInventarioMaiz();
    expect(carga.estadoInventario).toBe(false);
  });
});

describe("la consulta de productos", () => {
  const fuente = readFileSync(new URL("./datos/consultas.ts", import.meta.url), "utf8");

  it("filtra por el producto exacto MAIZ", () => {
    expect(fuente).toContain("WHERE A.PRODUCTO = 'MAIZ'");
  });

  it("no selecciona las columnas MM, que dejarian la rama normal inalcanzable", () => {
    expect(fuente).not.toContain("EstadoMM");
    expect(fuente).not.toContain("MMHUMESECO");
  });

  it("excluye la sucursal 2 en la consulta de locales", () => {
    expect(fuente).toContain("WHERE L.IDLocal !=2");
  });
});
