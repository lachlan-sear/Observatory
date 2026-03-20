import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Observatory — Lachlan Sear",
  description:
    "Mapping vertical AI across regulated industries. A solar-system visualisation of deal flow data.",
  openGraph: {
    title: "The Observatory — Lachlan Sear",
    description:
      "Mapping vertical AI across regulated industries.",
    url: "https://observatory.lachlansear.com",
    siteName: "The Observatory",
    type: "website",
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
