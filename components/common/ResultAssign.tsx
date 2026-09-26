'use client'
import { showMessage } from "./CusToast";
import { useRouter } from "next/navigation";
import { AssignOrder, getProgramsOrder, getProgramsOrderTeamBased, UpdateProgramStatus } from "../../app/programs/func";
import { useState } from "react";
import { generateFinalResults} from "../../app/utils/calculatePoints";
import { useCookies } from "react-cookie";
import { accessCookieName, brandName } from "../../app/data/branding";
function ResultAssign({
  close,
  type,
  program,fetch
}: {
  close: any;
  type: any;
  program: any;fetch:any
}) {
  const router = useRouter();
  const [cookies] = useCookies([accessCookieName]);
const [userRole, setUserRole] = useState(cookies[accessCookieName]?.role);
  const proEndpoint = (userRole === "admin" || userRole === "judge") ? "programs" : (userRole === "zoneAdmin" || userRole === "zonecampus") ? "zoneprograms" :(userRole === "campusAdmin" || userRole === "Group") ? "campusprograms" : "";
  const resultEndpoint = (userRole === "admin" || userRole === "judge") ? "results" : (userRole === "zoneAdmin" || userRole === "zonecampus") ? "zoneresults" :(userRole === "campusAdmin" || userRole === "Group") ? "campusresults" : "";
  const [loading, setLoading] = useState(false);

  const UpdateResult = async (program: any, type: any) => {
    setLoading(true); // Start loading
    try {
        // Validate inputs
        if (!program || !Array.isArray(program.participantsData) || !program.id) {
            throw new Error("Invalid program data provided.");
        }

        const isGroup = program.isGroup && program.limit > 2;

        // Assign ranks and save results
        const results = await generateFinalResults({
            participants:program.participantsData,
            program}
        );

        if (!results) {
            showMessage("Some results failed to assign", "error");
            throw new Error("Failed to save results.");
        }

        // Show success message and refresh UI
        showMessage(`${program.name} status changed successfully`, "success");
        // router.refresh();
        await fetch();
        close();
    } catch (error: any) {
        console.error("Error updating results:", error);
        showMessage(error.message || "An error occurred while assigning results", "error");
    } finally {
        setLoading(false); // Stop loading spinner
    }
};

  
  
  


  return (
    <dialog id="my_modal_1" className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-xl text-center">
          Are you confirm to {type} &#39;{program.name}&#39;
        </h3>
        <div className="modal-action">
          <form method="dialog">
            <div className="grid grid-cols-2 items-center gap-3">
              <button type="button"
                className="btn  bg-gradient-to-r from-red-400 to-red-600 md:w-56 text-white shadow-lg hover:shadow-none duration-300"
                onClick={() => close()}
              >
                Close
              </button>
              <button type="button" disabled={loading}
                className="btn shadow-lg disabled:grayscale disabled:text-white bg-gradient-to-r from-green-500 to-emerald-600 md:w-56 w-36 text-white hover:shadow-none duration-300"
                onClick={()=>UpdateResult(program,type)}
              >{loading ? <>
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>{" "}
              Boosting...
            </>: 
                "Confirm" }
              </button>
            </div>
          </form>
        </div>
      </div>
    </dialog>
  );
}

export default ResultAssign;
