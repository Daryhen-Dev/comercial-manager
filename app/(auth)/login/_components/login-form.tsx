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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Branch } from "@/lib/auth/locales";

const loginFormSchema = z.object({
  usuario: z.string("Ingresá tu usuario.").min(1, "Ingresá tu usuario."),
  clave: z.string("Ingresá tu contraseña.").min(1, "Ingresá tu contraseña."),
  idLocal: z.number("Seleccioná un local.").int("Seleccioná un local."),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

/**
 * Only same-origin, app-internal paths are safe to navigate to after login:
 * they must start with a single `/` and must not be protocol-relative (`//`).
 */
function isSafeInternalPath(path: string | undefined): path is string {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//");
}

export function LoginForm({
  branches,
  callbackUrl,
}: {
  branches: Branch[];
  callbackUrl?: string;
}) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      usuario: "",
      clave: "",
    },
  });

  const idLocal = watch("idLocal");
  const selectedBranch = branches.find((branch) => branch.idLocal === idLocal);

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitError(null);

    try {
      // `idLocal` is sent as a string: the credentials provider reads it from
      // the submitted credentials object as `credentials.idLocal` (string).
      const result = await signIn("credentials", {
        usuario: values.usuario,
        clave: values.clave,
        idLocal: String(values.idLocal),
        redirect: false,
        redirectTo: isSafeInternalPath(callbackUrl) ? callbackUrl : "/",
      });

      if (result?.ok) {
        router.push(isSafeInternalPath(callbackUrl) ? callbackUrl : "/");
        router.refresh();
        return;
      }

      setSubmitError(
        "Usuario, contraseña o local incorrectos. Verificá los datos e intentá de nuevo.",
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

      <div className="flex flex-col gap-2">
        <Label htmlFor="login-idlocal">Local</Label>
        <Select<number>
          value={idLocal ?? null}
          onValueChange={(value) => {
            if (value === null) return;
            setValue("idLocal", value, { shouldValidate: true, shouldDirty: true });
          }}
        >
          <SelectTrigger
            id="login-idlocal"
            className="w-full"
            aria-invalid={errors.idLocal ? true : undefined}
            disabled={branches.length === 0}
          >
            <SelectValue placeholder="Seleccioná un local">
              {selectedBranch?.nombre}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {branches.map((branch) => (
              <SelectItem key={branch.idLocal} value={branch.idLocal}>
                {branch.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.idLocal ? (
          <p className="text-sm text-destructive">{errors.idLocal.message}</p>
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
