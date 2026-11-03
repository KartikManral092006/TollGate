import type { Metadata, Viewport } from "next";
import { Overpass, Overpass_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

// Overpass derives from the US highway-sign typeface: the product is a toll gate, so its
// headlines read like road signs. Overpass Mono is only for real commands.
const overpass = Overpass({
  variable: "--font-overpass",
  subsets: ["latin"],
  display: "swap",
});

const overpassMono = Overpass_Mono({
  variable: "--font-overpass-mono",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1e21" },
  ],
};

export const metadata: Metadata = {
  title: "Tollgate",
  description: "Your team decides before your coding agent does something you can't undo.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Browser extensions add attributes to <html> before React hydrates; ignore those here.
    // This applies to this element's own attributes only, not to anything inside it.
    <html
      lang="en"
      className={`${overpass.variable} ${overpassMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
