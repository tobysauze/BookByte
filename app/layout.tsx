import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { Navbar } from "@/components/navbar";
import { ClientThemeProvider } from "@/components/theme-provider";
import { getSessionUser } from "@/lib/auth";
import { TextPreferencesProvider } from "@/lib/text-preferences-context";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://bookbyte.app"),
  title: {
    default: "BookByte — AI-Powered Book Summaries",
    template: "%s | BookByte",
  },
  description:
    "BookByte turns your books and PDFs into structured summaries, actionable insights, and audio recaps powered by AI.",
  openGraph: {
    title: "BookByte — AI-Powered Book Summaries",
    description:
      "Upload books or PDFs and get quick summaries, key ideas, and audio recaps with BookByte.",
    url: "https://bookbyte.app",
    siteName: "BookByte",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BookByte — AI-Powered Book Summaries",
    description:
      "Generate AI summaries, key ideas, chapters, insights, and audio for your books with BookByte.",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getSessionUser();

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-[rgb(var(--background))] text-[rgb(var(--foreground))] antialiased`}
      >
        <ClientThemeProvider>
          <TextPreferencesProvider>
            <Navbar initialUser={user} />
            <main className="px-4 pb-16 pt-24 sm:px-6 lg:px-10">
              <div className="mx-auto w-full max-w-6xl">{children}</div>
            </main>
            <Toaster />
          </TextPreferencesProvider>
        </ClientThemeProvider>
      </body>
    </html>
  );
}
