"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { FormError, FormRow } from "@/components/forms/form-row";
import { ActionDialog } from "@/components/shared/action-dialog";
import {
  createStaffAction,
  removeStaffAccessAction,
  resetStaffPasswordAction,
  updateStaffAction,
} from "@/features/staff/actions";
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  ROLE_LABELS,
  type PermissionKey,
  type RoleKey,
} from "@/lib/permissions";

const ROLES: RoleKey[] = ["OWNER", "DENTIST", "EDITOR"];

export function StaffForm({
  membershipId,
  dentists,
  isSelf,
  initial,
}: {
  membershipId?: string;
  dentists: { id: string; name: string }[];
  isSelf?: boolean;
  initial: {
    name: string;
    email: string;
    role: RoleKey;
    permissions: PermissionKey[];
    isActive: boolean;
    dentistProfileId: string;
  };
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<RoleKey>(initial.role);
  const [permissions, setPermissions] = useState<PermissionKey[]>(initial.permissions);
  const [isActive, setIsActive] = useState(initial.isActive);
  const [dentistProfileId, setDentistProfileId] = useState(initial.dentistProfileId);
  const [newPassword, setNewPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const shownPerms = useMemo(
    () => (role === "OWNER" ? [] : permissions.length ? permissions : DEFAULT_ROLE_PERMISSIONS[role]),
    [role, permissions],
  );

  const toggle = (p: PermissionKey, on: boolean) => {
    setPermissions((prev) => {
      const base = prev.length ? prev : DEFAULT_ROLE_PERMISSIONS[role];
      return on ? Array.from(new Set([...base, p])) : base.filter((x) => x !== p);
    });
  };

  return (
    <form
      className="max-w-2xl space-y-4 rounded-xl border bg-card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setFormError(null);
        startTransition(async () => {
          const result = membershipId
            ? await updateStaffAction({ membershipId, name, role, permissions: shownPerms, isActive, dentistProfileId: dentistProfileId || undefined })
            : await createStaffAction({ name, email, password, role, permissions: shownPerms, dentistProfileId: dentistProfileId || undefined });
          if (result.ok) {
            toast.success(result.message ?? "Kaydedildi.");
            router.push(membershipId ? `/admin/personel/${membershipId}` : `/admin/personel/${result.data.membershipId}`);
            router.refresh();
            return;
          }
          const fe: Record<string, string> = {};
          for (const [k, v] of Object.entries(result.fieldErrors ?? {})) fe[k] = v[0];
          setErrors(fe);
          setFormError(result.error);
          toast.error(result.error);
        });
      }}
    >
      <FormRow id="name" label="Ad soyad" required error={errors.name}>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
      </FormRow>
      <FormRow id="email" label="E-posta" required error={errors.email}>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={Boolean(membershipId)} />
      </FormRow>
      {!membershipId ? (
        <FormRow id="password" label="Şifre" required error={errors.password} description="En az 10 karakter, harf ve rakam.">
          <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </FormRow>
      ) : null}
      <FormRow id="role" label="Rol">
        <NativeSelect
          id="role"
          value={role}
          onChange={(e) => {
            const next = e.target.value as RoleKey;
            setRole(next);
            setPermissions(DEFAULT_ROLE_PERMISSIONS[next]);
          }}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </NativeSelect>
      </FormRow>
      <FormRow id="dentistProfileId" label="Bağlı hekim profili">
        <NativeSelect id="dentistProfileId" value={dentistProfileId} onChange={(e) => setDentistProfileId(e.target.value)}>
          <option value="">Yok</option>
          {dentists.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </NativeSelect>
      </FormRow>
      {membershipId ? (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={isActive} disabled={isSelf} onCheckedChange={(v) => setIsActive(v === true)} />
          Aktif erişim
        </label>
      ) : null}

      {role !== "OWNER" ? (
        <fieldset className="space-y-4 rounded-lg border p-4">
          <legend className="px-1 text-sm font-medium">İzinler</legend>
          {PERMISSION_GROUPS.map((g) => (
            <div key={g.title}>
              <p className="mb-2 text-xs text-muted-foreground">{g.title}</p>
              <ul className="space-y-2">
                {g.permissions.map((p) => (
                  <li key={p}>
                    <label className="flex items-start gap-2 text-sm">
                      <Checkbox checked={shownPerms.includes(p)} onCheckedChange={(v) => toggle(p, v === true)} className="mt-0.5" />
                      {PERMISSION_LABELS[p]}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </fieldset>
      ) : (
        <p className="text-sm text-muted-foreground">Klinik sahibi tüm yetkilere sahiptir.</p>
      )}

      <FormError message={formError} />
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Kaydet
      </Button>

      {membershipId ? (
        <div className="space-y-4 border-t pt-4">
          <FormRow id="newPassword" label="Şifre sıfırla" description="Açık oturumlar kapatılır.">
            <div className="flex gap-2">
              <Input id="newPassword" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <Button
                type="button"
                variant="outline"
                disabled={pending || newPassword.length < 10}
                onClick={() =>
                  startTransition(async () => {
                    const result = await resetStaffPasswordAction({ membershipId, password: newPassword });
                    if (result.ok) {
                      toast.success(result.message);
                      setNewPassword("");
                    } else toast.error(result.error);
                  })
                }
              >
                Sıfırla
              </Button>
            </div>
          </FormRow>
          {!isSelf ? (
            <ActionDialog
              trigger={
                <Button type="button" variant="destructive">
                  Erişimi kaldır
                </Button>
              }
              title="Klinik erişimini kaldır"
              description="Üyelik silinir; geçmiş randevu ve denetim kayıtları korunur."
              confirmLabel="Kaldır"
              destructive
              onConfirm={async () => {
                const result = await removeStaffAccessAction(membershipId);
                if (result.ok) router.push("/admin/personel");
                return result;
              }}
            />
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
