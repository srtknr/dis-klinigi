const TR_MAP: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  i̇: "i",
  ö: "o",
  ş: "s",
  ü: "u",
  â: "a",
  î: "i",
  û: "u",
};

/** Arama için: küçük harf, Türkçe karakter sadeleştirme, tek boşluk */
export function normalizeSearch(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşüâîû]|i̇/g, (ch) => TR_MAP[ch] ?? ch)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(value: string): string {
  return normalizeSearch(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function fullName(first: string, last: string): string {
  return `${first} ${last}`.trim();
}

export function dentistName(d: { title: string; firstName: string; lastName: string }): string {
  return `${d.title} ${d.firstName} ${d.lastName}`.trim();
}

/** "Ayşe" → "Ayşe", "aYŞE" → "Ayşe" (Türkçe büyük/küçük harf kurallarıyla) */
export function titleCaseTr(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((part) =>
      part ? part.charAt(0).toLocaleUpperCase("tr-TR") + part.slice(1).toLocaleLowerCase("tr-TR") : part,
    )
    .join(" ");
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toLocaleUpperCase("tr-TR"))
    .join("");
}
