import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "garminconnect-js — live demo",
  description: "A live demo of garminconnect-js: sign in to Garmin Connect and see your sleep and activities, with the library call behind each panel.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
