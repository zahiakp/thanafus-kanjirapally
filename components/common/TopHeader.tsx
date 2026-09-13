import { useEffect, useState } from "react";
import { useCookies } from "react-cookie";
import { TbLogout } from "react-icons/tb";
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
    <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white">
        <div className="flex items-center space-x-3">
          <img src={`https://api.dicebear.com/10.x/lorelei/svg?seed=${role}&backgroundColor=${hexColor.replace("#","")}`} alt="User Avatar" className="w-10 h-10 rounded-full"/>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
            <p className="text-[10px] text-gray-500 uppercase truncate">{role=="campus"?"Team":role}{jamiaNo && " • " + jamiaNo}</p>
          </div>
          <button onClick={()=>setLogOut(true)} type="button" className="text-gray-700 hover:text-red-600 p-3 rounded-lg bg-gray-100 hover:bg-red-100 transition-colors duration-200">
            <TbLogout />
          </button>
        </div>
      </div>
  );
}

export default FooterSide;
