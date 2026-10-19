import { z } from "zod";

export const whatsappConfigSchema = z.object({
  phoneNumberId: z.string().trim().regex(/^\d{5,32}$/, "Telefon numarası kimliği yalnızca rakamlardan oluşur (Meta panelinde \"Phone number ID\")."),
  wabaId: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{5,32}$/.test(v), "WhatsApp Business hesap kimliği yalnızca rakamlardan oluşur.")
    .optional(),
  /** Boş bırakılırsa mevcut token korunur (ilk kurulumda zorunludur) */
  accessToken: z.string().trim().max(1000).optional(),
  templateName: z.string().trim().regex(/^[a-z0-9_]{1,512}$/, "Şablon adı yalnızca küçük harf, rakam ve alt çizgi içerebilir."),
  templateLanguage: z.string().trim().regex(/^[a-z]{2}(_[A-Z]{2})?$/, "Dil kodu ör. tr veya en_US biçiminde olmalıdır."),
  isEnabled: z.boolean(),
});

export type WhatsappConfigInput = z.infer<typeof whatsappConfigSchema>;
