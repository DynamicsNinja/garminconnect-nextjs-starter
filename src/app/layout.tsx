import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Garmin sleep & HRV",
  description: "A starter dashboard for garminconnect-js: sign in to Garmin Connect, chart sleep and HRV.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
