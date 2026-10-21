/**
 * Who may use this system. One rule, two enforcement points.
 *
 * The system serves **one branch** (the plant, `IDLocal = 1`), and inside it only
 * administrators. Everything else — another branch, a cashier, a disabled
 * account — is refused with the same generic answer as a wrong password, so a
 * stranger cannot use the login screen to find out which accounts exist.
 *
 * `auth.ts` applies it to the credential exchange (so no session is ever issued)
 * and `app/(main)/layout.tsx` applies it to every request (so a session issued
 * before this rule existed stops working immediately). Keeping the rule in one
 * function is what stops the two from drifting apart.
 */

/** The only branch this system serves: VENTANAS. */
export const ID_LOCAL_IMPLICITO = 1;

/** `UsuarioRolId` is the authoritative role field; `RolUsuario` is its label. */
export const ROL_ADMINISTRADOR = 1;

export type CuentaDeAcceso = {
  // Optional so the session object (`IDLocal?: number | null`) fits without a
  // cast. Every comparison is `=== 1`, so `undefined` is simply "no".
  IDLocal?: number | null;
  UsuarioRolId?: number | null;
  Estado?: boolean | null;
};

/** Branch + role, ignoring whether the account is enabled. */
export function esAdminDeVentanas(cuenta: CuentaDeAcceso): boolean {
  return (
    cuenta.IDLocal === ID_LOCAL_IMPLICITO &&
    cuenta.UsuarioRolId === ROL_ADMINISTRADOR
  );
}

/**
 * The full gate for a credential exchange: enabled account, this branch,
 * administrator. `Estado` must be exactly `true`; the column is nullable and
 * `null` is not a yes.
 */
export function puedeIngresar(cuenta: CuentaDeAcceso): boolean {
  return cuenta.Estado === true && esAdminDeVentanas(cuenta);
}
