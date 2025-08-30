"use client";

import { SignIn } from "@clerk/nextjs";
import LottieBackground from "./LottieBackground";

export default function CustomSignIn() {
  return (
    <div className="min-h-screen bg-[--background] px-6 py-6 relative">
      <LottieBackground className="opacity-20" />
      <div className="h-full rounded-[24px] bg-[#111]/80 backdrop-blur-sm border border-[#1f1f1f] flex items-center justify-center relative z-10">
        <div className="w-[740px] max-w-[92vw] flex justify-center">
          <div className="w-[420px]">
            <div className="panel rounded-[14px] card-shadow bg-[#161616] border border-[#2a2a2a] p-8">
              <SignIn 
                routing="hash"
                redirectUrl="/"
                appearance={{
                  baseTheme: undefined,
                  elements: {
                    rootBox: "w-full",
                    card: "!bg-transparent !border-0 !shadow-none !p-0",
                    headerTitle: "!text-[#C0C0C0] !font-mono !text-lg !font-medium !text-center !mb-2",
                    headerSubtitle: "!text-[#9A9A9A] !font-mono !text-sm !font-medium !text-center !mb-6",
                    socialButtonsBlockButton: "!w-full !h-12 !border !border-[#2a2a2a] !bg-transparent !text-[#C0C0C0] hover:!bg-[#1e1e1e] !rounded-[8px] !font-mono !text-sm !font-medium !transition-colors",
                    socialButtonsBlockButtonText: "!font-mono !text-sm !font-medium",
                    dividerLine: "!bg-[#2a2a2a]",
                    dividerText: "!text-[#9A9A9A] !font-mono !text-xs",
                    formFieldLabel: "!text-[#C0C0C0] !font-mono !text-sm !font-medium !mb-2",
                    formFieldInput: "!w-full !h-12 !bg-[#0d0d0d] !border !border-[#2a2a2a] !text-[#C0C0C0] !rounded-[8px] !px-3 !font-mono !text-[15px] !tracking-[0.01em] focus:!border-[#3a3a3a] !outline-none",
                    formButtonPrimary: "!w-full !h-12 !bg-[#d9d9d9] !text-[#000000] hover:!bg-[#c0c0c0] !rounded-[8px] !font-mono !font-medium !transition-colors",
                    footerActionLink: "!text-[#C0C0C0] hover:!text-[#9A9A9A] !font-mono !text-sm !font-medium !underline",
                    footerActionText: "!text-[#9A9A9A] !font-mono !text-sm !font-medium",
                    identityPreviewText: "!text-[#C0C0C0] !font-mono !text-sm !font-medium",
                    formFieldWarningText: "!text-red-400 !font-mono !text-xs !mt-1",
                    alert: "!bg-[#2a1a1a] !border !border-red-800 !text-red-400 !rounded-[8px] !p-3 !font-mono !text-sm",
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
                    fontFamily: "var(--font-geist-mono)"
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}