import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Celik Minda PASTI | Bahan Ulang Kaji",
  description: "PDF dan hardcopy Ulang Kaji Celik Minda PASTI. Set A 6 tahun, Set B 5 tahun dan combo.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ms"><body>{children}</body></html>;
}
