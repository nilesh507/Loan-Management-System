import "./globals.css";
import type { Metadata } from "next";
import { AuthProvider } from "../components/auth";
export const metadata: Metadata = {
  title: "CreditSea | Loan Management",
  description: "A clear path from application to repayment",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
