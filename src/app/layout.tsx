import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Observatory",
  description:
    "A live map of the companies in an investment thesis, checked against source every week. Reference instance: Permission to operate — regulated vertical AI, defence, robotics and AI assurance.",
  openGraph: {
    title: "The Observatory",
    description: "A thesis map that keeps itself current. Every change linked to the page that says so.",
    url: "https://observatory.lachlansear.com",
    siteName: "The Observatory",
    type: "website",
  },
};

export const viewport: Viewport = { themeColor: "#EEF1F5" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,300..600&family=Onest:wght@400;500;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
