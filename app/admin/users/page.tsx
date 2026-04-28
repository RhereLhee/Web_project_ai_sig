import { prisma } from "@/lib/prisma"
import Link from "next/link"

interface Props {
  searchParams: Promise<{ role?: string; search?: string; page?: string }>
}

async function getUsers(role?: string, search?: string, page: number = 1) {
  const take = 20
  const skip = (page - 1) * take

  const where: any = {}
  
  if (role && role !== 'ALL') {
    where.role = role
  }
  
  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ]
  }

  const users = await prisma.user.findMany({
    where,
    include: {
      partner: true,
      signalSubscriptions: {
        where: { status: 'ACTIVE' },
        take: 1,
      },
      _count: {
        select: { referrals: true, orders: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take,
    skip,
  })
  
  const total = await prisma.user.count({ where })

  return { users, total, pages: Math.ceil(total / take) }
}

export default async function AdminUsersPage({ searchParams }: Props) {
  // Next.js 15: searchParams is a Promise, must await
  const params = await searchParams
  const page = parseInt(params.page || '1')
  const { users, total, pages } = await getUsers(params.role, params.search, page)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">จัดการสมาชิก ({total})</h1>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4">
        <form className="flex flex-wrap gap-4">
          <input
            type="text"
            name="search"
            placeholder="ค้นหา email หรือชื่อ..."
            defaultValue={params.search}
            className="px-3 py-2 border rounded-lg text-sm w-full sm:w-64"
          />
          <select name="role" defaultValue={params.role} className="px-3 py-2 border rounded-lg text-sm">
            <option value="ALL">ทุก Role</option>
            <option value="USER">USER</option>
            <option value="PARTNER">PARTNER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          <button type="submit" className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm">
            ค้นหา
          </button>
        </form>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {users.length === 0 && (
          <p className="text-center text-gray-500 py-8 bg-white rounded-lg border">ไม่พบสมาชิก</p>
        )}
        {users.map((user) => {
          const hasPartner = user.partner?.status === 'ACTIVE'
          const hasSignal = user.signalSubscriptions.length > 0
          return (
            <Link
              key={user.id}
              href={`/admin/users/${user.id}`}
              className="block bg-white rounded-lg border p-3 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{user.name || '-'}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${
                  user.role === 'ADMIN' ? 'bg-red-100 text-red-700' :
                  user.role === 'PARTNER' ? 'bg-purple-100 text-purple-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {user.role}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                <span>ทีม {user._count.referrals}</span>
                <span>ออเดอร์ {user._count.orders}</span>
                <span>{new Date(user.createdAt).toLocaleDateString('th-TH')}</span>
                <div className="flex gap-1 ml-auto">
                  {hasPartner && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">P</span>}
                  {hasSignal && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">S</span>}
                </div>
              </div>
            </Link>
          )
        })}
        {pages > 1 && (
          <div className="flex justify-center gap-2 pt-2">
            {Array.from({ length: Math.min(pages, 10) }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={`/admin/users?page=${p}&role=${params.role || ''}&search=${params.search || ''}`}
                className={`px-3 py-1 rounded text-sm ${p === page ? 'bg-gray-900 text-white' : 'bg-white border hover:bg-gray-50'}`}
              >
                {p}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3 font-medium">สมาชิก</th>
                <th className="text-left p-3 font-medium">Role</th>
                <th className="text-left p-3 font-medium">สถานะ</th>
                <th className="text-left p-3 font-medium">ทีม</th>
                <th className="text-left p-3 font-medium">ออเดอร์</th>
                <th className="text-left p-3 font-medium">สมัครเมื่อ</th>
                <th className="text-left p-3 font-medium">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((user) => {
                const hasPartner = user.partner?.status === 'ACTIVE'
                const hasSignal = user.signalSubscriptions.length > 0
                return (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="p-3">
                      <p className="font-medium">{user.name || '-'}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        user.role === 'ADMIN' ? 'bg-red-100 text-red-700' :
                        user.role === 'PARTNER' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {hasPartner && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">Partner</span>}
                        {hasSignal && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Signal</span>}
                        {!hasPartner && !hasSignal && <span className="text-gray-400 text-xs">Free</span>}
                      </div>
                    </td>
                    <td className="p-3">{user._count.referrals}</td>
                    <td className="p-3">{user._count.orders}</td>
                    <td className="p-3 text-gray-500">{new Date(user.createdAt).toLocaleDateString('th-TH')}</td>
                    <td className="p-3">
                      <Link href={`/admin/users/${user.id}`} className="text-emerald-600 hover:underline text-sm">
                        ดูรายละเอียด
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <p className="text-center text-gray-500 py-8">ไม่พบสมาชิก</p>
        )}

        {pages > 1 && (
          <div className="flex justify-center gap-2 p-4 border-t">
            {Array.from({ length: Math.min(pages, 10) }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={`/admin/users?page=${p}&role=${params.role || ''}&search=${params.search || ''}`}
                className={`px-3 py-1 rounded ${p === page ? 'bg-gray-900 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
              >
                {p}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}