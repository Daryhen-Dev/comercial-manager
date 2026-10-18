"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// The branch is implicit in this system, so the user only provides credentials.
const loginFormSchema = z.object({
  usuario: z.string().min(1, "Ingresá tu usuario."),
  clave: z.string().min(1, "Ingresá tu contraseña."),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

/**
 * Only same-origin, app-internal paths are safe to navigate to after login:
 * they must start with a single `/` and must not be protocol-relative (`//`).
 */
function isSafeInternalPath(path: string | undefined): path is string {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//");
}

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      usuario: "",
      clave: "",
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitError(null);

    try {
      const result = await signIn("credentials", {
        usuario: values.usuario,
        clave: values.clave,
        redirect: false,
        redirectTo: isSafeInternalPath(callbackUrl) ? callbackUrl : "/",
      });

      if (result?.ok) {
        router.push(isSafeInternalPath(callbackUrl) ? callbackUrl : "/");
        router.refresh();
        return;
      }

      setSubmitError(
        "Usuario o contraseña incorrectos. Verificá los datos e intentá de nuevo.",
      );
    } catch {
      setSubmitError("Ocurrió un error al iniciar sesión. Intentá de nuevo.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="login-usuario">Usuario</Label>
        <Input
          id="login-usuario"
          type="text"
          autoComplete="username"
          autoFocus
          aria-invalid={errors.usuario ? true : undefined}
          {...register("usuario")}
        />
        {errors.usuario ? (
          <p className="text-sm text-destructive">{errors.usuario.message}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="login-clave">Contraseña</Label>
        <Input
          id="login-clave"
          type="password"
          autoComplete="current-password"
          aria-invalid={errors.clave ? true : undefined}
          {...register("clave")}
        />
        {errors.clave ? (
          <p className="text-sm text-destructive">{errors.clave.message}</p>
        ) : null}
      </div>

      {submitError ? (
        <p role="alert" className="text-sm text-destructive">
          {submitError}
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Ingresando…" : "Ingresar"}
      </Button>
    </form>
  );
}
