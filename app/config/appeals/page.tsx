import AdminLayout from "../../../components/layout/AdminLayout";
import { requireApiSession } from "../../utils/apiAuth";
import AppealsContent from "./Content";

export const dynamic = "force-dynamic";

export default async function AppealsPage() {
  const session = await requireApiSession(["admin", "campus"]);
  return (
    <AdminLayout active="appeals">
      <AppealsContent role={session.role as "admin" | "campus"} />
    </AdminLayout>
  );
}
