import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/contexts/AppContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ConfirmModalProvider } from "@/contexts/ConfirmModalContext";

export const metadata: Metadata = {
  title: "Powertec - Task Management",
  description: "task and project management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          <AppProvider>
            <ConfirmModalProvider>
              {children}
            </ConfirmModalProvider>
          </AppProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
