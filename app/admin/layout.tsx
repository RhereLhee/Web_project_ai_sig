import { requireAdmin } from "@/lib/auth"
import { AdminSidebar } from "./AdminSidebar"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <AdminSidebar />

      {/* Main content — desktop shifts right for sidebar, mobile adds top padding for header */}
      <main className="flex-1 md:ml-64 pt-14 md:pt-0 p-4 md:p-6 min-w-0">
        {children}
      </main>
    </div>
  )
}
