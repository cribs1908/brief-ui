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
			/>
		</div>
	);
}