/**
 * Query labels carried into load errors. They live apart from `consultas.ts` so
 * the mappers (and their tests) do not pull the database module in.
 */
export const CONSULTA_LOCALES =
  "CbllenarTableAdapter.FillByTodasSinPiladoraSinMenu (Anexo A §A.B)";
export const CONSULTA_PRODUCTOS =
  "ProductoFormulaInventarioTableAdapter.FillByMaiz (Anexo A §A.A)";
export const CONSULTA_FECHA_CIERRE = "CierreTableAdapter.SelectCierreFecha";
export const CONSULTA_VALIDAR_COMPRA = "ValidarCompraTableAdapter.GetData";
export const CONSULTA_VALIDAR_VENTA = "ValidarVentaTableAdapter.GetData";
