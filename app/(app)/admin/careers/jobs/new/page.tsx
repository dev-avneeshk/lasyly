import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getCareersAdmin } from "@/lib/careers/adminAuth"
import { AdminShell } from "@/components/careers/admin/AdminShell"
import { JobForm } from "@/components/careers/admin/JobForm"

export const metadata: Metadata = {
  title: "New job — Careers admin",
  robots: { index: false, follow: false },
}

export default async function NewJobPage() {
  const admin = await getCareersAdmin()
  if (!admin) notFound()

  return (
    <AdminShell active="jobs" title="New job">
      <JobForm />
    </AdminShell>
  )
}
