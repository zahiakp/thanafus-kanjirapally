"use client";

import { useState } from "react";
import { MdDeleteOutline, MdWarningAmber } from "react-icons/md";
import Modal from "../../components/common/Modal";
import { showMessage } from "../../components/common/CusToast";
import { categoryMap } from "../data/branding";
import { deleteProgram } from "./func";

type ProgramDeleteTarget = {
  id: string | number;
  name: string;
  category?: string;
};

type DeleteItemProps = {
  program: ProgramDeleteTarget;
  root: string;
  fetchPrograms: () => void | Promise<void>;
};

const DeleteItem = ({ program, root, fetchPrograms }: DeleteItemProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  const programName = String(program?.name || "").trim();
  const categoryName = categoryMap[program?.category || ""] || program?.category || "—";
  const isConfirmed = Boolean(programName) && confirmation.trim() === programName;

  const closeModal = () => {
    if (deleting) return;
    setConfirmation("");
    setIsOpen(false);
  };

  const handleDelete = async () => {
    if (!isConfirmed || deleting) return;

    setDeleting(true);
    try {
      const response = await deleteProgram(program.id, root);
      if (!response?.success) {
        throw new Error(response?.message || "Deleting the program failed.");
      }

      showMessage("Program deleted successfully", "success");
      setConfirmation("");
      setIsOpen(false);
      await fetchPrograms();
    } catch (error: any) {
      console.error("Error during program deletion:", error);
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
        aria-label={`Delete ${programName || "program"}`}
        title="Delete program"
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
                <h2 className="text-xl font-bold text-gray-900">Delete program?</h2>
                <p className="mt-1 text-sm font-normal whitespace-pre-wrap text-gray-600">
                  This permanently deletes <strong>{programName}</strong>. This action cannot be undone.
                  Enter <strong>{programName}</strong> to confirm
                </p>
              </div>
            </div>
{/* 
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              Category: <strong>{categoryName}</strong>
            </div> */}
            <input
              id={`confirm-program-${program.id}`}
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
              placeholder="Type the exact program name"
              className={`w-full rounded-lg text-base font-normal border px-4 py-2 outline-none transition-colors ${
                confirmation && !isConfirmed
                  ? "border-red-400 focus:border-red-500"
                  : "border-gray-300 focus:border-primary-500"
              }`}
            />
            {confirmation && !isConfirmed && (
              <p className="mt-1 font-normal text-xs text-red-600">The program name does not match.</p>
            )}

            <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeModal}
                disabled={deleting}
                className="rounded-lg border text-base border-gray-300 px-5 py-2 font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={!isConfirmed || deleting}
                className="flex min-w-40 items-center text-base justify-center rounded-lg bg-red-600 px-5 py-2 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
              >
                {deleting ? "Deleting..." : "Delete Program"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default DeleteItem;