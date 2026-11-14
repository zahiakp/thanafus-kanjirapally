import AdminLayout from "../../components/layout/AdminLayout";
import { requireApiSession } from "../utils/apiAuth";
import Queue from "./Queue";

export default async function SchedulePage() {
  const session = await requireApiSession(["admin", "report", "judge"]);
  return <AdminLayout active="schedule"><Queue view={session.role === "admin" ? "admin" : "staff"} /></AdminLayout>;
}
