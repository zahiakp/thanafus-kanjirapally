"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { IoClose, IoSearchOutline } from "react-icons/io5";
import { MdDeleteOutline, MdLockOutline, MdOutlineEdit, MdPeopleOutline } from "react-icons/md";
import { BiUserPlus } from "react-icons/bi";
import { showMessage } from "../../../components/common/CusToast";
import LDRloader from "../../../components/common/LDRloader";
import { AccessUser, deleteAccessUser, getAccessUsers, updateAccessUser } from "./func";
import AddUserModal from "./AddUserModal";
import { judgeLabel } from "../../utils/judges";

const roleDetails: Record<string, { label: string; classes: string }> = {
  admin: { label: "Administration", classes: "bg-violet-50 text-violet-700 border-violet-200" },
  announce: { label: "Announcements", classes: "bg-sky-50 text-sky-700 border-sky-200" },
  award: { label: "Awards Desk", classes: "bg-amber-50 text-amber-700 border-amber-200" },
  judge: { label: "Judging Panel", classes: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200" },
  report: { label: "Reporting Desk", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  result: { label: "Results Desk", classes: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  campus: { label: "Team Access", classes: "bg-orange-50 text-orange-700 border-orange-200" },
};

function roleInfo(role: string) {
  return roleDetails[role] || {
    label: role.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase()),
    classes: "bg-gray-50 text-gray-700 border-gray-200",
  };
}

function userRoleLabel(user: AccessUser) {
  return user.role === "judge" && user.judgeSlot ? judgeLabel(user.judgeSlot) : roleInfo(user.role).label;
}

function EditModal({ user, close, saved }: { user: AccessUser; close: () => void; saved: () => Promise<void> }) {
  const [username, setUsername] = useState(user.username);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const normalizedUsername = username.trim();
  const changed = normalizedUsername !== user.username || password.length > 0;
  const passwordValid = password.length === 0 || password.length >= 8;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!normalizedUsername) return showMessage("Username is required.", "error");
    if (!passwordValid) return showMessage("Password must contain at least 8 characters.", "error");
    if (!changed) return;
    setSaving(true);
    try {
      await updateAccessUser(user, { username: normalizedUsername, password: password || undefined });
      showMessage("User details updated successfully.", "success");
      await saved();
      close();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Unable to update this user.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-user-title">
      <form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="edit-user-title" className="text-xl font-bold text-gray-900">Update user details</h2>
            <p className="mt-1 text-sm text-gray-500">The account role stays attached to this user.</p>
          </div>
          <button type="button" onClick={close} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Close edit user dialog"><IoClose className="text-xl" /></button>
        </div>

        <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Access role</p>
          <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${roleInfo(user.role).classes}`}>{roleInfo(user.role).label}</span>
        </div>

        <label className="mt-5 block text-sm font-semibold text-gray-800" htmlFor="user-username">Username</label>
        <input id="user-username" value={username} onChange={(event) => setUsername(event.target.value)} disabled={Boolean(user.judgeSlot)} maxLength={100} autoComplete="username" className="mt-2 w-full border-gray-300 px-4 py-3 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500" />

        <label className="mt-5 block text-sm font-semibold text-gray-800" htmlFor="user-password">New password</label>
        <div className="relative mt-2">
          <input id="user-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} maxLength={128} autoComplete="new-password" placeholder="Leave blank to keep current password" className="w-full border-gray-300 px-4 py-3 pr-20" />
          <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute inset-y-0 right-3 text-sm font-semibold text-primary-600">{showPassword ? "Hide" : "Show"}</button>
        </div>
        {password.length > 0 && !passwordValid && <p className="mt-2 text-xs text-red-600">Use at least 8 characters.</p>}

        <div className="mt-7 flex justify-end gap-3">
          <button type="button" onClick={close} className="rounded-lg border border-gray-300 px-5 py-2.5 font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={saving || !changed || !normalizedUsername || !passwordValid} className="rounded-lg bg-primary-600 px-5 py-2.5 font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving..." : "Save changes"}</button>
        </div>
      </form>
    </div>
  );
}

function DeleteModal({ user, close, deleted }: { user: AccessUser; close: () => void; deleted: () => Promise<void> }) {
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const confirmed = confirmation.trim() === user.username;

  const remove = async () => {
    if (!confirmed) return;
    setDeleting(true);
    try {
      await deleteAccessUser(user);
      showMessage("User deleted successfully.", "success");
      await deleted();
      close();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Unable to delete this user.", "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-user-title">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="delete-user-title" className="text-xl font-bold text-gray-900">Delete user?</h2>
            <p className="mt-1 text-sm text-gray-500">This permanently removes the account and cannot be undone.</p>
          </div>
          <button type="button" onClick={close} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Close delete user dialog"><IoClose className="text-xl" /></button>
        </div>
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Enter <strong>{user.username}</strong> to confirm deletion.</div>
        <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-4 w-full border-gray-300 px-4 py-3" placeholder="Type the exact username" autoFocus />
        <div className="mt-7 flex justify-end gap-3">
          <button type="button" onClick={close} className="rounded-xl border border-gray-300 px-5 py-2.5 font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
          <button type="button" onClick={remove} disabled={!confirmed || deleting} className="rounded-xl bg-red-600 px-5 py-2.5 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">{deleting ? "Deleting..." : "Delete user"}</button>
        </div>
      </div>
    </div>
  );
}

export default function Content() {
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<AccessUser | null>(null);
  const [deleting, setDeleting] = useState<AccessUser | null>(null);

  const loadUsers = useCallback(async () => {
    setError(null);
    try {
      setUsers(await getAccessUsers());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((user) => [user.username, user.campusId || "", userRoleLabel(user)].some((value) => value.toLowerCase().includes(needle)));
  }, [query, users]);

  const managedCount = users.filter((user) => !user.isTeamManaged).length;
  const roleCount = new Set(users.map((user) => user.role)).size;


  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-lg font-semibold text-gray-900">Users & access</p>
          <p className="text-sm text-gray-500">Manage existing login credentials. Team access is managed from Teams.</p>
        </div>
        <button type="button" onClick={() => setAdding(true)} className="flex w-fit items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-white transition-colors hover:bg-primary-700"><BiUserPlus className="text-xl" /> Add User</button>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4"><p className="text-sm text-gray-500">All access accounts</p><p className="mt-1 text-2xl font-bold text-gray-900">{users.length}</p></div>
        <div className="rounded-lg border border-gray-200 bg-white p-4"><p className="text-sm text-gray-500">Users managed here</p><p className="mt-1 text-2xl font-bold text-gray-900">{managedCount}</p></div>
        <div className="rounded-lg border border-gray-200 bg-white p-4"><p className="text-sm text-gray-500">Access roles</p><p className="mt-1 text-2xl font-bold text-gray-900">{roleCount}</p></div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="flex flex-col gap-4 border-b border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-semibold text-gray-900">Existing users</h2><p className="text-sm text-gray-500">{filteredUsers.length} of {users.length} account(s)</p></div>
          <div className="relative w-full sm:w-80"><IoSearchOutline className="absolute left-3 top-2.5 text-xl text-gray-400" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search users..." className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-primary-500 focus:ring-2 focus:ring-primary-100" /></div>
        </div>

        {loading ? (
          <div className="flex min-h-56 items-center justify-center bg-primary-50/50"><LDRloader /></div>
        ) : error ? (
          <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"><p>{error}</p><button type="button" onClick={() => { setLoading(true); void loadUsers(); }} className="mt-3 font-bold underline">Try again</button></div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center p-8 text-center"><MdPeopleOutline className="text-5xl text-gray-300" /><p className="mt-3 font-semibold text-gray-700">No users found</p><p className="text-sm text-gray-500">Try a different search.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">User</th><th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Access role</th><th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Account type</th><th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((user) => {
                  const info = roleInfo(user.role);
                  return (
                    <tr key={user.id} className="hover:bg-gray-50/70">
                      <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 font-bold uppercase text-primary-700">{user.username.slice(0, 2)}</div><div><p className="font-semibold text-gray-900">{user.username}</p><p className="text-xs text-gray-500">Access ID #{user.id}{user.campusId ? ` ? Team ID ${user.campusId}` : ""}</p></div></div></td>
                      <td className="px-6 py-4"><span className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold ${info.classes}`}>{userRoleLabel(user)}</span></td>
                      <td className="px-6 py-4">{user.isTeamManaged ? <div><span className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-700"><MdPeopleOutline /> Team managed</span><p className="mt-1 text-xs text-gray-500">Use the Team module</p></div> : user.isPrimary ? <div><span className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700"><MdLockOutline /> Primary access</span><p className="mt-1 text-xs text-gray-500">Compulsory for this role</p></div> : <span className="text-sm text-gray-600">Additional user</span>}</td>
                      <td className="px-6 py-4"><div className="flex justify-end gap-2">{user.isTeamManaged ? <span className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-500">Managed in Teams</span> : <><button type="button" onClick={() => setEditing(user)} className="rounded-lg bg-gray-50 p-2 text-gray-900 border border-gray-200" aria-label={`Edit ${user.username}`} title="Edit credentials"><MdOutlineEdit className="text-lg" /></button><button type="button" onClick={() => setDeleting(user)} disabled={user.isPrimary} className="rounded-lg bg-red-50 p-2.5 text-red-900 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-35" aria-label={`Delete ${user.username}`} title={user.isPrimary ? "Primary access cannot be deleted" : "Delete user"}><MdDeleteOutline className="text-lg" /></button></>}</div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && <EditModal user={editing} close={() => setEditing(null)} saved={loadUsers} />}
      {deleting && <DeleteModal user={deleting} close={() => setDeleting(null)} deleted={loadUsers} />}
      {adding && <AddUserModal close={() => setAdding(false)} saved={loadUsers} />}
    </main>
  );
}
