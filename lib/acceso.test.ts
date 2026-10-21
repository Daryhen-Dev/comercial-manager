import { describe, expect, it } from "vitest";

import { esAdminDeVentanas, puedeIngresar, ID_LOCAL_IMPLICITO, ROL_ADMINISTRADOR } from "./acceso";

const admin = { IDLocal: 1, UsuarioRolId: 1, Estado: true };

describe("puedeIngresar — quién obtiene una sesión", () => {
  it("acepta al administrador activo de la sucursal 1", () => {
    expect(puedeIngresar(admin)).toBe(true);
  });

  it("rechaza al administrador activo de otra sucursal", () => {
    expect(puedeIngresar({ IDLocal: 3, UsuarioRolId: 1, Estado: true })).toBe(false);
  });

  it("rechaza al cajero activo de la sucursal 1", () => {
    // Antes autenticaba y recién el layout lo rebotaba, dejando una sesión viva.
    expect(puedeIngresar({ IDLocal: 1, UsuarioRolId: 2, Estado: true })).toBe(false);
  });

  it("rechaza al administrador deshabilitado", () => {
    expect(puedeIngresar({ ...admin, Estado: false })).toBe(false);
  });

  it("no toma NULL como habilitado", () => {
    // `Estado`, `IDLocal` y `UsuarioRolId` son nullable en la tabla.
    expect(puedeIngresar({ ...admin, Estado: null })).toBe(false);
    expect(puedeIngresar({ ...admin, Estado: undefined })).toBe(false);
    expect(puedeIngresar({ IDLocal: null, UsuarioRolId: 1, Estado: true })).toBe(false);
    expect(puedeIngresar({ IDLocal: 1, UsuarioRolId: null, Estado: true })).toBe(false);
  });

  it("no confunde el id de rol con otro número parecido", () => {
    expect(puedeIngresar({ IDLocal: 1, UsuarioRolId: 10, Estado: true })).toBe(false);
  });

  it("usa la sucursal 1 y el rol 1 como los únicos valores válidos", () => {
    expect(ID_LOCAL_IMPLICITO).toBe(1);
    expect(ROL_ADMINISTRADOR).toBe(1);
  });
});

describe("esAdminDeVentanas — el control por request del layout", () => {
  it("no mira Estado: la sesión ya existe y el estado se validó al ingresar", () => {
    expect(esAdminDeVentanas({ IDLocal: 1, UsuarioRolId: 1 })).toBe(true);
  });

  it("rebota igual si el token trae la sucursal o el rol equivocados", () => {
    expect(esAdminDeVentanas({ IDLocal: 3, UsuarioRolId: 1 })).toBe(false);
    expect(esAdminDeVentanas({ IDLocal: 1, UsuarioRolId: 2 })).toBe(false);
    expect(esAdminDeVentanas({ IDLocal: null, UsuarioRolId: null })).toBe(false);
  });
});
