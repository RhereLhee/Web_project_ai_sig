// app/api/profile/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/jwt'
import { prisma } from '@/lib/prisma'
import { isValidThaiPhone, formatPhoneNumber } from '@/lib/sms'

// ============================================
// GET - ดึงข้อมูล Profile
// ============================================

export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        image: true,
        createdAt: true,
        partner: {
          select: {
            withdrawPhone: true,
            withdrawPhoneLockedAt: true,
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // เช็คว่าเบอร์ถูกล็อคหรือยัง
    const isPhoneLocked = !!user.partner?.withdrawPhone

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        image: user.image,
        createdAt: user.createdAt,
      },
      isPhoneLocked,
      lockedPhone: user.partner?.withdrawPhone || null,
      lockedAt: user.partner?.withdrawPhoneLockedAt || null,
    })

  } catch (error) {
    console.error('Get profile error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}

// ============================================
// PUT - อัปเดต Profile
// ============================================

export async function PUT(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name, phone } = body

    // ดึงข้อมูล user ปัจจุบัน
    const currentUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        phone: true,
        partner: {
          select: {
            withdrawPhone: true,
          }
        }
      }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // ============================================
    // Validate Name
    // ============================================
    if (name !== undefined) {
      if (typeof name !== 'string') {
        return NextResponse.json({ error: 'ชื่อไม่ถูกต้อง' }, { status: 400 })
      }
      if (name.length > 100) {
        return NextResponse.json({ error: 'ชื่อยาวเกินไป (สูงสุด 100 ตัวอักษร)' }, { status: 400 })
      }
    }

    // ============================================
    // Validate Phone
    // ============================================
    let formattedPhone: string | undefined

    if (phone !== undefined && phone !== null && phone !== '') {
      // เช็คว่าเบอร์ถูกล็อคหรือไม่
      if (currentUser.partner?.withdrawPhone) {
        // ถ้ามี withdrawPhone แล้ว ไม่ให้แก้ไขเบอร์
        if (phone !== currentUser.phone) {
          return NextResponse.json({ 
            error: 'ไม่สามารถเปลี่ยนเบอร์โทรได้ เนื่องจากเบอร์ถูกล็อคจากการถอนเงิน กรุณาติดต่อ Admin' 
          }, { status: 400 })
        }
      } else {
        // ยังไม่มี withdrawPhone - อนุญาตให้แก้ไขได้
        if (!isValidThaiPhone(phone)) {
          return NextResponse.json({ error: 'เบอร์โทรศัพท์ไม่ถูกต้อง' }, { status: 400 })
        }

        formattedPhone = formatPhoneNumber(phone)

        // เช็คว่าเบอร์ซ้ำกับคนอื่นหรือไม่
        if (formattedPhone !== currentUser.phone) {
          const existingUser = await prisma.user.findFirst({
            where: {
              phone: formattedPhone,
              id: { not: payload.userId }
            }
          })

          if (existingUser) {
            return NextResponse.json({ error: 'เบอร์โทรศัพท์นี้ถูกใช้งานแล้ว' }, { status: 400 })
          }
        }
      }
    }

    // ============================================
    // Update User
    // ============================================
    const updateData: any = {}
    
    if (name !== undefined) {
      updateData.name = name.trim() || null
    }
    
    if (formattedPhone !== undefined) {
      updateData.phone = formattedPhone
    } else if (phone === '' || phone === null) {
      // ลบเบอร์โทร (ถ้ายังไม่ถูกล็อค)
      if (!currentUser.partner?.withdrawPhone) {
        updateData.phone = null
      }
    }

    // ถ้าไม่มีอะไรจะอัปเดต
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'ไม่มีข้อมูลที่จะอัปเดต' }, { status: 400 })
    }

    const updatedUser = await prisma.user.update({
      where: { id: payload.userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        image: true,
      }
    })

    return NextResponse.json({
      success: true,
      message: 'อัปเดตโปรไฟล์สำเร็จ',
      user: updatedUser,
    })

  } catch (error) {
    console.error('Update profile error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}