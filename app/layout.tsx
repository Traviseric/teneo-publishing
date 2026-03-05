import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Teneo Publishing",
  description: "AI agent content publishing API — pay per use via Lightning or Cashu",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
