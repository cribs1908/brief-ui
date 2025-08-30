"use client";

import Lottie from "lottie-react";
import animationData from "../../public/JSON.json";

interface LottieBackgroundProps {
  className?: string;
}

export default function LottieBackground({ className = "" }: LottieBackgroundProps) {
  return (
    <div className={`fixed inset-0 w-full h-full -z-10 ${className}`}>
      <Lottie
        animationData={animationData}
        loop={true}
        autoplay={true}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover"
        }}
        rendererSettings={{
          preserveAspectRatio: "xMidYMid slice"
        }}
      />
    </div>
  );
}