"use client";

import { useState } from "react";
import { MdDeleteOutline, MdWarningAmber } from "react-icons/md";
import Modal from "../../components/common/Modal";
import { showMessage } from "../../components/common/CusToast";
import { deleteAccess, deleteTeam, getAccessbyJamiaNo } from "./func";

const DeleteItem = ({
  id,
  fetchCampuses,
  root,
}: {
  id: any;
  fetchCampuses: any;
  root: any;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  const teamName = String(id?.name || "").trim();
  const isConfirmed = Boolean(teamName) && confirmation.trim() === teamName;

  const closeModal = () => {
    if (deleting) return;
    setConfirmation("");
    setIsOpen(false);
  };

  const handleDelete = async () => {
    if (!isConfirmed || deleting) return;

    setDeleting(true);
    try {
      const accessIdResponse = await getAccessbyJamiaNo(id.jamiaNo);
      const accessId = accessIdResponse?.data?.id;

      if (!accessId) {
        throw new Error("The team access account could not be found.");
      }

      const deleteAccessResponse = await deleteAccess(accessId);
      if (!deleteAccessResponse?.success) {
        throw new Error(deleteAccessResponse?.message || "Deleting the team access account failed.");
      }

      const deleteTeamResponse = await deleteTeam(id.id, root);
      if (!deleteTeamResponse?.success) {
        throw new Error(deleteTeamResponse?.message || "Deleting the team failed.");
      }

      showMessage("Team deleted successfully", "success");
      setConfirmation("");
      setIsOpen(false);
      await fetchCampuses();
    } catch (error: any) {
      console.error("Error during team deletion:", error);
      showMessage(error.message || "Something went wrong during deletion.", "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-md bg-red-50 p-2 text-red-500 transition-colors hover:bg-red-100"
        aria-label={`Delete ${teamName || "team"}`}
        title="Delete team"
      >
        <MdDeleteOutline className="text-lg" />
      </button>

      {isOpen && (
        <Modal close={closeModal} edit>
          <div className="w-full max-w-lg pt-2">
            <div className="mb-5 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <MdWarningAmber className="text-2xl" />
              </div>
              <div className="pr-8">
                <h2 className="text-xl font-bold text-gray-900">Delete team?</h2>
                <p className="mt-1 text-sm leading-6 text-gray-600">
                  This permanently deletes <strong>{teamName}</strong> and its access account. This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              Team ID: <strong>{id?.jamiaNo || "—"}</strong>
            </div>

            <label htmlFor={`confirm-team-${id?.id}`} className="mt-5 block text-sm font-medium text-gray-800">
              Enter <strong>{teamName}</strong> to confirm
            </label>
            <input
              id={`confirm-team-${id?.id}`}
              type="text"
              autoFocus
              autoComplete="off"
              value={confirmation}
              disabled={deleting}
              onChange={(event) => setConfirmation(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleDelete();
                }
              }}
              placeholder="Type the exact team name"
              className={`mt-2 w-full rounded-lg border px-4 py-3 outline-none transition-colors ${
                confirmation && !isConfirmed
                  ? "border-red-400 focus:border-red-500"
                  : "border-gray-300 focus:border-primary-500"
              }`}
            />
            {confirmation && !isConfirmed && (
              <p className="mt-2 text-xs text-red-600">The team name does not match.</p>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeModal}
                disabled={deleting}
                className="rounded-lg border border-gray-300 px-5 py-3 font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={!isConfirmed || deleting}
                className="flex min-w-36 items-center justify-center rounded-lg bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
              >
                {deleting ? "Deleting..." : "Delete Team"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default DeleteItem;
