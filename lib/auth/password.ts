import bcrypt from "bcryptjs";

const COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Kullanıcı bulunamadığında da benzer süre harcamak için (zamanlama saldırılarına karşı) */
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO5Qe9yS1kN9u8lYv5bKqg0vXQm4xH6e2";
export async function verifyAgainstDummy(plain: string): Promise<void> {
  await bcrypt.compare(plain, DUMMY_HASH);
}
