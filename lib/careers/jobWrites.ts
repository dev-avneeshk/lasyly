import "server-only"

import { revalidatePath } from "next/cache"
import type { JobInput } from "./validation"
import { invalidateJobsCache } from "./server"

/** camelCase job input → DB columns (only the keys that are present). */
export function jobInputToRow(input: Partial<JobInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (input.title !== undefined) row.title = input.title
  if (input.department !== undefined) row.department = input.department
  if (input.location !== undefined) row.location = input.location
  if (input.employmentType !== undefined) row.employment_type = input.employmentType
  if (input.experienceLevel !== undefined) row.experience_level = input.experienceLevel
  if (input.description !== undefined) row.description = input.description
  if (input.requirements !== undefined) row.requirements = input.requirements
  if (input.skills !== undefined) row.skills = input.skills
  if (input.isActive !== undefined) row.is_active = input.isActive
  return row
}

/** Drop the Redis listing cache and the ISR pages that show jobs. */
export async function refreshPublicJobs(jobId?: string): Promise<void> {
  await invalidateJobsCache()
  revalidatePath("/careers")
  if (jobId) revalidatePath(`/careers/apply/${jobId}`)
}
