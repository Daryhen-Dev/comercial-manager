import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cargarInsumos: vi.fn(),
}));

vi.mock("./datos/cargar-insumos", () => ({
  cargarInsumosProducto: mocks.cargarInsumos,
}));

import {
  calcularVistaInventarioMaiz,
  MENSAJE_COMPRAS_VENTAS_POR_LIQUIDAR,
  MENSAJE_INVENTARIO_NEGATIVO,
} from "./calcular-vista";
import { CsDecimal } from "@/lib/cs-decimal/cs-decimal";
import type { CargaVistaInventarioMaiz, DatoProducto } from "./datos/tipos";

const d = (s: string) => CsDecimal.parse(s);

function producto(overrides: Partial<DatoProducto> = {}): DatoProducto {
  return {
    idProducto: 1,
    idLocal: 1,
    sucursal: "VENTANAS",
    producto: "MAIZ",
    humedadSeco: d("13"),
    mermaAgua: d("0.5"),
    servBasico: d("0.02"),
    precio: d("0"),
    precioMinimo: d("0"),
    precioMaximo: d("0"),
    mmEstado: false,
    mmHumeSeco: d("0"),
    mmMermaAgua: d("0"),
    mmServiBasico: d("0"),
    mmPrecio: d("0"),
    stock: d("100"),
    stockPrecio: d("5"),
    stockInversion: d("500"),
    stockQqUtilidad: d("0"),
    stockTotalUtilidad: d("0"),
    predioDia: d("0"),
    humedad: d("0"),
    impureza: d("0"),
    ...overrides,
  };
}

const carga = (o: Partial<CargaVistaInventarioMaiz> = {}): CargaVistaInventarioMaiz => ({
  productos: [{ producto: producto(), fechaCierre: new Date("2026-10-13T23:29:57.000Z") }],
  faltantes: { compras: [], ventas: [] },
  estadoInventario: false,
  estadoFaltantes: false,
  ...o,
});

const insumos = {
  compras: [],
  ventas: [],
  emboAnti: { anticipo: d("0"), embo: d("0") },
  embodegadoIds: [],
  idsPorTipo: {
    compraBascula: [],
    compraRomana: [],
    compraGeneral: [],
    ventaBascula: [],
    ventaBodeguita: [],
    ventaGeneral: [],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cargarInsumos.mockResolvedValue(insumos);
});

describe("precedencia de bloqueos", () => {
  it("inventario negativo gana y no carga insumos", async () => {
    const vista = await calcularVistaInventarioMaiz(carga({ estadoInventario: true }));
    expect(vista).toEqual({
      estado: "inventario-negativo",
      mensaje: MENSAJE_INVENTARIO_NEGATIVO,
    });
    expect(mocks.cargarInsumos).not.toHaveBeenCalled();
  });

  it("faltantes bloquea y tampoco carga insumos", async () => {
    const vista = await calcularVistaInventarioMaiz(carga({ estadoFaltantes: true }));
    expect(vista).toEqual({
      estado: "faltantes-pendientes",
      mensaje: MENSAJE_COMPRAS_VENTAS_POR_LIQUIDAR,
    });
    expect(mocks.cargarInsumos).not.toHaveBeenCalled();
  });

  it("con ambos activos gana inventario: un solo mensaje", async () => {
    const vista = await calcularVistaInventarioMaiz(
      carga({ estadoInventario: true, estadoFaltantes: true }),
    );
    expect(vista).toEqual({
      estado: "inventario-negativo",
      mensaje: MENSAJE_INVENTARIO_NEGATIVO,
    });
  });
});

describe("camino calculado", () => {
  it("carga insumos por producto con la fecha de su sucursal", async () => {
    await calcularVistaInventarioMaiz(carga());
    expect(mocks.cargarInsumos).toHaveBeenCalledTimes(1);
    const [productoArg, fechaArg] = mocks.cargarInsumos.mock.calls[0];
    expect(productoArg.idProducto).toBe(1);
    expect(fechaArg).toEqual(new Date("2026-10-13T23:29:57.000Z"));
  });

  it("sin movimientos el resumen usa el stock previo", async () => {
    const vista = await calcularVistaInventarioMaiz(carga());
    expect(vista.estado).toBe("calculado");
    if (vista.estado !== "calculado") throw new Error("estado inesperado");
    expect(vista.resumen).toEqual({
      stock: "100.00",
      precio: "5.00",
      inversion: "500.00",
    });
  });

  it("suma varios productos y promedia ponderado por quintales", async () => {
    const vista = await calcularVistaInventarioMaiz(
      carga({
        productos: [
          {
            producto: producto({ idProducto: 3, stock: d("1480"), stockInversion: d("66000"), stockPrecio: d("44.59") }),
            fechaCierre: new Date("2026-10-13T23:29:57.000Z"),
          },
          {
            producto: producto({ idProducto: 9, stock: d("300"), stockInversion: d("12000"), stockPrecio: d("40") }),
            fechaCierre: new Date("2026-10-13T23:29:57.000Z"),
          },
        ],
      }),
    );
    if (vista.estado !== "calculado") throw new Error("estado inesperado");
    expect(vista.resumen).toEqual({
      stock: "1,780.00",
      precio: "43.82",
      inversion: "78,000.00",
    });
  });
});
