import AdminLayout from "../../components/layout/AdminLayout";
import Overview from "../results/Overview";
import Content from "./PosterMaker";

async function page() {

  return ( <AdminLayout active="poster">
    {/* <Overview/> */}
    <Content/>
  </AdminLayout> )
}

export default page;
