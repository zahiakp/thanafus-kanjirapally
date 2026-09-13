import React from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import ProgramList from "./ProgramList";

function page() {

  return (
    <AdminLayout active="programs">
    <ProgramList/>
    </AdminLayout>
  );
}

export default page;
