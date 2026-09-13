"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaListCheck } from "react-icons/fa6";
import { TbScan } from "react-icons/tb";

const items = [
  { name: "Scan", href: "/participant", icon: TbScan },
  { name: "Results", href: "/participant/results", icon: FaListCheck },
];

export default function FooterNav() {
  const pathname = usePathname();
  return (
    <footer className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 shadow-[0_-8px_30px_rgba(15,23,42,.08)] backdrop-blur-md">
      <nav className="mx-auto grid h-16 max-w-md grid-cols-2 px-3" aria-label="Participant navigation">
        {items.map((item) => {
          const active = item.href === "/participant" ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-semibold transition-colors ${active ? "text-primary-700" : "text-gray-500 hover:text-primary-600"}`}><Icon className="text-xl" /><span>{item.name}</span></Link>;
        })}
      </nav>
    </footer>
  );
}
