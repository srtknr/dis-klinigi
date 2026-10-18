import { notFound } from "next/navigation";
import { AppError } from "@/lib/errors";

/** Servis NOT_FOUND fırlatırsa Next.js 404 sayfasına düşer. */
export async function loadOrNotFound<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}
