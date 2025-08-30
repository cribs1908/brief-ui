"use client";
import { SignUp } from "@clerk/nextjs";
import LottieBackground from "../../../components/LottieBackground";

export default function Page() {
	return (
		<div className="min-h-screen w-full bg-transparent relative flex items-center justify-center p-6">
			<LottieBackground className="opacity-100" />
			<div className="w-full max-w-md relative z-10">
				<div className="bg-[#161616]/95 backdrop-blur-sm border border-[#2a2a2a] rounded-xl shadow-2xl mx-auto px-8 py-8">
					<SignUp 
						routing="path" 
						path="/sign-up" 
						signInUrl="/sign-in"
						afterSignOutUrl="https://trybriefai.com"
						appearance={{
							baseTheme: undefined,
							elements: {
								card: "!bg-transparent !border-0 !shadow-none !w-full !max-w-full !p-0",
								rootBox: "!w-full !max-w-full",
								headerTitle: "!text-[#C0C0C0] !font-mono !text-xl !font-medium !text-center !mb-4",
								headerSubtitle: "!text-[#9A9A9A] !font-mono !text-sm !font-medium !text-center !mb-6",
								socialButtonsBlockButton: "!w-full !h-12 !border !border-[#2a2a2a] !bg-transparent !text-[#C0C0C0] hover:!bg-[#1e1e1e] !rounded-[8px] !font-mono !text-sm !font-medium !transition-colors !mb-3 !box-border",
								socialButtonsBlockButtonText: "!font-mono !text-sm !font-medium",
								dividerLine: "!bg-[#2a2a2a] !my-4",
								dividerText: "!text-[#9A9A9A] !font-mono !text-xs",
								formFieldLabel: "!text-[#C0C0C0] !font-mono !text-sm !font-medium !mb-2 !block",
								formFieldInput: "!w-full !h-12 !bg-[#0d0d0d] !border !border-[#2a2a2a] !text-[#C0C0C0] !rounded-[8px] !px-3 !font-mono !text-[15px] focus:!border-[#3a3a3a] !outline-none !box-border",
								formButtonPrimary: "!w-full !h-12 !bg-[#d9d9d9] !text-[#000000] hover:!bg-[#c0c0c0] !rounded-[8px] !font-mono !font-medium !transition-colors !mt-6 !box-border",
								formFieldRow: "!w-full !mb-4 !box-border",
								footer: "!w-full !text-center !mt-6",
								footerActionLink: "!text-[#C0C0C0] hover:!text-[#9A9A9A] !font-mono !text-sm !font-medium !underline",
								footerActionText: "!text-[#9A9A9A] !font-mono !text-sm !font-medium",
								alert: "!bg-[#2a1a1a] !border !border-red-800 !text-red-400 !rounded-[8px] !p-3 !font-mono !text-sm !mb-4 !w-full !box-border",
								formFieldWarningText: "!text-red-400 !font-mono !text-xs !mt-1",
								formFieldSuccessText: "!text-green-400 !font-mono !text-xs !mt-1",
								formFieldInfoText: "!text-[#9A9A9A] !font-mono !text-xs !mt-1",
								devModeNotice: "!hidden"
							},
							variables: {
								colorBackground: "#161616",
								colorText: "#C0C0C0",
								colorTextSecondary: "#9A9A9A",
								colorInputBackground: "#0d0d0d",
								colorInputText: "#C0C0C0",
								colorPrimary: "#d9d9d9",
								colorDanger: "#ef4444",
								colorSuccess: "#22c55e",
								borderRadius: "8px",
								fontFamily: "var(--font-geist-mono)",
								spacingUnit: "0.5rem"
							}
						}}
					/>
				</div>
			</div>
		</div>
	);
}