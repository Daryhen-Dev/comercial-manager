"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import styles from "../login.module.css";

const loginSchema = z.object({
  usuario: z.string().min(1, "Ingresá tu usuario."),
  clave: z.string().min(1, "Ingresá tu contraseña."),
});

type LoginValues = z.infer<typeof loginSchema>;

type FrameState = "idle" | "submitting" | "granted";

type ErrorCopy = { title: string; hint: string };

const CREDENTIALS_ERROR: ErrorCopy = {
  title: "Usuario o contraseña incorrectos",
  hint: "Verificá los datos. Si tu usuario pertenece a otra sucursal, no puede ingresar acá.",
};

const FORBIDDEN_ERROR: ErrorCopy = {
  title: "Acceso restringido",
  hint: "Tu cuenta no tiene permisos de administrador para este sistema.",
};

/**
 * Only same-origin, app-internal paths are safe to navigate to after login:
 * they must start with a single `/` and must not be protocol-relative (`//`).
 */
function isSafeInternalPath(path: string | undefined): path is string {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//");
}

export function LoginScreen({
  callbackUrl,
  errorParam,
}: {
  callbackUrl?: string;
  errorParam?: string;
}) {
  const router = useRouter();
  const [frameState, setFrameState] = useState<FrameState>("idle");
  const [error, setError] = useState<ErrorCopy | null>(
    errorParam === "forbidden"
      ? FORBIDDEN_ERROR
      : errorParam
        ? CREDENTIALS_ERROR
        : null,
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { usuario: "", clave: "" },
  });

  const onSubmit = async (values: LoginValues) => {
    setError(null);
    setFrameState("submitting");

    const destination = isSafeInternalPath(callbackUrl) ? callbackUrl : "/";

    try {
      const result = await signIn("credentials", {
        usuario: values.usuario,
        clave: values.clave,
        redirect: false,
        redirectTo: destination,
      });

      if (result?.ok) {
        // The ring closes into a circumference before the door opens. This is
        // the surface's one authored moment, so it is allowed to be seen.
        setFrameState("granted");
        await new Promise((resolve) => setTimeout(resolve, 280));
        router.push(destination);
        router.refresh();
        return;
      }

      setFrameState("idle");
      setError(CREDENTIALS_ERROR);
    } catch {
      setFrameState("idle");
      setError({
        title: "No se pudo iniciar sesión",
        hint: "Hubo un problema de conexión. Intentá de nuevo.",
      });
    }
  };

  return (
    <main className={styles.screen}>
      <div className={styles.frame} data-state={frameState}>
        <div className={styles.inner}>
          <header className={styles.header}>
            <h1 className={styles.wordmark}>Comercial Manager</h1>
            <p className={styles.subtitle}>Solo administradores.</p>
          </header>

          <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
            {error ? (
              <div className={styles.alert} role="alert">
                <p className={styles.alertTitle}>{error.title}</p>
                <p className={styles.alertHint}>{error.hint}</p>
              </div>
            ) : null}

            <div className={styles.field}>
              <label className={styles.label} htmlFor="login-usuario">
                Usuario
              </label>
              <input
                {...register("usuario")}
                id="login-usuario"
                className={styles.input}
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                aria-invalid={errors.usuario ? true : undefined}
                aria-describedby={errors.usuario ? "login-usuario-error" : undefined}
              />
              {errors.usuario ? (
                <p id="login-usuario-error" className={styles.fieldError} role="alert">
                  {errors.usuario.message}
                </p>
              ) : null}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="login-clave">
                Contraseña
              </label>
              <input
                {...register("clave")}
                id="login-clave"
                className={styles.input}
                type="password"
                autoComplete="current-password"
                enterKeyHint="go"
                aria-invalid={errors.clave ? true : undefined}
                aria-describedby={errors.clave ? "login-clave-error" : undefined}
              />
              {errors.clave ? (
                <p id="login-clave-error" className={styles.fieldError} role="alert">
                  {errors.clave.message}
                </p>
              ) : null}
            </div>

            <button
              type="submit"
              className={styles.submit}
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {frameState === "granted"
                ? "Entrando…"
                : isSubmitting
                  ? "Verificando…"
                  : "Ingresar"}
            </button>
          </form>

          <p className={styles.footer}>
            ¿Problemas para ingresar? Contactá al encargado del sistema.
          </p>
        </div>
      </div>
    </main>
  );
}
