import { useEffect, useState } from "react";
import { useCookies } from "react-cookie";
import { TbLogout } from "react-icons/tb";
import IconAction from "./IconAction";
import Logout from "./Logout";
import { accessCookieName, brandName, hexColor } from "../../app/data/branding";

function FooterSide({setLogOut}:{setLogOut:any}) {
  const [cookies] = useCookies([accessCookieName]);
  const [name, setName] = useState();
  const [role, setRole] = useState();
  const [list, setList] = useState(false);

  const [jamiaNo, setJamiaNo] = useState();
  useEffect(() => {
    setName(
      cookies[accessCookieName]?.role == "campus"
        ? cookies[accessCookieName]?.name
        : cookies[accessCookieName]?.role == "admin"
        ? cookies[accessCookieName]?.username
        : cookies[accessCookieName]?.role == "report"
        ? "Reporting Point"
        : cookies[accessCookieName]?.role == "judge"
        ? "Judgement"
        : cookies[accessCookieName]?.role == "announce" && "Announcement"
    );
    setJamiaNo(cookies[accessCookieName]?.jamiaNo);
    setRole(cookies[accessCookieName]?.role);
  }, []);
  return (
    <div className="shrink-0 border-t border-gray-200 bg-white p-4">
        <div className="flex items-center space-x-3">
          <img src={`https://api.dicebear.com/10.x/lorelei/svg?seed=${role}&backgroundColor=${hexColor.replace("#","")}`} alt="User Avatar" className="w-10 h-10 rounded-full"/>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
            <p className="text-[10px] text-gray-500 uppercase truncate">{role=="campus"?"Team":role}{jamiaNo && " • " + jamiaNo}</p>
          </div>
          <IconAction label="Log out" onClick={()=>setLogOut(true)} className="grid size-11 shrink-0 place-items-center rounded-lg bg-gray-100 text-gray-700 transition-colors hover:bg-red-100 hover:text-red-600">
            <TbLogout />
          </IconAction>
        </div>
      </div>
  );
}

export default FooterSide;
