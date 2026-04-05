import { requireAdmin } from "@/lib/auth"
import Link from "next/link"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()

  const menuGroups = [
    {
      title: "ภาพรวม",
      items: [
        { href: "/admin", label: "Dashboard", icon: "📊" },
        { href: "/admin/stats", label: "สถิติ", icon: "📈" },
      ]
    },
    {
      title: "จัดการ",
      items: [
        { href: "/admin/users", label: "สมาชิก", icon: "👥" },
        { href: "/admin/orders", label: "ออเดอร์", icon: "💳" },
        { href: "/admin/withdrawals", label: "ถอนเงิน", icon: "💸" },
      ]
    },
    {
      title: "Signal",
      items: [
        { href: "/admin/signal-settings", label: "จัดการ Signal", icon: "📡" },
      ]
    },
    {
      title: "คอนเทนต์",
      items: [
        { href: "/admin/courses", label: "คอร์ส", icon: "📚" },
      ]
    },
    {
      title: "ระบบ",
      items: [
        { href: "/admin/system", label: "System Controls", icon: "🎛️" },
        { href: "/admin/settings", label: "ตั้งค่า 2FA", icon: "⚙️" },
        { href: "/admin/logs", label: "System Logs", icon: "📋" },
      ]
    },
  ]

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col fixed h-full">
        <div className="p-4 border-b border-gray-700">
          <Link href="/admin" className="text-xl font-bold text-emerald-400">
            🛡️ Admin Panel
          </Link>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-2">
          {menuGroups.map((group) => (
            <div key={group.title} className="mb-4">
              <p className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {group.title}
              </p>
              {group.items.map((item) => (
                <Link 
                  key={item.href} 
                  href={item.href} 
                  className="flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-700">
          <Link href="/dashboard" className="flex items-center space-x-2 text-gray-400 hover:text-white">
            <span>←</span>
            <span>กลับหน้าหลัก</span>
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ml-64 p-6">
        {children}
      </main>
    </div>
  )
}
