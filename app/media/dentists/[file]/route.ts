import { readFile } from "node:fs/promises";
import path from "node:path";
import { UPLOAD_ROOT } from "@/features/dentists/service";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Yüklenen doktor fotoğraflarını sunar. Dosya adı sıkı biçimde doğrulanır (dizin gezinme engeli). */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const match = /^[a-z0-9]+-[A-Za-z0-9_-]+\.(jpg|png|webp)$/.exec(file);
  if (!match) return new Response("Bulunamadı", { status: 404 });
  try {
    const data = await readFile(path.join(UPLOAD_ROOT, "dentists", file));
    return new Response(data, {
      headers: {
        "Content-Type": TYPES[match[1]!]!,
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Bulunamadı", { status: 404 });
  }
}
