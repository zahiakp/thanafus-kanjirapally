import Image from "next/image";
import React from "react";
import { brandLogo, brandName } from "../data/branding";
import FooterNav from "./FooterNav";

export const metadata = {
  title: `${brandName} Participant Portal`,
  description: "Competition participant profiles and published results",
};

export default function ParticipantLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-gradient-to-br from-primary-50 via-white to-slate-50">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-center gap-3 px-3 sm:h-20 sm:px-6">
          <Image src={brandLogo} alt={`${brandName} logo`} width={52} height={52} priority unoptimized className="h-10 w-10 object-contain sm:h-12 sm:w-12" />
          <div className="min-w-0"><h1 className="truncate text-base font-bold text-gray-900 sm:text-xl">{brandName}</h1><p className="text-xs text-gray-500 sm:text-sm">Participant portal</p></div>
        </div>
      </header>
      <main className="min-h-[calc(100dvh-4rem)] pb-20 sm:min-h-[calc(100dvh-5rem)]">{children}</main>
      <FooterNav />
    </div>
  );
}
