// app/(main)/courses/[slug]/page.tsx
// Course detail is globally locked — redirect to the (also locked) /courses listing.
// When ready to launch, restore the previous version from git history.
import { redirect } from "next/navigation"

export default async function CourseDetailPage() {
  redirect("/courses")
}
