"use client";
import { SignUp } from "@clerk/nextjs";
import LottieBackground from "../../../components/LottieBackground";

export default function Page() {
	return (
		<div className="min-h-screen w-full relative flex items-center justify-center">
			<LottieBackground />
			<SignUp 
				routing="path" 
				path="/sign-up" 
				signInUrl="/sign-in"
				afterSignOutUrl="https://trybriefai.com"
			/>
		</div>
	);
}