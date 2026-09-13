import AdminLayout from "../../components/layout/AdminLayout";
import TopicList from "./TopicList";

async function page() {


  return (
    <AdminLayout active="topics">
   <TopicList/> 
   </AdminLayout>
  );
}

export default page;
