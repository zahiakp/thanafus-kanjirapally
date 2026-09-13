import React from 'react'
import AdminLayout from '../../components/layout/AdminLayout'
import AwardList from "./AwardList"

function page() {
  return (
    <AdminLayout active="award">
      <AwardList/>
    </AdminLayout>
  )
}

export default page
