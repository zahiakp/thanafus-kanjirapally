'use client';
import { useEffect, useState } from "react";
import { Drawer } from "antd";
import Logout from "./Logout";
import { useCookies } from "react-cookie";
import IconMenuDashboard from "../icon/menu/icon-menu-dashboard";
import IconMenuDatatables from "../icon/menu/icon-menu-datatables";
import IconUser from "../icon/icon-user";
import IconMenuComponents from "../icon/menu/icon-menu-components";
import IconMenuForms from "../icon/menu/icon-menu-forms";
import IconAirplay from "../icon/icon-airplay";
import {IconPlayCircle,  IconCertificate, IconResutAtom } from "../icon/icon-play-circle";
import { usePathname } from "next/navigation";
import FooterSide from "./TopHeader";
import Image from "next/image";
import { TbLogout } from "react-icons/tb";
import { MdClose, MdGavel, MdMenu, MdMoreHoriz } from "react-icons/md";
import { accessCookieName, brandLogo, brandName } from "../../app/data/branding";
import IconSettings from "../icon/icon-settings";
import IconAction from "./IconAction";

const SideMenu = () => {
  const pathname = usePathname();
  const [logOut, setLogOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cookies, setCookie] = useCookies([accessCookieName]);
  const cookieRole = cookies[accessCookieName]?.role as string | undefined;
  const [role, setRole] = useState<string | undefined>(cookieRole);

  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) setMobileOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (cookieRole) {
      setRole(cookieRole);
      return;
    }

    const controller = new AbortController();

    const recoverSession = async () => {
      try {
        const response = await fetch("/api/session", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (response.status === 401) {
          window.location.replace("/login");
          return;
        }

        const result = await response.json();
        if (!response.ok || !result?.success || !result?.data?.role) {
          throw new Error(result?.message || "Unable to restore the dashboard session.");
        }

        setRole(result.data.role);
        setCookie(accessCookieName, result.data, {
          path: "/",
          maxAge: result.maxAge,
          sameSite: "strict",
          secure: window.location.protocol === "https:",
        });
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Unable to restore dashboard session", error);
        }
      }
    };

    void recoverSession();
    return () => controller.abort();
  }, [cookieRole, setCookie]);

  const menuItems = [
    {
      path: "/",
      label: "Dashbord",
      icon: <IconMenuDashboard />,
      adminOnly: true,
    },
    {
      path: "/campus",
      label:"Teams",
      icon: <IconMenuComponents />,
      adminOnly: true,
    },
    
    {
      path: "/students",
      label: "Participants",
      icon: <IconUser fill={true}/>,
      campusOnly: true,
    },
    {
      path: "/programs",
      label: "Programs",
      icon: <IconMenuDatatables />,
      adminOnly: true,
      campusOnly: true,
    },
    { path: "/schedule", label: "Schedule", icon: <IconMenuForms />, adminOnly: true, regOnly: true, judgeOnly: true },
    { path: "/venues", label: "Venues", icon: <IconMenuDatatables />, adminOnly: true },
    // {
    //   path: "/topics",
    //   label: "Topics",
    //   icon: <IconMenuNotes />,
    //   adminOnly: true,
    //   // zoneAdmin:true,
    //   judgeOnly: true,
    // },
    {
      path: "/manage",
      label: "Manage",
      icon: <IconMenuForms />,
      regOnly: true,
      adminOnly: true,
    },
    {
      path: "/judgement",
      label: "Judgement",
      icon: <IconResutAtom fill={true} />,
      adminOnly: true,
      judgeOnly: true,
    },
    {
      path: "/results",
      label: "Results",
      icon: <IconPlayCircle fill={true}/>,
      adminOnly: true,
      announceOnly: true,
    },
    {
      path: "/autoposter",
      label: "Published",
      icon: <IconAirplay fill={true} />,
      adminOnly: true,
      resultOnly: true,
    },
    {
      path: "/award",
      label: "Award",
      icon: <IconCertificate />,
      adminOnly: true,
      awardOnly: true,
      resultOnly: true,
    },
    {
      path: "/config/appeals",
      label: "Appeals",
      icon: <MdGavel />,
      campusOnly: true,
    },
    {
      path: "/config",
      label: "Config",
      icon: <IconSettings />,
      adminOnly: true,
    },
  ];

  const visibleItems = menuItems.filter(item =>
    (role === "admin" && item.adminOnly) ||
    (role === "campus" && item.campusOnly) ||
    (role === "judge" && item.judgeOnly) ||
    (role === "result" && item.resultOnly) ||
    (role === "announce" && item.announceOnly) ||
    (role === "report" && item.regOnly) ||
    (role === "award" && item.awardOnly)
  );
  const isActive = (path: string) => pathname === path || (path !== "/" && pathname.startsWith(path + "/"));
  const hasMore = visibleItems.length > 4;
  const quickLinks = hasMore ? visibleItems.slice(0, 3) : visibleItems;

  return (
    <>
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-gray-200 bg-white lg:flex">
        <div className="shrink-0 border-b border-gray-200 p-6">
          <div className="mt-5 select-none text-xl text-white flex flex-col items-center justify-center">
            <div className="h-28 w-28 bg-primary-50 rounded-full flex items-center justify-center">
              <Image alt={`${brandName} logo`} src={brandLogo || "/eventpro-logo.png"} width={90} height={90} priority unoptimized className="h-[90px] w-[90px] object-contain" />
            </div>
            <b className="text-3xl text-primary-800 mt-3">{brandName || "Event Pro"}</b>
            <p className="text-[12px] text-right text-zinc-500">eventpro v1.0</p>
          </div>
        </div>

        <nav aria-label="Dashboard navigation" className="min-h-0 flex-1 overflow-y-auto p-4 px-5">
          <ul className="space-y-2">
            {visibleItems.map(item => (
                <li key={item.path}>
                  <a
                    href={item.path}
                    aria-current={isActive(item.path) ? "page" : undefined}
                    className={`flex items-center px-4 py-[10px] ${
                      isActive(item.path)
                        ? "bg-primary-600 text-white"
                        : "hover:bg-gray-100"
                    } text-gray-700 rounded-lg transition-colors duration-200`}
                  >
                    <span className="w-fit">{item.icon && item.icon}</span>
                    <span className="ml-3 whitespace-nowrap">{item.label}</span>
                  </a>
                </li>
            ))}
          </ul>
        </nav>
        <FooterSide setLogOut={setLogOut} />
    </aside>

    <header className="fixed inset-x-0 top-0 z-30 flex h-[calc(4rem+env(safe-area-inset-top))] items-center gap-2 border-b bg-white px-3 pt-[env(safe-area-inset-top)] shadow-sm lg:hidden">
      <IconAction label="Open navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)} className="grid size-11 shrink-0 place-items-center rounded-lg text-2xl text-primary-700 hover:bg-primary-50"><MdMenu /></IconAction>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Image alt="" src={brandLogo || "/eventpro-logo.png"} width={38} height={38} priority unoptimized className="size-9 shrink-0 object-contain" />
        <b className="truncate text-base text-primary-800 sm:text-xl">{brandName || "Event Pro"}</b>
      </div>
      <IconAction label="Log out" onClick={() => setLogOut(true)} className="grid size-11 shrink-0 place-items-center rounded-lg bg-gray-100 text-xl text-gray-700"><TbLogout /></IconAction>
    </header>

    <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t bg-white pb-[env(safe-area-inset-bottom)] shadow-sm lg:hidden">
      {quickLinks.map(item => <a key={item.path} href={item.path} aria-current={isActive(item.path) ? "page" : undefined}
        className={`flex h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] ${isActive(item.path) ? "font-bold text-primary-700" : "text-gray-600"}`}>
        <span aria-hidden="true" className="text-xl">{item.icon}</span><span className="max-w-full truncate">{item.label}</span>
      </a>)}
      {hasMore && <button type="button" onClick={() => setMobileOpen(true)} aria-expanded={mobileOpen} className="flex h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] text-primary-700"><MdMoreHoriz aria-hidden="true" className="text-xl" />More</button>}
    </nav>

    <Drawer title="Navigation" placement="left" width="min(20rem, 90vw)" open={mobileOpen} onClose={() => setMobileOpen(false)} closable={false}
      styles={{ body: { padding: 12 } }} extra={<IconAction label="Close navigation" onClick={() => setMobileOpen(false)} className="grid size-11 place-items-center rounded-lg bg-gray-100 text-xl"><MdClose /></IconAction>}>
      <nav aria-label="All dashboard pages" className="space-y-1">
        {visibleItems.map(item => <a key={item.path} href={item.path} onClick={() => setMobileOpen(false)} aria-current={isActive(item.path) ? "page" : undefined}
          className={`flex min-h-12 items-center gap-3 rounded-lg px-3 py-2 ${isActive(item.path) ? "bg-primary-50 font-semibold text-primary-700" : "text-gray-700 hover:bg-gray-100"}`}>
          <span aria-hidden="true" className="shrink-0 text-xl">{item.icon}</span><span>{item.label}</span>
        </a>)}
      </nav>
    </Drawer>
    {logOut && <Logout close={() => setLogOut(false)} />}
  </>
  );
};

export default SideMenu;
