/**
 * Basit yapılandırılmış logger. Hasta adı, telefon, e-posta, klinik not gibi
 * hassas veriler log'a yazılmamalıdır; yalnızca kimlikler (id) ve teknik bilgiler kullanılır.
 */
type Meta = Record<string, unknown>;

function serializeError(error: unknown): Meta {
  if (error instanceof Error) {
    return { errorName: error.name, errorMessage: redact(error.message) };
  }
  return { error: redact(String(error)) };
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /\+?\d[\d\s-]{8,}\d/g;

export function redact(text: string): string {
  return text.replace(EMAIL_RE, "[e-posta]").replace(PHONE_RE, "[telefon]");
}

function write(level: "info" | "warn" | "error", event: string, meta?: unknown) {
  if (process.env.NODE_ENV === "test" && level === "info") return;
  const payload =
    meta instanceof Error || (meta !== undefined && typeof meta !== "object")
      ? serializeError(meta)
      : (meta as Meta | undefined);
  const line = JSON.stringify({ level, event, time: new Date().toISOString(), ...payload });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const logger = {
  info: (event: string, meta?: Meta) => write("info", event, meta),
  warn: (event: string, meta?: unknown) => write("warn", event, meta),
  error: (event: string, error?: unknown) => write("error", event, error),
};
