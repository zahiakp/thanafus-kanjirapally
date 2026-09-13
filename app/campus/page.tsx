import AdminLayout from "../../components/layout/AdminLayout";
import CHighlight from "./Highlight";
import CampusList from "./CampusList";

async function page() {
  return (
    <AdminLayout active="campus">
      
      <CampusList />
    </AdminLayout>
  );
}

export default page;
