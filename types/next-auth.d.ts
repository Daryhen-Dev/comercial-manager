import type { DefaultSession } from "next-auth";

// Every augmented field is optional and nullable because every backing column
// in the SQL Server `Usuario` / `Local` tables is nullable.

declare module "next-auth" {
  interface Session {
    user: {
      IDUsuario?: number | null;
      IDLocal?: number | null;
      UsuarioRolId?: number | null;
      RolUsuario?: string | null;
      NombreUsuario?: string | null;
      Local?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    IDUsuario?: number | null;
    IDLocal?: number | null;
    UsuarioRolId?: number | null;
    RolUsuario?: string | null;
    NombreUsuario?: string | null;
    Local?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    IDUsuario?: number | null;
    IDLocal?: number | null;
    UsuarioRolId?: number | null;
    RolUsuario?: string | null;
    NombreUsuario?: string | null;
    Local?: string | null;
  }
}

// NOTE: next-auth 5.0.0-beta.32 re-exports the canonical JWT as
// `export * from "@auth/core/jwt"`. TypeScript module augmentation does not
// merge through a star re-export, and with pnpm `@auth/core` is not resolvable
// from the project root, so the token received inside the auth callbacks keeps
// an `unknown` index signature. The fields above make the augmented `JWT`
// importable from "next-auth/jwt" for downstream code; the `session` callback
// in `auth.ts` narrows the token values explicitly instead of casting.
