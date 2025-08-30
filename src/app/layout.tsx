import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
	variable: "--font-instrument-serif",
	weight: "400",
	style: "italic",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Brief AI — Spec Comparison",
	description: "UI mock — chat + comparison table",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} antialiased bg-[--background] text-[--foreground]`}>
				<ClerkProvider
					signInUrl="/sign-in"
					signUpUrl="/sign-up"
					afterSignInUrl="/"
					afterSignUpUrl="/"
				>
					{children}
				</ClerkProvider>
			</body>
		</html>
	);
}
