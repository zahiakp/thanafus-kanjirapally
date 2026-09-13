import React from "react";
import StudentList from "./StudentList";
import AdminLayout from "../../components/layout/AdminLayout";
import StudentsContent from "./Content";

function page() {
  return (
    <AdminLayout active="students">
      <StudentsContent/>
  {/* <StudentList/> */}
  </AdminLayout>
);
}

export default page;
