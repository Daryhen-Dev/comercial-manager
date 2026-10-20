import { db } from "@/lib/db";

export {
  CONSULTA_FECHA_CIERRE,
  CONSULTA_LOCALES,
  CONSULTA_PRODUCTOS,
  CONSULTA_VALIDAR_COMPRA,
  CONSULTA_VALIDAR_VENTA,
} from "./contextos";

export type RawLocal = { IDLocal: number | null; Sucursal: string | null };

/** Every branch except 2 (the legacy `…SinPiladoraSinMenu`). No ORDER BY on purpose. */
export async function traerSucursales(): Promise<RawLocal[]> {
  return db.$queryRaw<RawLocal[]>`
SELECT L.IDLocal , L.[Local] Sucursal
FROM [Local] L
WHERE L.IDLocal !=2`;
}

export type RawProductoFormulaMaiz = {
  IDProducto: unknown;
  IDLocal: unknown;
  Sucursal: unknown;
  PRODUCTO: unknown;
  HUMEDAD_SECO: unknown;
  MERMA_AGUA: unknown;
  SERV_BASICO: unknown;
  PRECIO: unknown;
  PRECIO_MINIMO: unknown;
  PRECIO_MAXIMO: unknown;
  STOCK: unknown;
  STOCK_PRECIO: unknown;
  STOCK_INVERSION: unknown;
  UtilidadQQ: unknown;
  UtilidadTotal: unknown;
  PrecioDia: unknown;
  Humedad: unknown;
  Impureza: unknown;
};

/** `FillByMaiz`: the products of one branch that have a row in its last closing. */
export async function traerProductosFormulaMaiz(
  idLocal: number,
): Promise<RawProductoFormulaMaiz[]> {
  return db.$queryRaw<RawProductoFormulaMaiz[]>`
WITH A AS ( SELECT IDProducto, L.IDLocal, L.[Local] Sucursal, Descripcion PRODUCTO,
CASE WHEN HumedadSeco IS NULL THEN '0' ELSE HumedadSeco END HUMEDAD_SECO,
CASE WHEN MermaAgua IS NULL THEN '0' ELSE MermaAgua END MERMA_AGUA,
CASE WHEN ServBasico IS NULL THEN '0' ELSE ServBasico END SERV_BASICO,
CASE WHEN Precio IS NULL THEN '0' ELSE Precio END PRECIO,
CASE WHEN PrecioMinimo IS NULL THEN '0' ELSE PrecioMinimo END PRECIO_MINIMO,
CASE WHEN PrecioMaximo IS NULL THEN '0' ELSE  PrecioMaximo END PRECIO_MAXIMO
FROM   Producto P
INNER JOIN [Local] L ON P.IDLocal = L.IDLocal
WHERE L.IDLocal = ${idLocal} AND  P.Estado = 1
),  C AS (
	SELECT CI.IdCierre, CP.IDProducto, CP.Cantidad STOCK, CP.Precio STOCK_PRECIO, CP.Inversion STOCK_INVERSION, CP.UtilidadQQ, CP.UtilidadTotal, CP.PrecioDia, CP.Humedad, CP.Impureza
	FROM Cierre CI
	INNER JOIN Cierre_Producto CP ON CP.IdCierre = CI.IdCierre
	INNER JOIN Producto P ON P.IDProducto = CP.IDProducto
	WHERE CI.IdLocal = ${idLocal} AND P.Estado = 1 AND CI.Fecha = (
	SELECT MAX(CI.Fecha) FECHA
	FROM Cierre CI
	INNER JOIN Producto P ON P.IDLocal = CI.IdLocal
	WHERE CI.IdLocal = ${idLocal} AND P.Estado = 1
	)
)
SELECT A.IDProducto, A.IDLocal, A.Sucursal, A.PRODUCTO,
A.HUMEDAD_SECO, A.MERMA_AGUA, A.SERV_BASICO, A.PRECIO, A.PRECIO_MINIMO, A.PRECIO_MAXIMO,
C.STOCK, C.STOCK_PRECIO, C.STOCK_INVERSION, C.UtilidadQQ, C.UtilidadTotal, C.PrecioDia, C.Humedad, C.Impureza
FROM A INNER JOIN C ON A.IDProducto =  C.IDProducto
WHERE A.PRODUCTO = 'MAIZ'`;
}

export type RawFechaCierre = { Fecha: unknown };

/** `SelectCierreFecha`: the branch's previous closing date. */
export async function traerFechaCierre(idLocal: number): Promise<RawFechaCierre[]> {
  return db.$queryRaw<RawFechaCierre[]>`
SELECT MAX(CI.Fecha) Fecha
FROM Cierre CI
WHERE CI.IdLocal = ${idLocal}`;
}

export type RawValidacionCompra = {
  IDBoletoDetalle: unknown;
  Sucursal: unknown;
  CODIGO: unknown;
  PRODUCTO: unknown;
  CLIENTE: unknown;
  FECHA: unknown;
};

export async function traerValidacionCompra(
  idLocal: number,
  fecha: Date,
): Promise<RawValidacionCompra[]> {
  return db.$queryRaw<RawValidacionCompra[]>`
SELECT CBD.IDBoletoDetalle, L.[Local] Sucursal,  CONVERT(NVARCHAR, CBD.Codigo) + '-' + CONVERT(NVARCHAR, CBD.CodDia) CODIGO, P.Descripcion PRODUCTO, C.NombreCompleto CLIENTE, CBS.Fecha FECHA
  FROM CompraBoletoDetalle CBD
  INNER JOIN CompraBoletoSalida CBS ON CBD.IDBoletoDetalle = CBS.IDBoletoDetalle
  INNER JOIN Cliente C ON CBD.IDCliente = C.IDCliente
  INNER JOIN Producto P ON CBD.IDProducto = P.IDProducto
  INNER JOIN [Local] L ON L.IDLocal = CBD.IDLocal
  WHERE CBD.IDLocal = ${idLocal} AND CONVERT(DATE, CBS.Fecha) > CAST(${fecha} AS DATETIME)
  AND CBD.IDBoletoDetalle  NOT IN  (
	SELECT CL.IDBoletoDetalle
	FROM Compra_Liquidacion CL
	INNER JOIN CompraBoletoDetalle CBD ON CBD.IDBoletoDetalle = CL.IDBoletoDetalle
	WHERE CBD.IDLocal = ${idLocal} AND CONVERT(DATE, CL.Fecha)> CAST(${fecha} AS DATETIME)
  )`;
}

export type RawValidacionVenta = {
  IDBoletoDetalle: unknown;
  /** Uppercase in the venta query; the legacy bug was reading `Sucursal` here. */
  SUCURSAL: unknown;
  CODIGO: unknown;
  PRODUCTO: unknown;
  CLIENTE: unknown;
  FECHA: unknown;
};

export async function traerValidacionVenta(
  idLocal: number,
  fecha: Date,
): Promise<RawValidacionVenta[]> {
  return db.$queryRaw<RawValidacionVenta[]>`
SELECT BEV.IDBoletoEntradaVenta IDBoletoDetalle, L.[Local] SUCURSAL,  CONVERT(NVARCHAR, BEV.CodSalida) + '-' +  CONVERT(NVARCHAR, BEV.CodDia) CODIGO,
  P.Descripcion PRODUCTO, C.NombreCompleto CLIENTE, BSV.FechaHora FECHA
	   FROM BoletoEntradaVenta BEV
	   INNER JOIN BoletoSalidaVenta BSV ON BEV.IDBoletoEntradaVenta = BSV.IDBoletoEntradaVenta
	   INNER JOIN Producto AS P ON BEV.IDProducto = P.IDProducto
	   INNER JOIN Cliente C ON C.IDCliente = BEV.IDCliente
	   INNER JOIN [Local] L ON L.IDLocal = BEV.IDLocal
       WHERE BEV.IDLocal = ${idLocal}  AND BSV.FechaHora > CAST(${fecha} AS DATETIME) AND BEV.IDBoletoEntradaVenta NOT IN
       (
	   SELECT CCV.IDBoletoEntradaVenta
       FROM CobroComprobanteVenta CCV
	   INNER JOIN BoletoEntradaVenta AS BEV ON BEV.IDBoletoEntradaVenta = CCV.IDBoletoEntradaVenta
	   WHERE BEV.IDLocal = ${idLocal} AND CCV.FechaHoraPago > CAST(${fecha} AS DATETIME)
	   )`;
}
