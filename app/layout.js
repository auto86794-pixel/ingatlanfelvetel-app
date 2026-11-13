import "./globals.css";
export const metadata = { title: "Ingatlanfelvétel", description: "Digitális ingatlanfelvételi adatlap, fotók és aláírás.", manifest: "/manifest.webmanifest", icons: { icon: "/icon.svg", apple: "/icon-192.png" }, appleWebApp: { capable: true, title: "Ingatlanfelvétel", statusBarStyle: "default" } };
export const viewport = { width: "device-width", initialScale: 1, themeColor: "#164d38" };
export default function RootLayout({ children }) { return <html lang="hu"><body>{children}</body></html>; }
