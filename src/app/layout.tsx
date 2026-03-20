import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Observatory — Lachlan Sear",
  description:
    "A live solar system mapping 47 companies across vertical AI, horizontal AI, infrastructure, and deep tech. Built by Lachlan Sear.",
  openGraph: {
    title: "The Observatory — Lachlan Sear",
    description:
      "A live solar system mapping 47 companies across vertical AI, horizontal AI, infrastructure, and deep tech.",
    url: "https://observatory.lachlansear.com",
    siteName: "The Observatory",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Observatory — Lachlan Sear",
    description:
      "A live solar system mapping 47 companies across vertical AI, horizontal AI, infrastructure, and deep tech.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
