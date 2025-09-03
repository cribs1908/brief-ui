"use client";
import { SignIn } from "@clerk/nextjs";
import LottieBackground from "../../../components/LottieBackground";

export default function Page() {
	return (
		<div className="min-h-screen w-full relative flex items-center justify-center">
			<LottieBackground />
			<SignIn 
				routing="path" 
				path="/sign-in" 
				signUpUrl="/sign-up"
				afterSignOutUrl="https://trybriefai.com"
				appearance={{
					elements: {
						card: "bg-black border border-gray-800",
						headerTitle: "!text-white font-mono",
						headerSubtitle: "!text-gray-400 font-mono",
						socialButtonsBlockButton: "bg-gray-900 border-gray-700 !text-white hover:bg-gray-800 font-mono",
						formFieldLabel: "!text-white font-mono",
						formFieldInput: "bg-gray-900 border-gray-700 !text-white font-mono focus:border-gray-600",
						formButtonPrimary: "bg-white !text-black hover:bg-gray-200 font-mono",
						footerActionLink: "!text-white font-mono hover:!text-gray-300",
						footerActionText: "!text-gray-400 font-mono",
						identityPreviewText: "!text-white font-mono",
						formFieldWarningText: "!text-red-400 font-mono",
						formFieldSuccessText: "!text-green-400 font-mono",
						alert: "bg-red-900 border-red-800 !text-red-300 font-mono",
						dividerText: "!text-gray-400 font-mono",
						dividerLine: "bg-gray-700"
					},
					variables: {
						fontFamily: "var(--font-geist-mono)",
						colorBackground: "#000000",
						colorText: "#ffffff",
						colorTextSecondary: "#9ca3af",
						colorInputBackground: "#111827",
						colorInputText: "#ffffff",
						colorPrimary: "#000000",
						colorDanger: "#ef4444",
						colorSuccess: "#22c55e"
					}
				}}
			/>
		</div>
	);
}