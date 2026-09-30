import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Examee",
  description: "AI-assisted exam answer sheet digitization and evaluation."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas font-sans text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
