import type { Metadata } from "next";
import { Bricolage_Grotesque, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-body",
  display: "swap",
});

const jbMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://cartograf.dev";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: "cartograf",
  description: "Map the services and libraries detected in your JavaScript stack.",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  openGraph: {
    title: "cartograf",
    description: "Map the services and libraries detected in your JavaScript stack.",
    url: APP_URL,
    siteName: "cartograf",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "cartograf" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "cartograf",
    description: "Map the services and libraries detected in your JavaScript stack.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`antialiased ${bricolage.variable} ${sourceSerif.variable} ${jbMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
