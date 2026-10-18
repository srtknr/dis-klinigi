"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormError, FormRow, describedBy } from "@/components/forms/form-row";
import { loginAction } from "@/features/auth/actions";
import { loginSchema, type LoginInput } from "@/lib/validations/staff";

export function LoginForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const errors = formState.errors;

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await loginAction(values);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace("/admin");
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
      <FormRow id="email" label="E-posta" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          autoFocus
          aria-invalid={!!errors.email}
          aria-describedby={describedBy("email", { error: errors.email?.message })}
          {...register("email", { setValueAs: (v: string) => v.trim() })}
        />
      </FormRow>
      <FormRow id="password" label="Şifre" error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          aria-describedby={describedBy("password", { error: errors.password?.message })}
          {...register("password")}
        />
      </FormRow>
      <FormError message={error} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <LogIn aria-hidden />}
        Giriş yap
      </Button>
    </form>
  );
}
