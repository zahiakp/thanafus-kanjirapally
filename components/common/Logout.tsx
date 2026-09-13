import { useState } from "react";
import { useCookies } from "react-cookie";
import { accessCookieName, brandName } from "../../app/data/branding";
import { showMessage } from "./CusToast";

function Logout({ close }: { close: () => void }) {
  const [, , removeCookie] = useCookies([accessCookieName]);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      const response = await fetch("/api/logout", {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Logout failed. Please try again.");
      }

      removeCookie(accessCookieName, { path: "/" });
      // Reload to discard authenticated client state and cached dashboard routes.
      window.location.replace("/login");
    } catch (error: any) {
      showMessage(error?.message || "Logout failed. Please try again.", "error");
      setLoggingOut(false);
    }
  };

  return (
    <dialog id="logout-confirmation" className="modal modal-open">
      <div className="modal-box z-10">
        <h3 className="text-center text-xl font-bold text-black">Are you ready to logout?</h3>
        <div className="modal-action">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={loggingOut}
              className="btn mr-5 w-[90%] bg-gradient-to-r from-red-400 to-red-600 text-white shadow-lg duration-300 hover:shadow-sm disabled:opacity-60 md:w-56"
              onClick={close}
            >
              Close
            </button>
            <button
              type="button"
              disabled={loggingOut}
              className="btn w-36 cursor-pointer bg-gradient-to-r from-green-400 to-green-600 text-white shadow-lg duration-300 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60 md:w-56"
              onClick={() => void handleLogout()}
            >
              {loggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}

export default Logout;
