import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const body = Manrope({ variable: "--font-body", subsets: ["latin", "latin-ext"], display: "swap" });
const display = Fraunces({ variable: "--font-display", subsets: ["latin", "latin-ext"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Diş Kliniği", template: "%s | Diş Kliniği" },
  description: "Diş kliniği randevu ve hasta yönetim sistemi",
};

export const viewport: Viewport = { themeColor: "#faf7f2" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${body.variable} ${display.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
