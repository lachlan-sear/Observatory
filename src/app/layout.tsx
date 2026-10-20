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
    <html lang="en-GB" suppressHydrationWarning>
      <head>
        {/* Set the chosen look before first paint, so there is no flash of the wrong theme. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var q=new URLSearchParams(location.search).get("theme");var ok={paper:1,deepspace:1,discovery:1};var t=ok[q]?q:(localStorage.getItem("observatory-theme")||"${process.env.NEXT_PUBLIC_DEFAULT_THEME || "paper"}");if(!ok[t])t="paper";if(ok[q])localStorage.setItem("observatory-theme",q);document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme="${process.env.NEXT_PUBLIC_DEFAULT_THEME || "paper"}";}})();`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,300..600&family=Onest:wght@400;500;600&family=Jost:wght@300;400;500&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
