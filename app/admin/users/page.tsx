import { prisma } from "@/lib/prisma"

async function getUsers() {
  return await prisma.user.findMany({
    include: {
      subscriptions: {
        where: { status: 'ACTIVE' },
        include: { plan: true },
        take: 1,
      },
      _count: {
        select: { referrals: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export default async function AdminUsersPage() {
  const users = await getUsers()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">จัดการสมาชิก</h1>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>สมาชิก</th>
                <th>Role</th>
                <th>แพ็กเกจ</th>
                <th>ทีม</th>
                <th>สมัครเมื่อ</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div>
                      <p className="font-medium">{user.name || '-'}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${user.role === 'ADMIN' ? 'badge-danger' : 'badge-info'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td>
                    {user.subscriptions[0] ? (
                      <span className="badge badge-success">{user.subscriptions[0].plan?.name}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td>{user._count.referrals} คน</td>
                  <td>{new Date(user.createdAt).toLocaleDateString('th-TH')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}