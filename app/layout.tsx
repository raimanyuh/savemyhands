import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Theme color paints the mobile browser chrome bar (Safari iOS, Chrome
// Android) to match the app's charcoal background — no jarring white bar
// above the dark UI. `viewport` is the modern Next 16 home for this; the
// older `metadata.themeColor` is deprecated.
export const viewport: Viewport = {
  themeColor: "#171717",
};

// `metadataBase` is required for opengraph-image / twitter-image so the
// auto-generated `<meta property="og:image" content="...">` resolves to
// an absolute URL. Without it the unfurl shows nothing.
export const metadata: Metadata = {
  metadataBase: new URL("https://savemyhands.app"),
  title: {
    default: "savemyhands",
    template: "%s — savemyhands",
  },
  description: "Live poker hand recorder and replayer.",
  applicationName: "savemyhands",
  appleWebApp: {
    title: "savemyhands",
    capable: true,
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "savemyhands",
    description: "Live poker hand recorder and replayer.",
    url: "/",
    siteName: "savemyhands",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "savemyhands",
    description: "Live poker hand recorder and replayer.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
