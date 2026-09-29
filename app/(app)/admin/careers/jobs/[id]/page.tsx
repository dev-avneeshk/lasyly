import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getCareersAdmin } from "@/lib/careers/adminAuth"
import { getJobById } from "@/lib/careers/server"
import { AdminShell } from "@/components/careers/admin/AdminShell"
import { JobForm } from "@/components/careers/admin/JobForm"

export const metadata: Metadata = {
  title: "Edit job — Careers admin",
  robots: { index: false, follow: false },
}

type PageProps = { params: Promise<{ id: string }> }

export default async function EditJobPage({ params }: PageProps) {
  const admin = await getCareersAdmin()
  if (!admin) notFound()

  const { id } = await params
  const job = await getJobById(id)
  if (!job) notFound()

  return (
    <AdminShell active="jobs" title={`Edit: ${job.title}`}>
      <JobForm
        jobId={job.id}
        initial={{
          title: job.title,
          department: job.department,
          location: job.location,
          employmentType: job.employmentType,
          experienceLevel: job.experienceLevel,
          description: job.description,
          requirements: job.requirements,
          skills: job.skills,
          isActive: job.isActive,
        }}
      />
    </AdminShell>
  )
}
