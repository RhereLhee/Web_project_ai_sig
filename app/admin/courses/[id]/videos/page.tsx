// app/admin/courses/[id]/videos/page.tsx
// Locked — redirect to the (also locked) /admin/courses listing.
import { redirect } from "next/navigation"

export default async function VideosPage() {
  redirect("/admin/courses")
}
