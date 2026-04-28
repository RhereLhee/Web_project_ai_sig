// app/admin/orders/page.tsx
// Admin order review — focused on PENDING slip approval flow.
//
// Banking-grade additions:
//   - EXPECTED AMOUNT (finalAmount + amountSuffix 1-99 satang) — must match bank credit EXACTLY
//   - SlipVerification status (SlipOK raw result) — VERIFIED/REJECTED/PENDING
//   - BankTransaction link — shows if SlipOK matched a bank credit to this order
//   - Expiry badge — PENDING orders past expiresAt are stale
//   - First-payment flag — affects whether affiliate distribution will fire

// Always re-fetch from DB — order state changes frequently (slip uploads, approvals).
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { ApproveOrderButton } from './ApproveOrderButton'
import type { Prisma } from '@prisma/client'

interface Props {
  searchParams: Promise<{ status?: string; type?: string; page?: string; q?: string }>
}

async function getOrders(
  status?: string,
  type?: string,
  q?: string,
  page: number = 1,
) {
  const take = 20
  const skip = (page - 1) * take

  const where: Prisma.OrderWhereInput = {}
  if (status && status !== 'ALL') where.status = status as Prisma.OrderWhereInput['status']
  if (type && type !== 'ALL') where.orderType = type

  if (q && q.trim()) {
    const term = q.trim()
    where.OR = [
      { orderNumber: { contains: term, mode: 'insensitive' } },
      { user: { email: { contains: term, mode: 'insensitive' } } },
      { user: { name: { contains: term, mode: 'insensitive' } } },
      { user: { phone: { contains: term } } },
    ]
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        user: { select: { name: true, email: true, phone: true } },
        slipVerifications: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            amountSatang: true,
            senderBank: true,
            senderName: true,
            senderAccount: true,
            transferAt: true,
            errorMessage: true,
            reviewedBy: true,
            reviewedAt: true,
            providerRef: true,
          },
        },
        bankTransaction: {
          select: {
            id: true,
            bankRef: true,
            amountSatang: true,
            receivedAt: true,
            senderBank: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.order.count({ where }),
  ])

  return { orders, total, pages: Math.ceil(total / take) }
}

function formatBaht(satang: number) {
  return (satang / 100).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  PAID: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-red-100 text-red-700',
  REFUNDED: 'bg-gray-100 text-gray-700',
}

const SLIP_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'รอตรวจด้วยมือ', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  VERIFIED: { label: 'SlipOK ยืนยัน', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  MATCHED: { label: 'จับคู่ Order แล้ว', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECTED: { label: 'สลิปไม่ผ่าน', cls: 'bg-red-50 text-red-700 border-red-200' },
  UNMATCHED: { label: 'ไม่พบออเดอร์', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  DUPLICATE: { label: 'สลิปซ้ำ', cls: 'bg-red-50 text-red-700 border-red-200' },
}

export default async function AdminOrdersPage({ searchParams }: Props) {
  const params = await searchParams
  const page = parseInt(params.page || '1')
  const { orders, total, pages } = await getOrders(
    params.status,
    params.type,
    params.q,
    page,
  )
  const now = new Date()

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">จัดการออเดอร์ ({total})</h1>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4 space-y-3">
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-sm text-gray-500 py-1.5">สถานะ:</span>
          {['ALL', 'PENDING', 'PAID', 'FAILED', 'REFUNDED'].map((s) => (
            <Link
              key={s}
              href={`/admin/orders?status=${s}&type=${params.type || 'ALL'}${params.q ? `&q=${encodeURIComponent(params.q)}` : ''}`}
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
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-sm text-gray-500 py-1.5">ประเภท:</span>
          {['ALL', 'PARTNER', 'SIGNAL'].map((t) => (
            <Link
              key={t}
              href={`/admin/orders?status=${params.status || 'ALL'}&type=${t}${params.q ? `&q=${encodeURIComponent(params.q)}` : ''}`}
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
        <form className="flex gap-2 flex-wrap items-center" action="/admin/orders">
          <input type="hidden" name="status" value={params.status || 'ALL'} />
          <input type="hidden" name="type" value={params.type || 'ALL'} />
          <input
            name="q"
            defaultValue={params.q || ''}
            placeholder="ค้นหา order number / อีเมล / เบอร์โทร"
            className="flex-1 min-w-[240px] px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700"
          >
            ค้นหา
          </button>
          {params.q && (
            <Link
              href={`/admin/orders?status=${params.status || 'ALL'}&type=${params.type || 'ALL'}`}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              ล้าง
            </Link>
          )}
        </form>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {orders.map((order) => {
          const metadata = order.metadata as Record<string, unknown> | null
          const slip = order.slipVerifications[0]
          const bankTx = order.bankTransaction

          const expected =
            order.expectedAmountSatang > 0 ? order.expectedAmountSatang : order.finalAmount
          const isExpired =
            order.status === 'PENDING' && order.expiresAt != null && order.expiresAt < now

          // Amount match: slip satang OR bank satang vs expected
          const slipMatches = slip?.amountSatang === expected
          const bankMatches = bankTx?.amountSatang === expected

          return (
            <div key={order.id} className="bg-white rounded-lg border overflow-hidden">
              <div className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3 flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                        {order.orderNumber}
                      </code>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          order.orderType === 'PARTNER'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {order.orderType}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[order.status]}`}
                      >
                        {order.status}
                      </span>
                      {isExpired && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                          หมดอายุ
                        </span>
                      )}
                      {order.isFirstPayment && order.status === 'PENDING' && (
                        <span
                          title="จะได้ commission แจกให้ upline เมื่ออนุมัติ"
                          className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800"
                        >
                          ⚡ First Payment
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {new Date(order.createdAt).toLocaleString('th-TH')}
                      {order.expiresAt && order.status === 'PENDING' && (
                        <>
                          {' '}
                          · หมดอายุ {new Date(order.expiresAt).toLocaleString('th-TH')}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-gray-900 font-mono">
                      ฿{formatBaht(expected)}
                    </p>
                    {order.amountSuffix > 0 && (
                      <p className="text-xs text-gray-500">
                        ฐาน ฿{formatBaht(order.finalAmount)} + {order.amountSuffix} สตางค์
                      </p>
                    )}
                    {metadata?.months != null && (
                      <p className="text-xs text-gray-500">
                        {String(metadata.months)} เดือน
                        {typeof metadata.bonus === 'number' && metadata.bonus > 0
                          ? ` (+${metadata.bonus} ฟรี)`
                          : ''}
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
                      <span className="font-medium break-all">{order.user.email}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">โทร:</span>{' '}
                      <span className="font-mono">{order.user.phone || '-'}</span>
                    </div>
                  </div>
                </div>

                {/* Slip + Verification */}
                {(slip || order.slipUrl) && (
                  <div className="grid grid-cols-1 md:grid-cols-[auto,1fr] gap-4 mb-3">
                    {order.slipUrl && (
                      <a
                        href={order.slipUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={order.slipUrl}
                          alt="Payment Slip"
                          className="max-w-[200px] max-h-64 rounded-lg border border-gray-200 hover:border-emerald-500 transition-colors"
                        />
                      </a>
                    )}

                    <div className="space-y-2 min-w-0">
                      {slip ? (
                        <div
                          className={`rounded-lg border p-3 text-sm ${SLIP_STATUS[slip.status]?.cls || 'bg-gray-50 text-gray-700'}`}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="font-medium">
                              {SLIP_STATUS[slip.status]?.label || slip.status}
                            </span>
                            {slip.providerRef && (
                              <code className="text-xs font-mono opacity-70">
                                {slip.providerRef}
                              </code>
                            )}
                          </div>
                          {slip.amountSatang != null && (
                            <p className="mt-1">
                              ยอดในสลิป:{' '}
                              <span className="font-mono font-semibold">
                                ฿{formatBaht(slip.amountSatang)}
                              </span>{' '}
                              {slipMatches ? (
                                <span className="text-emerald-700 font-medium">
                                  ✓ ตรงยอด
                                </span>
                              ) : (
                                <span className="text-red-700 font-medium">
                                  ✗ ไม่ตรง (ต่างไป ฿
                                  {formatBaht(Math.abs(slip.amountSatang - expected))})
                                </span>
                              )}
                            </p>
                          )}
                          {(slip.senderBank || slip.senderName) && (
                            <p className="mt-1 text-xs">
                              จาก: {slip.senderBank || '-'} ·{' '}
                              {slip.senderName || slip.senderAccount || '-'}
                            </p>
                          )}
                          {slip.transferAt && (
                            <p className="mt-1 text-xs opacity-70">
                              โอนเมื่อ {new Date(slip.transferAt).toLocaleString('th-TH')}
                            </p>
                          )}
                          {slip.errorMessage && (
                            <p className="mt-1 text-xs font-medium">
                              ข้อผิดพลาด: {slip.errorMessage}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                          อัพโหลดแบบ manual (ยังไม่เรียก SlipOK)
                        </div>
                      )}

                      {bankTx && (
                        <div
                          className={`rounded-lg border p-3 text-sm ${
                            bankMatches
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : 'bg-yellow-50 border-yellow-200 text-yellow-800'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="font-medium">
                              {bankMatches ? '✓ ตรงยอดกับธนาคาร' : '⚠ ยอดไม่ตรงกับธนาคาร'}
                            </span>
                            <code className="text-xs font-mono opacity-70">
                              {bankTx.bankRef}
                            </code>
                          </div>
                          <p className="mt-1">
                            ธนาคารยืนยัน:{' '}
                            <span className="font-mono font-semibold">
                              ฿{formatBaht(bankTx.amountSatang)}
                            </span>{' '}
                            · {new Date(bankTx.receivedAt).toLocaleString('th-TH')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* No Slip Warning */}
                {order.status === 'PENDING' && !order.slipUrl && !isExpired && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                    <p className="text-sm text-yellow-700">
                      ยังไม่ได้อัพโหลดหลักฐานการโอนเงิน
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t flex-wrap">
                  {order.status === 'PENDING' && order.slipUrl && (
                    <>
                      <ApproveOrderButton orderId={order.id} orderType={order.orderType} />
                      {!slipMatches && slip?.amountSatang != null && (
                        <span className="text-xs text-red-600">
                          ⚠ ยอดสลิปไม่ตรงกับที่ระบบคาดไว้ — ตรวจให้แน่ก่อนอนุมัติ
                        </span>
                      )}
                    </>
                  )}
                  {order.status === 'PENDING' && !order.slipUrl && (
                    <span className="text-sm text-gray-400">รอลูกค้าอัพโหลดสลิป</span>
                  )}
                  {order.status === 'PAID' && (
                    <span className="text-sm text-emerald-600 font-medium">
                      อนุมัติแล้ว
                      {order.paidAt && (
                        <span className="text-gray-500 ml-2 font-normal">
                          {new Date(order.paidAt).toLocaleString('th-TH')}
                        </span>
                      )}
                    </span>
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
              href={`/admin/orders?page=${p}&status=${params.status || 'ALL'}&type=${params.type || 'ALL'}${params.q ? `&q=${encodeURIComponent(params.q)}` : ''}`}
              className={`px-3 py-1 rounded ${
                p === page ? 'bg-gray-900 text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
