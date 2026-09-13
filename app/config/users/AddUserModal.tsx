"use client";

import { FormEvent, useState } from "react";
import { IoClose } from "react-icons/io5";
import { showMessage } from "../../../components/common/CusToast";
import { createAccessUser } from "./func";

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
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(roles[0].value);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ username: string; password: string; roleLabel: string } | null>(null);
  const selectedRole = roles.find((option) => option.value === role) || roles[0];

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const accountUsername = selectedRole.judgeSlot ? selectedRole.value : username.trim();
    if (!accountUsername) return showMessage("Username is required.", "error");
    if (password.length < 8) return showMessage("Password must contain at least 8 characters.", "error");
    setSaving(true);
    try {
      await createAccessUser({
        username: accountUsername,
        password,
        role: selectedRole.role,
        judgeSlot: selectedRole.judgeSlot || null,
      });
      setCreated({ username: accountUsername, password, roleLabel: selectedRole.label });
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
        <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="created-user-title" className="text-xl font-bold text-gray-900">User created</h2>
              <p className="mt-1 text-sm text-gray-500">Copy and store these login details now.</p>
            </div>
            <button type="button" onClick={close} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Close created user dialog"><IoClose className="text-xl" /></button>
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
      <form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="add-user-title" className="text-xl font-bold text-gray-900">Add user</h2>
            <p className="mt-1 text-sm text-gray-500">Create a login for an existing access role.</p>
          </div>
          <button type="button" onClick={close} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Close add user dialog"><IoClose className="text-xl" /></button>
        </div>

        <label className="mt-6 block text-sm font-semibold text-gray-800" htmlFor="new-user-role">Access role</label>
        <select id="new-user-role" value={role} onChange={(event) => {
          const nextRole = event.target.value;
          const option = roles.find((item) => item.value === nextRole);
          setRole(nextRole);
          if (option?.judgeSlot) setUsername(option.value);
          else if (/^judge-[1-3]$/.test(username)) setUsername("");
        }} className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-primary-500">
          {roles.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <p className="mt-2 text-xs text-gray-500">Team access is created and managed from the Team module.</p>

        <label className="mt-5 block text-sm font-semibold text-gray-800" htmlFor="new-user-username">Username</label>
        <input id="new-user-username" value={username} onChange={(event) => setUsername(event.target.value)} disabled={Boolean(selectedRole.judgeSlot)} maxLength={100} autoComplete="username" className="mt-2 w-full border-gray-300 px-4 py-3 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500" placeholder="Enter a unique username" autoFocus />

        <label className="mt-5 block text-sm font-semibold text-gray-800" htmlFor="new-user-password">Password</label>
        <div className="relative mt-2">
          <input id="new-user-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} maxLength={128} autoComplete="new-password" aria-invalid={password.length > 0 && password.length < 8} className="w-full border-gray-300 px-4 py-3 pr-20" placeholder="Minimum 8 characters" />
          <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute inset-y-0 right-3 text-sm font-semibold text-primary-600">{showPassword ? "Hide" : "Show"}</button>
        </div>
        {password.length > 0 && password.length < 8 && <p className="mt-2 text-sm font-medium text-red-600">Enter at least 8 characters ({password.length}/8).</p>}

        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-900">After creation, copy and securely store the password. It cannot be viewed again later.</p>
        <div className="mt-7 flex justify-end gap-3">
          <button type="button" onClick={close} className="rounded-lg border border-gray-300 px-5 py-2.5 font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={saving} className="rounded-lg bg-primary-600 px-5 py-2.5 font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Adding..." : "Add user"}</button>
        </div>
      </form>
    </div>
  );
}
