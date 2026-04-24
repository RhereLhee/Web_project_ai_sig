// app/admin/courses/[id]/page.tsx
// Locked — redirect to the (also locked) /admin/courses listing.
import { redirect } from "next/navigation"

export default async function EditCoursePage() {
  redirect("/admin/courses")
}
