import type { ReactNode } from "react";
import { Lilita_One } from "next/font/google";

const fontBacDisplay = Lilita_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bac-display",
  display: "swap",
});

export default function RutaBacLayout({ children }: { children: ReactNode }) {
  return <div className={fontBacDisplay.variable}>{children}</div>;
}
