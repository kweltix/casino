import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "AI Agent — автосервисы",
  description: "Поиск компаний и подготовка персональных предложений сайтов",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
