export type FormOption = {
  value: string;
  label: string;
  /** Seçilirse diğer seçeneklerle birlikte seçilemez ("Hiçbiri", "İlaç kullanmıyorum") */
  exclusive?: boolean;
};

/** Başka bir alanın değerine bağlı görünürlük: tek seçimde eşitlik, çoklu seçimde içerme */
export type FormCondition = { field: string; includes: string };

type BaseField = {
  id: string;
  label: string;
  required?: boolean;
  showIf?: FormCondition;
  hint?: string;
};

export type FormField =
  | (BaseField & { type: "text" | "email" | "tel"; placeholder?: string; maxLength?: number })
  | (BaseField & { type: "textarea"; placeholder?: string; maxLength?: number })
  | (BaseField & { type: "number"; placeholder?: string; min: number; max: number; step?: number })
  | (BaseField & { type: "date"; kind: "birth" | "any" })
  | (BaseField & { type: "radio"; options: FormOption[] })
  | (BaseField & { type: "checkbox"; options: FormOption[] })
  /** Onay kutusu; required ise işaretlenmesi zorunludur */
  | (BaseField & { type: "consent" });

export type FormStep = { id: string; title: string; description?: string; fields: FormField[] };

export type FormDefinition = {
  key: string;
  title: string;
  steps: FormStep[];
};

export type FormAnswerValue = string | string[] | boolean;
export type FormAnswers = Record<string, FormAnswerValue>;
