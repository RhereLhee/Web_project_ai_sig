import { requireAdmin } from "@/lib/auth"
import Link from "next/link"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()

  const links = [
    { href: "/admin", label: "📊 Dashboard", exact: true },
    { href: "/admin/courses", label: "📚 คอร์ส" },
    { href: "/admin/videos", label: "🎬 วิดีโอ" },
    { href: "/admin/users", label: "👥 สมาชิก" },
    { href: "/admin/orders", label: "💳 ออเดอร์" },
    { href: "/admin/stats", label: "📈 สถิติ" },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="sidebar w-60 bg-white border-r border-gray-200">
        <div className="p-4 border-b">
          <Link href="/admin" className="text-xl font-bold gradient-text">
            Admin Panel
          </Link>
        </div>
        
        <nav className="p-2">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="sidebar-link">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
          <Link href="/dashboard" className="sidebar-link text-emerald-600">
            ← กลับหน้าหลัก
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  )
}