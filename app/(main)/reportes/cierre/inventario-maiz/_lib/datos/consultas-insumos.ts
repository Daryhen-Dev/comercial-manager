import { db } from "@/lib/db";

/**
 * The eight "insumos del día" queries. Every numeric output is wrapped in
 * `CONVERT(NVARCHAR(100), ...)` on purpose: it preserves the `System.Decimal`
 * scale, which Prisma loses when it hands back a `Decimal`.
 *
 * All of them cut with `> CAST(@fecha AS DATETIME)` and have no upper bound.
 */

export type RawCompraBascula = {
  IDBoletoDetalle: unknown;
  PRODUCTO: unknown;
  HUMEDAD: unknown;
  IMPUREZA: unknown;
  QQBRUTO: unknown;
  NETO: unknown;
  PORCEN: unknown;
  MERMA: unknown;
  FECHA: unknown;
  PRECIO: unknown;
  VTOTAL: unknown;
  RETEN: unknown;
  EFECTIVO: unknown;
  CHEQUE: unknown;
  TRANSFERENCIA: unknown;
  PENDIENTE: unknown;
  COMISION: unknown;
};

export function traerCompraBascula(idProducto: number, fecha: Date) {
  return db.$queryRaw<RawCompraBascula[]>`
WITH CBASCULA AS (
SELECT CBD.IDBoletoDetalle,
CBD.Humedad [HUMEDAD], CBD.Impureza [IMPUREZA],CA.Merma + CA.Neto QQBRUTO, CA.Neto [NETO], CA.Merma MERMA, CA.Porcentaje PORCEN,
PRO.Descripcion [PRODUCTO],
CL.Fecha_Edit FECHA,
CA.Precio PRECIO, CA.ValorTotal VTOTAL, CL.ValorTotal VAPAGAR , CL.Retencion RETEN, CA.ValorTotalComision COMI
FROM Compra_Liquidacion CL
INNER JOIN CompraBoletoEntrada CBE ON CBE.IDBoletoDetalle = CL.IDBoletoDetalle
INNER JOIN CompraBoletoSalida CBS  ON CBS.IDBoletoDetalle = CBE.IDBoletoDetalle
INNER JOIN  CompraBoletoDetalle CBD  ON CL.IDBoletoDetalle  = CBD.IDBoletoDetalle
INNER JOIN Compra_Almacenaje CA    ON CA.IDBoletoDetalle  = CBD.IDBoletoDetalle
INNER JOIN Producto PRO ON PRO.IDProducto = CBD.IDProducto
WHERE CL.Precio !=0 AND CL.PesoNeto != 0 AND CBD.IDProducto = ${idProducto} AND CL.Fecha_Edit > CAST(${fecha} AS DATETIME)
), EFEC AS
(
	SELECT CTPE.IdBoletoDetalle,  SUM(CTPE.CantidadParcial) EFECTIVO
	FROM Compra_Transaccion_Pago_Efectivo CTPE
	INNER JOIN Compra_Liquidacion CL ON CTPE.IdBoletoDetalle = CL.IDBoletoDetalle
	INNER JOIN CompraBoletoDetalle CBD ON CBD.IDBoletoDetalle = CL.IDBoletoDetalle
	WHERE  CBD.IDProducto = ${idProducto} AND CL.Fecha_Edit > CAST(${fecha} AS DATETIME)
	GROUP BY CTPE.IdBoletoDetalle

), CHE AS
(
	SELECT CTPC.IdBoletoDetalle, SUM(CTPC.CantidadParcial) CHEQUE
	FROM Compra_Transaccion_Pago_Cheque CTPC
	INNER JOIN Compra_Liquidacion CL ON CTPC.IdBoletoDetalle = CL.IDBoletoDetalle
	INNER JOIN CompraBoletoDetalle CBD ON CBD.IDBoletoDetalle = CL.IDBoletoDetalle
	WHERE  CBD.IDProducto = ${idProducto} AND CL.Fecha_Edit > CAST(${fecha} AS DATETIME)
	GROUP BY CTPC.IdBoletoDetalle
)
, TRANSF AS
(
	SELECT CTPT.IdBoletoDetalle, SUM(CTPT.CantidadParcial) TRANSFERENCIA
	FROM Compra_Transaccion_Pago_Transferencia CTPT
	INNER JOIN Compra_Liquidacion CL ON CTPT.IdBoletoDetalle = CL.IDBoletoDetalle
	INNER JOIN CompraBoletoDetalle CBD ON CBD.IDBoletoDetalle = CL.IDBoletoDetalle
	WHERE  CBD.IDProducto = ${idProducto} AND CL.Fecha_Edit > CAST(${fecha} AS DATETIME)
	GROUP BY CTPT.IdBoletoDetalle
)

SELECT CBASCULA.IDBoletoDetalle, CBASCULA.PRODUCTO, CONVERT(NVARCHAR(100), CBASCULA.HUMEDAD) HUMEDAD, CONVERT(NVARCHAR(100), CBASCULA.IMPUREZA) IMPUREZA, CONVERT(NVARCHAR(100), CBASCULA.QQBRUTO) QQBRUTO, CONVERT(NVARCHAR(100), CBASCULA.NETO) NETO,
CONVERT(NVARCHAR(100), CBASCULA.MERMA) MERMA, CONVERT(NVARCHAR(100), CBASCULA.PORCEN) PORCEN,
CBASCULA.FECHA, CONVERT(NVARCHAR(100), CBASCULA.PRECIO) PRECIO, CONVERT(NVARCHAR(100), CBASCULA.VTOTAL) VTOTAL, CONVERT(NVARCHAR(100), CBASCULA.RETEN) RETEN,
CONVERT(NVARCHAR(100), CASE WHEN EFEC.EFECTIVO IS NULL THEN 0 ELSE EFEC.EFECTIVO END) EFECTIVO,
CONVERT(NVARCHAR(100), CASE WHEN CHE.CHEQUE IS NULL THEN 0 ELSE CHE.CHEQUE END) CHEQUE,
CONVERT(NVARCHAR(100), CASE WHEN TRANSF.TRANSFERENCIA IS NULL THEN 0 ELSE TRANSF.TRANSFERENCIA END) TRANSFERENCIA,
CONVERT(NVARCHAR(100), CBASCULA.VAPAGAR -  CBASCULA.RETEN - (CASE WHEN EFEC.EFECTIVO IS NULL THEN 0 ELSE EFEC.EFECTIVO END  +
CASE WHEN CHE.CHEQUE IS NULL THEN 0 ELSE CHE.CHEQUE END +
CASE WHEN TRANSF.TRANSFERENCIA IS NULL THEN 0 ELSE TRANSF.TRANSFERENCIA END)) PENDIENTE,
CONVERT(NVARCHAR(100), CBASCULA.COMI) COMISION
FROM CBASCULA
LEFT JOIN EFEC ON CBASCULA.IDBoletoDetalle = EFEC.IdBoletoDetalle
LEFT JOIN CHE ON CBASCULA.IDBoletoDetalle = CHE.IdBoletoDetalle
LEFT JOIN TRANSF ON CBASCULA.IDBoletoDetalle = TRANSF.IdBoletoDetalle`;
}

export type RawCompraRomana = {
  IDBoletoDetalle: unknown;
  PRODUCTO: unknown;
  HUMEDAD: unknown;
  IMPUREZA: unknown;
  QQBRUTO: unknown;
  NETO: unknown;
  PORCENTAJE: unknown;
  MERMA: unknown;
  FECHA: unknown;
  PRECIO: unknown;
  VTOTAL: unknown;
  RETEN: unknown;
  EFECTIVO: unknown;
  CHEQUE: unknown;
  TRANSFERENCIA: unknown;
  PENDIENTE: unknown;
  ANTICIPO: unknown;
  COMISION: unknown;
};

export function traerCompraRomana(idProducto: number, fecha: Date) {
  return db.$queryRaw<RawCompraRomana[]>`
SELECT R.IDRomana IDBoletoDetalle, P.Descripcion [PRODUCTO],  CONVERT(NVARCHAR(100), R.Humedad) [HUMEDAD], CONVERT(NVARCHAR(100), R.Impureza) [IMPUREZA], CONVERT(NVARCHAR(100), AC.PesoPagar) QQBRUTO, CONVERT(NVARCHAR(100), AC.Neto) [NETO],
CONVERT(NVARCHAR(100), AC.Porcentaje) PORCENTAJE,  CONVERT(NVARCHAR(100), AC.Merma) MERMA, RC.FechaHoraPago FECHA, CONVERT(NVARCHAR(100), AC.Precio) PRECIO, CONVERT(NVARCHAR(100), AC.ValorTotal) VTOTAL, CONVERT(NVARCHAR(100), RC.RetencionReal) RETEN,
CONVERT(NVARCHAR(100), RC.Efectivo) EFECTIVO, CONVERT(NVARCHAR(100), RC.Cheque) CHEQUE,  CONVERT(NVARCHAR(100), 0) TRANSFERENCIA, CONVERT(NVARCHAR(100), 0) PENDIENTE, CONVERT(NVARCHAR(100), 0) ANTICIPO , CONVERT(NVARCHAR(100), 0) COMISION
FROM RomanaComprobante RC
INNER JOIN Romana R ON RC.IDRomana = R.IDRomana
INNER JOIN Producto P ON P.IDProducto = R.IDProducto
INNER JOIN AlmacenamientoCompra AC ON AC.IDRomana = RC.IDRomana
WHERE R.IDProducto = ${idProducto} AND RC.FechaHoraPago > CAST(${fecha} AS DATETIME) AND R.IDRomana NOT IN
(
SELECT R.IDRomana
FROM Cierre_Producto_Operacion_Compra_Romana CPOCR
INNER JOIN Romana R ON CPOCR.IdBoletoDetalle = R.IDRomana
INNER JOIN RomanaComprobante RC ON R.IDRomana = RC.IDRomana
INNER JOIN Producto P ON P.IDProducto = R.IDProducto
WHERE R.IDProducto = ${idProducto} AND RC.FechaHoraPago > CAST(${fecha} AS DATETIME)
 )`;
}

export type RawCompraGeneral = RawCompraRomana;

export function traerCompraGeneral(idProducto: number, fecha: Date) {
  return db.$queryRaw<RawCompraGeneral[]>`
SELECT CG.IDCompraGeneral IDBoletoDetalle, P.Descripcion [PRODUCTO], CONVERT(NVARCHAR(100), CG.Humedad) [HUMEDAD], CONVERT(NVARCHAR(100), CG.Impureza) [IMPUREZA], CONVERT(NVARCHAR(100), AC.PesoPagar) QQBRUTO,  CONVERT(NVARCHAR(100), AC.Neto) NETO,
CONVERT(NVARCHAR(100), AC.Porcentaje) PORCENTAJE, CONVERT(NVARCHAR(100), AC.Merma) MERMA,  CG.FechaHora FECHA, CONVERT(NVARCHAR(100), CG.Precio) PRECIO, CONVERT(NVARCHAR(100), AC.ValorTotal) VTOTAL,
CONVERT(NVARCHAR(100), CASE WHEN CG.Precio * CG.Quintales = AC.ValorTotal  THEN 0 ELSE AC.ValorTotal - (CG.Precio * CG.Quintales) END) RETEN
, CONVERT(NVARCHAR(100), CG.Efectivo) EFECTIVO, CONVERT(NVARCHAR(100), CG.Cheque) CHEQUE,  CONVERT(NVARCHAR(100), 0) TRANSFERENCIA , CONVERT(NVARCHAR(100), 0) PENDIENTE, CONVERT(NVARCHAR(100), 0) ANTICIPO, CONVERT(NVARCHAR(100), 0) COMISION
FROM CompraGeneral CG
INNER JOIN Producto P ON P.IDProducto = CG.IDProducto
INNER JOIN AlmacenamientoCompra AC ON AC.IDCompraGeneral = CG.IDCompraGeneral
WHERE P.IDProducto = ${idProducto} AND CG.FechaHora > CAST(${fecha} AS DATETIME) AND CG.IDCompraGeneral NOT IN (
	SELECT CG.IDCompraGeneral
	FROM Cierre_Producto_Operacion_Compra_General CPOCG
	INNER JOIN CompraGeneral CG ON CPOCG.IdBoletoDetalle = CG.IDCompraGeneral
	INNER JOIN Producto P ON CG.IDProducto = P.IDProducto
	WHERE P.IDProducto = ${idProducto} AND CG.FechaHora >  CAST(${fecha} AS DATETIME)
)`;
}

export type RawEmboAnti = { ANTICIPO: unknown; EMBO: unknown };

export function traerEmboAnti(idProducto: number, fecha: Date) {
  return db.$queryRaw<RawEmboAnti[]>`
SELECT CONVERT(NVARCHAR(100), SUM(A.ANTIEFEC) + SUM(A.ANTICHE)) ANTICIPO, CONVERT(NVARCHAR(100), SUM( A.EMBO)) EMBO
	FROM (
	SELECT CASE WHEN SUM(CTPT.CantidadParcial) IS NULL THEN 0 ELSE SUM(CTPT.CantidadParcial) END ANTIEFEC, 0 ANTICHE, 0 EMBO
	FROM Compra_Transaccion_Pago_Efectivo CTPT
	INNER JOIN Compra_Liquidacion CL ON CL.IDBoletoDetalle = CTPT.IdBoletoDetalle
	INNER JOIN CompraBoletoDetalle CBD ON CBD.IDBoletoDetalle = CL.IDBoletoDetalle
	WHERE CTPT.Anticipo = 1 AND CL.Precio = 0 AND CL.PesoNeto != 0 AND CBD.IDProducto = ${idProducto} AND CL.Fecha_Edit > CAST(${fecha} AS DATETIME)
	UNION ALL
	SELECT 0 ANTIEFEC,
	CASE WHEN SUM(CTPC.CantidadParcial) IS NULL THEN 0 ELSE  SUM(CTPC.CantidadParcial) END ANTICHE,  0 EMBO
	FROM Compra_Transaccion_Pago_Cheque CTPC
	INNER JOIN Compra_Liquidacion CL ON CL.IDBoletoDetalle = CTPC.IdBoletoDetalle
	INNER JOIN CompraBoletoDetalle CBD ON CBD.IDBoletoDetalle = CL.IDBoletoDetalle
	WHERE CTPC.Anticipo = 1 AND CL.Precio = 0 AND CL.PesoNeto != 0 AND CBD.IDProducto = ${idProducto} AND CL.Fecha_Edit > CAST(${fecha} AS DATETIME)
	UNION ALL
	SELECT  0 ANTIEFEC, 0 ANTICHE, CASE WHEN SUM(CL.PesoNeto) IS NULL THEN 0 ELSE SUM(CL.PesoNeto) END EMBO
	FROM Compra_Liquidacion CL
	INNER JOIN CompraBoletoDetalle CBD ON CBD.IDBoletoDetalle = CL.IDBoletoDetalle
	WHERE CL.Precio = 0 AND CL.PesoNeto != 0 AND CBD.IDProducto = ${idProducto} AND CL.Fecha_Edit > CAST(${fecha} AS DATETIME)
	) A`;
}

export type RawCompraEmbodegado = {
  IDBoletoDetalle: unknown;
  Codigo: unknown;
  CodComprobante: unknown;
};

export function traerCompraEmbodegado(idProducto: number, fecha: Date) {
  return db.$queryRaw<RawCompraEmbodegado[]>`
SELECT CBD.IDBoletoDetalle, CBD.Codigo,  CLC.CodComprobante
FROM Compra_Liquidacion CL
INNER JOIN Compra_Liquidacion_Comprobante CLC ON CL.IDBoletoDetalle = CLC.IDBoletoDetalle
INNER JOIN CompraBoletoDetalle CBD  ON CL.IDBoletoDetalle  = CBD.IDBoletoDetalle
INNER JOIN Producto PRO ON PRO.IDProducto = CBD.IDProducto
WHERE CL.Precio = 0 AND CL.PesoNeto != 0 AND CBD.IDProducto = ${idProducto} AND CL.Fecha_Edit > CAST(${fecha} AS DATETIME)`;
}

export type RawVenta = {
  IDBoletoDetalle: unknown;
  PRODUCTO: unknown;
  HUMEDAD: unknown;
  IMPUREZA: unknown;
  QQBRUTO: unknown;
  NETO: unknown;
  FECHA: unknown;
  PRECIO: unknown;
  VTOTAL: unknown;
  RETEN: unknown;
  EFECTIVO: unknown;
  CHEQUE: unknown;
  DEPOSITO: unknown;
  PENDIENTE: unknown;
};

export function traerVentaBascula(idProducto: number, fecha: Date) {
  return db.$queryRaw<RawVenta[]>`
SELECT BS.IDBoletoEntradaVenta IDBoletoDetalle, P.Descripcion PRODUCTO, CONVERT(NVARCHAR(100), BE.Humedad) HUMEDAD, CONVERT(NVARCHAR(100), BE.Impureza) IMPUREZA,
CONVERT(NVARCHAR(100), AV.PesoPagar) QQBRUTO, CONVERT(NVARCHAR(100), AV.PesoPagar - AV.DiferenciaH) NETO,
CCV.FechaHoraPago FECHA,  CONVERT(NVARCHAR(100), CCV.Precio) PRECIO,
CONVERT(NVARCHAR(100), (CCV.Efectivo + CCV.Deposito + CCV.Cheque + CCV.Pendiente + CCV.RetencionReal)) VTOTAL, CONVERT(NVARCHAR(100), CCV.RetencionReal) RETEN,
CONVERT(NVARCHAR(100), CCV.Efectivo) EFECTIVO, CONVERT(NVARCHAR(100), CCV.Cheque) CHEQUE, CONVERT(NVARCHAR(100), CCV.Deposito) DEPOSITO, CONVERT(NVARCHAR(100), CCV.Pendiente) PENDIENTE
FROM CobroComprobanteVenta CCV
INNER JOIN BoletoSalidaVenta BS  ON CCV.IDBoletoEntradaVenta = BS.IDBoletoEntradaVenta
INNER JOIN BoletoEntradaVenta BE ON CCV.IDBoletoEntradaVenta = BE.IDBoletoEntradaVenta
INNER JOIN AlmacenamientoVenta AV ON CCV.IDBoletoEntradaVenta = AV.IDBoletoEntradaVenta
INNER JOIN Producto P ON AV.IDProducto = P.IDProducto
WHERE P.IDProducto = ${idProducto} AND CCV.FechaHoraPago > CAST(${fecha} AS DATETIME) AND BS.IDBoletoEntradaVenta NOT IN (
	SELECT BEV.IDBoletoEntradaVenta
	FROM Cierre_Producto_Operacion_Venta_Bascula CPOVB
	INNER JOIN BoletoEntradaVenta BEV ON CPOVB.IdBoletoDetalle = BEV.IDBoletoEntradaVenta
	-- B-7 heredado: el join compara BEV consigo mismo, no con CCV.
	INNER JOIN CobroComprobanteVenta CCV ON BEV.IDBoletoEntradaVenta = BEV.IDBoletoEntradaVenta
	INNER JOIN Producto P ON BEV.IDProducto = P.IDProducto
	WHERE P.IDProducto = ${idProducto} AND CCV.FechaHoraPago > CAST(${fecha} AS DATETIME)
)`;
}

export function traerVentaBodeguita(idProducto: number, fecha: Date) {
  return db.$queryRaw<RawVenta[]>`
SELECT VB.IDVentaBodeguita IDBoletoDetalle,  P.Descripcion PRODUCTO, CONVERT(NVARCHAR(100), VB.Humedad) HUMEDAD, CONVERT(NVARCHAR(100), AV.Impureza) IMPUREZA,
CONVERT(NVARCHAR(100), AV.PesoPagar) QQBRUTO, CONVERT(NVARCHAR(100), AV.PesoPagar - AV.DiferenciaH) NETO,
VB.FechaHora FECHA, CONVERT(NVARCHAR(100), VB.Precio) PRECIO,
CONVERT(NVARCHAR(100), VB.Efectivo + VB.Cheque) VTOTAL, CONVERT(NVARCHAR(100), 0) RETEN,
CONVERT(NVARCHAR(100), VB.Efectivo) EFECTIVO, CONVERT(NVARCHAR(100), VB.Cheque) CHEQUE, CONVERT(NVARCHAR(100), VB.Deposito + VB.Transferencia + VB.NotaDebito) DEPOSITO, CONVERT(NVARCHAR(100), 0) PENDIENTE
FROM VentaBodeguita VB
INNER JOIN AlmacenamientoVenta AV ON VB.IDVentaBodeguita = AV.IDBodeguitaVenta
INNER JOIN Producto P ON P.IDProducto = VB.IDProducto
WHERE P.IDProducto = ${idProducto} AND VB.FechaHora > CAST(${fecha} AS DATETIME) AND VB.IDVentaBodeguita NOT IN (
	SELECT  VB.IDVentaBodeguita
	FROM Cierre_Producto_Operacion_Venta_Bodeguita CPOVB
	INNER JOIN VentaBodeguita VB ON CPOVB.IdBoletoDetalle = VB.IDVentaBodeguita
	INNER JOIN Producto P ON VB.IDProducto = P.IDProducto
	WHERE P.IDProducto = ${idProducto} AND VB.FechaHora > CAST(${fecha} AS DATETIME)
)`;
}

export function traerVentaGeneral(idProducto: number, fecha: Date) {
  return db.$queryRaw<RawVenta[]>`
SELECT VG.IDVentaGeneral IDBoletoDetalle, P.Descripcion PRODUCTO, CONVERT(NVARCHAR(100), VG.Humedad) HUMEDAD, CONVERT(NVARCHAR(100), AV.Impureza) IMPUREZA,
CONVERT(NVARCHAR(100), AV.PesoPagar) QQBRUTO,  CONVERT(NVARCHAR(100), AV.PesoPagar - AV.DiferenciaH) NETO,
VG.FechaHora FECHA, CONVERT(NVARCHAR(100), VG.Precio) PRECIO,
CONVERT(NVARCHAR(100), (VG.Efectivo + VG.Deposito + VG.Cheque + VG.RetencionReal)) VTOTAL, CONVERT(NVARCHAR(100), VG.RetencionReal) RETEN,
CONVERT(NVARCHAR(100), VG.Efectivo) EFECTIVO, CONVERT(NVARCHAR(100), VG.Cheque) CHEQUE, CONVERT(NVARCHAR(100), VG.Deposito) DEPOSITO, CONVERT(NVARCHAR(100), 0) PENDIENTE
FROM VentaGeneral VG
INNER JOIN AlmacenamientoVenta AV ON VG.IDVentaGeneral = AV.IDVentaGeneral
INNER JOIN Producto P ON P.IDProducto = VG.IDProducto
WHERE P.IDProducto = ${idProducto} AND VG.FechaHora > CAST(${fecha} AS DATETIME) AND VG.IDVentaGeneral NOT IN(
	SELECT VG.IDVentaGeneral
	FROM Cierre_Producto_Operacion_Venta_General CPOVG
	INNER JOIN VentaGeneral VG ON CPOVG.IdBoletoDetalle = VG.IDVentaGeneral
	INNER JOIN Producto P ON VG.IDProducto = P.IDProducto
	WHERE P.IDProducto = ${idProducto} AND VG.FechaHora > CAST(${fecha} AS DATETIME)
)`;
}
