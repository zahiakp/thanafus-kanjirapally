import AdminLayout from "../../../components/layout/AdminLayout";
import Content from "./Content";

export const dynamic = "force-dynamic";

export default function ExportPage() {
  return <AdminLayout active="config"><Content /></AdminLayout>;
}
