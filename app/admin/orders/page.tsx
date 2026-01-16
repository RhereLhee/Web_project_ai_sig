// app/admin/orders/page.tsx
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { ApproveOrderButton } from "./ApproveOrderButton"
import Image from "next/image"

interface Props {
  searchParams: { status?: string; type?: string; page?: string }
}

async function getOrders(status?: string, type?: string, page: number = 1) {
  const take = 20
  const skip = (page - 1) * take

  const where: any = {}
  if (status && status !== 'ALL') {
    where.status = status
  }
  if (type && type !== 'ALL') {
    where.orderType = type
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        user: { select: { name: true, email: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.order.count({ where }),
  ])

  return { orders, total, pages: Math.ceil(total / take) }
}

export default async function AdminOrdersPage({ searchParams }: Props) {
  const params = await searchParams
  const page = parseInt(params.page || '1')
  const { orders, total, pages } = await getOrders(params.status, params.type, page)

  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    PAID: 'bg-emerald-100 text-emerald-700',
    FAILED: 'bg-red-100 text-red-700',
    REFUNDED: 'bg-gray-100 text-gray-700',
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">จัดการออเดอร์ ({total})</h1>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4 space-y-3">
        <div className="flex gap-2 flex-wrap">
          <span className="text-sm text-gray-500 py-1.5">สถานะ:</span>
          {['ALL', 'PENDING', 'PAID', 'FAILED', 'REFUNDED'].map((s) => (
            <Link
              key={s}
              href={`/admin/orders?status=${s}&type=${params.type || 'ALL'}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                (params.status || 'ALL') === s
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s === 'ALL' ? 'ทั้งหมด' : s}
            </Link>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          <span className="text-sm text-gray-500 py-1.5">ประเภท:</span>
          {['ALL', 'PARTNER', 'SIGNAL'].map((t) => (
            <Link
              key={t}
              href={`/admin/orders?status=${params.status || 'ALL'}&type=${t}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                (params.type || 'ALL') === t
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t === 'ALL' ? 'ทั้งหมด' : t}
            </Link>
          ))}
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {orders.map((order) => {
          const metadata = order.metadata as any
          return (
            <div key={order.id} className="bg-white rounded-lg border overflow-hidden">
              <div className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                        {order.orderNumber}
                      </code>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        order.orderType === 'PARTNER' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {order.orderType}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[order.status]}`}>
                        {order.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {new Date(order.createdAt).toLocaleString('th-TH')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-gray-900">
                      ฿{(order.finalAmount / 100).toLocaleString()}
                    </p>
                    {metadata?.months && (
                      <p className="text-xs text-gray-500">
                        {metadata.months} เดือน {metadata.bonus > 0 && `(+${metadata.bonus} ฟรี)`}
                      </p>
                    )}
                  </div>
                </div>

                {/* User Info */}
                <div className="bg-gray-50 rounded-lg p-3 mb-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">ชื่อ:</span>{' '}
                      <span className="font-medium">{order.user.name || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">อีเมล:</span>{' '}
                      <span className="font-medium">{order.user.email}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">โทร:</span>{' '}
                      <span className="font-medium">{order.user.phone || '-'}</span>
                    </div>
                  </div>
                </div>

                {/* Slip Image */}
                {order.slipUrl && (
                  <div className="mb-3">
                    <p className="text-sm text-gray-500 mb-2">หลักฐานการโอนเงิน:</p>
                    <a 
                      href={order.slipUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-block"
                    >
                      <img
                        src={order.slipUrl}
                        alt="Payment Slip"
                        className="max-w-xs max-h-64 rounded-lg border border-gray-200 hover:border-emerald-500 transition-colors"
                      />
                    </a>
                  </div>
                )}

                {/* No Slip Warning */}
                {order.status === 'PENDING' && !order.slipUrl && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                    <p className="text-sm text-yellow-700">
                      ⚠️ ยังไม่ได้อัพโหลดหลักฐานการโอนเงิน
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t">
                  {order.status === 'PENDING' && order.slipUrl && (
                    <ApproveOrderButton orderId={order.id} orderType={order.orderType} />
                  )}
                  {order.status === 'PENDING' && !order.slipUrl && (
                    <span className="text-sm text-gray-400">รอลูกค้าอัพโหลดสลิป</span>
                  )}
                  {order.status === 'PAID' && (
                    <span className="text-sm text-emerald-600 font-medium">✅ อนุมัติแล้ว</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {orders.length === 0 && (
        <div className="bg-white rounded-lg border p-8 text-center">
          <p className="text-gray-500">ไม่มีออเดอร์</p>
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: Math.min(pages, 10) }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/orders?page=${p}&status=${params.status || 'ALL'}&type=${params.type || 'ALL'}`}
              className={`px-3 py-1 rounded ${p === page ? 'bg-gray-900 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}