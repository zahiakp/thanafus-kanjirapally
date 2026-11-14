import AdminLayout from "../../components/layout/AdminLayout";
import { requireApiSession } from "../utils/apiAuth";
import VenueDirectory from "./VenueDirectory";

export default async function VenuesPage() {
  await requireApiSession(["admin"]);
  return <AdminLayout active="venues"><VenueDirectory /></AdminLayout>;
}
