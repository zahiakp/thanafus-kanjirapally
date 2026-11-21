"use client";

import { FormEvent, useEffect, useState } from "react";
import { IoClose } from "react-icons/io5";
import { MdPassword } from "react-icons/md";
import { showMessage } from "../../../components/common/CusToast";
import IconAction from "../../../components/common/IconAction";
import { createSecurePassword } from "../../utils/createSecurePassword";
import { createAccessUser } from "./func";
import { venueJudgeUsername, type JudgeSlot } from "../../utils/judges";

type VenueOption = { id: number; name: string };

const roles = [
  { value: "admin", role: "admin", label: "Administration" },
  { value: "announce", role: "announce", label: "Announcements" },
  { value: "award", role: "award", label: "Awards Desk" },
  { value: "judge", role: "judge", label: "Judge (all mark columns)" },
  { value: "judge-1", role: "judge", judgeSlot: 1, label: "Judge-1 (mark column 1)" },
  { value: "judge-2", role: "judge", judgeSlot: 2, label: "Judge-2 (mark column 2)" },
  { value: "judge-3", role: "judge", judgeSlot: 3, label: "Judge-3 (mark column 3)" },
  { value: "report", role: "report", label: "Reporting Desk" },
  { value: "result", role: "result", label: "Results Desk" },
];

export default function AddUserModal({ close, saved }: { close: () => void; saved: () => Promise<void> }) {
  const [username, setUsername] = useState("");
  const [venueId, setVenueId] = useState("");
  const [venues, setVenues] = useState<VenueOption[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [venuesError, setVenuesError] = useState("");
  const [venueRetry, setVenueRetry] = useState(0);
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(roles[0].value);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ username: string; password: string; roleLabel: string } | null>(null);
  const selectedRole = roles.find((option) => option.value === role) || roles[0];

  useEffect(() => {
    const controller = new AbortController();
    setVenuesLoading(true);
    setVenuesError("");
    fetch("/api/schedule?view=venues", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to load venues.");
        if (!Array.isArray(data.venues)) throw new Error("Unable to load venues.");
        if (!controller.signal.aborted) setVenues(data.venues);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setVenues([]);
          setVenuesError(error instanceof Error ? error.message : "Unable to load venues.");
        }
      })
      .finally(() => { if (!controller.signal.aborted) setVenuesLoading(false); });
    return () => controller.abort();
  }, [venueRetry]);

  const selectedVenue = venues.find((item) => String(item.id) === venueId);
  const accountUsername = selectedRole.judgeSlot
    ? venueJudgeUsername(selectedRole.judgeSlot as JudgeSlot, selectedVenue?.name || "")
    : username.trim();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (selectedRole.judgeSlot && (venuesLoading || venuesError || !selectedVenue)) return showMessage("Select an available venue.", "error");
    if (selectedRole.judgeSlot && !accountUsername) return showMessage("The selected venue needs a name containing letters or numbers for its login.", "error");
    if (accountUsername.length > 100) return showMessage("The generated username must be at most 100 characters.", "error");
    if (!accountUsername) return showMessage("Username is required.", "error");
    if (password.length < 8) return showMessage("Password must contain at least 8 characters.", "error");
    setSaving(true);
    try {
      const response = await createAccessUser({
        username: accountUsername,
        password,
        role: selectedRole.role,
        judgeSlot: selectedRole.judgeSlot || null,
        venueId: selectedRole.judgeSlot ? selectedVenue?.id : undefined,
      });
      setCreated({ username: response.data?.username || accountUsername, password, roleLabel: selectedRole.label });
      showMessage("User added successfully.", "success");
      try { await saved(); } catch { /* The account was still created successfully. */ }
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Unable to add this user.", "error");
    } finally {
      setSaving(false);
    }
  };

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showMessage(`${label} copied.`, "success");
    } catch {
      showMessage("Clipboard access was blocked. Select and copy the value manually.", "error");
    }
  };

  if (created) {
    const loginDetails = `Username: ${created.username}\nPassword: ${created.password}\nRole: ${created.roleLabel}`;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="created-user-title">
        <div className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="created-user-title" className="text-xl font-bold text-gray-900">User created</h2>
              <p className="mt-1 text-sm text-gray-500">Copy and store these login details now.</p>
            </div>
            <IconAction label="Close created user dialog" onClick={close} className="grid size-11 shrink-0 place-items-center rounded-lg text-gray-500 hover:bg-gray-100"><IoClose className="text-xl" /></IconAction>
          </div>

          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">
            This password cannot be retrieved after closing. It is stored only as a secure one-way hash.
          </div>

          <div className="mt-5 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Role</p><p className="mt-1 font-semibold text-gray-900">{created.roleLabel}</p></div>
            <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Username</p><p className="mt-1 select-all break-all font-mono text-gray-900">{created.username}</p></div>
            <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Password</p><p className="mt-1 select-all break-all font-mono text-gray-900">{created.password}</p></div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => void copyText(created.password, "Password")} className="rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 font-semibold text-primary-700 hover:bg-primary-100">Copy password</button>
            <button type="button" onClick={() => void copyText(loginDetails, "Login details")} className="rounded-lg bg-primary-600 px-4 py-3 font-semibold text-white hover:bg-primary-700">Copy login details</button>
          </div>
          <button type="button" onClick={close} className="mt-3 w-full rounded-lg border border-gray-300 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50">I have saved the credentials</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="add-user-title">
      <form onSubmit={submit} className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="add-user-title" className="text-xl font-bold text-gray-900">Add user</h2>
            <p className="mt-1 text-sm text-gray-500">Create a login for an existing access role.</p>
          </div>
          <IconAction label="Close add user dialog" onClick={close} className="grid size-11 shrink-0 place-items-center rounded-lg text-gray-500 hover:bg-gray-100"><IoClose className="text-xl" /></IconAction>
        </div>

        <label className="mt-6 block text-sm font-semibold text-gray-800" htmlFor="new-user-role">Access role</label>
        <select id="new-user-role" value={role} onChange={(event) => {
          const nextRole = event.target.value;
          setRole(nextRole);
        }} className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-primary-500">
          {roles.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <p className="mt-2 text-xs text-gray-500">Team access is created and managed from the Team module.</p>

        {selectedRole.judgeSlot && (
          <div className="mt-5">
            <label className="block text-sm font-semibold text-gray-800" htmlFor="new-user-venue">Venue / stage name</label>
            <select id="new-user-venue" value={venueId} onChange={(event) => setVenueId(event.target.value)} required disabled={venuesLoading || Boolean(venuesError) || !venues.length} className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 disabled:bg-gray-100">
              <option value="">{venuesLoading ? "Loading venues…" : "Select a venue"}</option>
              {venues.map((item) => <option key={item.id} value={String(item.id)}>{item.name}</option>)}
            </select>
            {venuesError && <p role="alert" className="mt-2 text-sm text-red-600">{venuesError} <button type="button" onClick={() => setVenueRetry((value) => value + 1)} className="font-semibold underline">Retry</button></p>}
            {!venuesLoading && !venuesError && !venues.length && <p className="mt-2 text-sm text-gray-500">No venues available. Add a venue first.</p>}
            <p className="mt-2 text-xs text-gray-500">Creates a login such as judge-1-stage-a and automatically assigns access to the selected venue.</p>
          </div>
        )}

        <label className="mt-5 block text-sm font-semibold text-gray-800" htmlFor="new-user-username">Username</label>
        <input id="new-user-username" value={selectedRole.judgeSlot ? accountUsername : username} onChange={(event) => setUsername(event.target.value)} disabled={Boolean(selectedRole.judgeSlot)} maxLength={100} autoComplete="username" className="mt-2 w-full border-gray-300 px-4 py-3 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500" placeholder="Enter a unique username" autoFocus />

        <label className="mt-5 block text-sm font-semibold text-gray-800" htmlFor="new-user-password">Password</label>
        <div className="mt-2 flex gap-3">
          <div className="relative min-w-0 flex-1">
            <input id="new-user-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} maxLength={128} autoComplete="new-password" aria-invalid={password.length > 0 && password.length < 8} className="w-full border-gray-300 px-4 py-3 pr-20" placeholder="Minimum 8 characters" />
            <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute inset-y-0 right-3 text-sm font-semibold text-primary-600">{showPassword ? "Hide" : "Show"}</button>
          </div>
          <IconAction label="Generate password" disabled={saving} onClick={() => {
            setPassword(createSecurePassword());
            setShowPassword(true);
          }} className="grid size-11 shrink-0 place-items-center self-center rounded-lg bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50">
            <MdPassword className="text-xl" />
          </IconAction>
        </div>
        {password.length > 0 && password.length < 8 && <p className="mt-2 text-sm font-medium text-red-600">Enter at least 8 characters ({password.length}/8).</p>}

        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-900">After creation, copy and securely store the password. It cannot be viewed again later.</p>
        <div className="mt-7 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={close} className="rounded-lg border border-gray-300 px-5 py-2.5 font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={saving || Boolean(selectedRole.judgeSlot && (venuesLoading || venuesError || !selectedVenue))} className="rounded-lg bg-primary-600 px-5 py-2.5 font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Adding..." : "Add user"}</button>
        </div>
      </form>
    </div>
  );
}
