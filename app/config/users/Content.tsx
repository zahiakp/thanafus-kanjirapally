"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { IoClose, IoSearchOutline } from "react-icons/io5";
import { MdDeleteOutline, MdLockOutline, MdOutlineEdit, MdOutlinePlace, MdPassword, MdPeopleOutline } from "react-icons/md";
import { BiUserPlus } from "react-icons/bi";
import { showMessage } from "../../../components/common/CusToast";
import LDRloader from "../../../components/common/LDRloader";
import IconAction from "../../../components/common/IconAction";
import { AccessUser, deleteAccessUser, getAccessUsers, updateAccessUser } from "./func";
import AddUserModal from "./AddUserModal";
import VenueScopeModal from "./VenueScopeModal";
import { judgeLabel } from "../../utils/judges";
import { createSecurePassword } from "../../utils/createSecurePassword";
import { scheduleRequest } from "../../schedule/Queue";
import type { StaffVenueAssignment } from "../../utils/venueAccess";

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

const userColumns = "xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)_auto]";
const rowAction = "grid size-11 shrink-0 place-items-center rounded-lg border text-lg disabled:cursor-not-allowed disabled:opacity-40";

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
      <form onSubmit={submit} className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="edit-user-title" className="text-xl font-bold text-gray-900">Update user details</h2>
            <p className="mt-1 text-sm text-gray-500">The account role stays attached to this user.</p>
          </div>
          <IconAction label="Close edit user dialog" onClick={close} className="grid size-11 shrink-0 place-items-center rounded-lg text-gray-500 hover:bg-gray-100"><IoClose className="text-xl" /></IconAction>
        </div>

        <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Access role</p>
          <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${roleInfo(user.role).classes}`}>{roleInfo(user.role).label}</span>
        </div>

        <label className="mt-5 block text-sm font-semibold text-gray-800" htmlFor="user-username">Username</label>
        <input id="user-username" value={username} onChange={(event) => setUsername(event.target.value)} disabled={Boolean(user.judgeSlot)} maxLength={100} autoComplete="username" className="mt-2 w-full border-gray-300 px-4 py-3 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500" />

        <label className="mt-5 block text-sm font-semibold text-gray-800" htmlFor="user-password">New password</label>
        <div className="mt-2 flex gap-3">
          <div className="relative min-w-0 flex-1">
            <input id="user-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} maxLength={128} autoComplete="new-password" placeholder="Leave blank to keep current password" className="w-full border-gray-300 px-4 py-3 pr-20" />
            <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute inset-y-0 right-3 text-sm font-semibold text-primary-600">{showPassword ? "Hide" : "Show"}</button>
          </div>
          <IconAction label="Generate password" disabled={saving} onClick={() => {
            setPassword(createSecurePassword());
            setShowPassword(true);
          }} className="grid size-11 shrink-0 place-items-center self-center rounded-lg bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50">
            <MdPassword className="text-xl" />
          </IconAction>
        </div>
        {password.length > 0 && !passwordValid && <p className="mt-2 text-xs text-red-600">Use at least 8 characters.</p>}

        <div className="mt-7 flex flex-wrap justify-end gap-3">
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
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="delete-user-title" className="text-xl font-bold text-gray-900">Delete user?</h2>
            <p className="mt-1 text-sm text-gray-500">This permanently removes the account and cannot be undone.</p>
          </div>
          <IconAction label="Close delete user dialog" onClick={close} className="grid size-11 shrink-0 place-items-center rounded-lg text-gray-500 hover:bg-gray-100"><IoClose className="text-xl" /></IconAction>
        </div>
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Enter <strong>{user.username}</strong> to confirm deletion.</div>
        <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-4 w-full border-gray-300 px-4 py-3" placeholder="Type the exact username" autoFocus />
        <div className="mt-7 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={close} className="rounded-xl border border-gray-300 px-5 py-2.5 font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
          <button type="button" onClick={remove} disabled={!confirmed || deleting} className="rounded-xl bg-red-600 px-5 py-2.5 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">{deleting ? "Deleting..." : "Delete user"}</button>
        </div>
      </div>
    </div>
  );
}

export default function Content() {
  const [venueUser, setVenueUser] = useState<AccessUser>();
  const [assignments, setAssignments] = useState<Partial<Record<number, StaffVenueAssignment>>>({});
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [assignmentError, setAssignmentError] = useState("");
  const [assignmentAttempt, setAssignmentAttempt] = useState(0);
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
      setLoadingAssignments(true);
      setAssignmentError("");
      setAssignmentAttempt(attempt => attempt + 1);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadUsers(); }, [loadUsers]);
  useEffect(() => {
    const controller = new AbortController();
    scheduleRequest<{ assignments: StaffVenueAssignment[] }>("?view=staff-access", undefined, controller.signal)
      .then(result => { if (!controller.signal.aborted) setAssignments(Object.fromEntries(result.assignments.map(assignment => [assignment.accessId, assignment]))); })
      .catch(error => { if (!controller.signal.aborted) setAssignmentError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoadingAssignments(false); });
    return () => controller.abort();
  }, [assignmentAttempt]);

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

      <dl className="grid grid-cols-3 gap-2 sm:gap-4">
        {[["All access accounts", users.length], ["Users managed here", managedCount], ["Access roles", roleCount]].map(([label, count]) =>
          <div key={label} className="min-w-0 rounded-lg border border-gray-200 bg-white p-2.5 sm:p-4">
            <dt className="text-xs text-gray-500 sm:text-sm">{label}</dt>
            <dd className="mt-1 text-xl font-bold text-gray-900 sm:text-2xl">{count}</dd>
          </div>
        )}
      </dl>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="flex flex-col gap-4 border-b border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-semibold text-gray-900">Existing users</h2><p className="text-sm text-gray-500">{filteredUsers.length} of {users.length} account(s)</p></div>
          <div className="relative w-full sm:w-80"><IoSearchOutline className="pointer-events-none absolute left-3 top-3 text-xl text-gray-400" /><input type="search" aria-label="Search users" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search users..." className="min-h-11 w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-primary-500 focus:ring-2 focus:ring-primary-100" /></div>
        </div>

        {assignmentError && <div role="alert" className="flex flex-wrap items-center gap-2 border-b border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p>Could not load venue access. {assignmentError}</p>
          <button type="button" className="font-semibold underline" onClick={() => {
            setAssignmentError(""); setLoadingAssignments(true); setAssignmentAttempt(attempt => attempt + 1);
          }}>Retry</button>
        </div>}
        {loading ? (
          <div className="flex min-h-56 items-center justify-center bg-primary-50/50"><LDRloader /></div>
        ) : error ? (
          <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"><p>{error}</p><button type="button" onClick={() => { setLoading(true); void loadUsers(); }} className="mt-3 font-bold underline">Try again</button></div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center p-8 text-center"><MdPeopleOutline className="text-5xl text-gray-300" /><p className="mt-3 font-semibold text-gray-700">No users found</p><p className="text-sm text-gray-500">Try a different search.</p></div>
        ) : (
          <>
            <div aria-hidden="true" className={`hidden gap-4 border-b border-gray-200 bg-gray-50 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 xl:grid ${userColumns}`}>
              <span>User</span><span>Access role</span><span>Account type</span><span className="w-36 text-right">Actions</span>
            </div>
            <ul aria-label="Existing users" className="divide-y divide-gray-100">
              {filteredUsers.map((user) => {
                const info = roleInfo(user.role);
                const assigned = assignments[user.id]?.venues;
                const canAssignVenue = user.role === "report" || user.role === "judge";
                return (
                  <li key={user.id} className={`grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-3 p-3 sm:gap-x-4 sm:p-4 xl:px-6 ${userColumns}`}>
                    <div className="col-span-2 flex min-w-0 items-center gap-3 xl:col-span-1">
                      <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-50 font-bold uppercase text-primary-700">{user.username.slice(0, 2)}</span>
                      <div className="min-w-0">
                        <p className="break-all font-semibold text-gray-900">{user.username}</p>
                        <p className="break-words text-xs text-gray-500">Access ID #{user.id}{user.role === "campus" && user.campusId ? ` · Team ID ${user.campusId}` : ""}</p>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <span className={`inline-flex max-w-full break-words rounded-full border px-2.5 py-1 text-xs font-semibold ${info.classes}`}>{userRoleLabel(user)}</span>
                      {canAssignVenue && <p className="mt-1.5 break-words text-xs text-gray-600 sm:text-sm">
                        {assigned === undefined ? (loadingAssignments ? "Loading venue access…" : "Venue access unavailable") :
                          assigned === null ? "All venues" : assigned.length ? assigned.map(venue => venue.name).join(", ") : "No venues assigned"}
                      </p>}
                    </div>
                    <div className="col-start-1 row-start-3 min-w-0 xl:col-start-auto xl:row-start-auto">
                      {user.isTeamManaged ? <div><span className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-700"><MdPeopleOutline /> Team managed</span><p className="mt-1 text-xs text-gray-500">Use the Team module</p></div> :
                        user.isPrimary ? <div><span className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700"><MdLockOutline /> Primary access</span><p className="mt-1 hidden text-xs text-gray-500 xl:block">Compulsory for this role</p></div> :
                          <span className="text-xs text-gray-600 sm:text-sm">Additional user</span>}
                    </div>
                    <div className="col-start-2 row-span-2 row-start-2 flex w-36 items-center justify-end gap-1.5 xl:col-start-auto xl:row-span-1 xl:row-start-auto">
                      {user.isTeamManaged ? <span className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-500">Managed in Teams</span> : <>
                        {canAssignVenue && <IconAction label={`Venue access for ${user.username}`} tooltip={loadingAssignments ? "Loading venue access" : "Assign venues"} disabled={loadingAssignments} onClick={() => setVenueUser(user)} className={rowAction + " border-primary-100 bg-primary-50 text-primary-700 hover:bg-primary-100"}><MdOutlinePlace /></IconAction>}
                        <IconAction label={`Edit ${user.username}`} tooltip="Edit credentials" onClick={() => setEditing(user)} className={rowAction + " border-gray-200 bg-gray-50 text-gray-900 hover:bg-gray-100"}><MdOutlineEdit /></IconAction>
                        <IconAction label={`Delete ${user.username}`} tooltip={user.isPrimary ? "Primary access cannot be deleted" : "Delete user"} onClick={() => setDeleting(user)} disabled={user.isPrimary} className={rowAction + " border-red-100 bg-red-50 text-red-900 hover:bg-red-100"}><MdDeleteOutline /></IconAction>
                      </>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {editing && <EditModal user={editing} close={() => setEditing(null)} saved={loadUsers} />}
      {deleting && <DeleteModal user={deleting} close={() => setDeleting(null)} deleted={loadUsers} />}
      {adding && <AddUserModal close={() => setAdding(false)} saved={loadUsers} />}
      {venueUser && <VenueScopeModal key={venueUser.id} id={venueUser.id} username={venueUser.username} close={() => setVenueUser(undefined)} saved={assignment => {
        setAssignments(current => ({ ...current, [assignment.accessId]: assignment }));
        showMessage("Venue access saved.", "success");
      }} />}
    </main>
  );
}
