// app/api/auth/otp/verify/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { formatPhoneNumber } from '@/lib/sms'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    console.log('========================================')
    console.log('OTP VERIFY DEBUG - START')
    console.log('========================================')
    console.log('1. RAW REQUEST BODY:', JSON.stringify(body, null, 2))
    
    const { phone, code, type = 'REGISTER' } = body

    console.log('2. PARSED VALUES:')
    console.log('   - phone:', phone, '(type:', typeof phone, ')')
    console.log('   - code:', code, '(type:', typeof code, ')')
    console.log('   - type:', type)

    if (!phone || !code) {
      console.log('ERROR: Missing phone or code')
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบ' },
        { status: 400 }
      )
    }

    const formattedPhone = formatPhoneNumber(phone)
    console.log('3. FORMATTED PHONE:', formattedPhone)

    // ดึง OTP ทั้งหมดในระบบมาดู
    const allOtps = await prisma.otpVerification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    })
    console.log('4. ALL OTPs IN DATABASE (latest 5):')
    allOtps.forEach((otp, i) => {
      console.log(`   [${i}] id: ${otp.id}`)
      console.log(`       phone: ${otp.phone}`)
      console.log(`       code: ${otp.code}`)
      console.log(`       type: ${otp.type}`)
      console.log(`       verified: ${otp.verified}`)
      console.log(`       attempts: ${otp.attempts}`)
      console.log(`       expiresAt: ${otp.expiresAt}`)
      console.log(`       createdAt: ${otp.createdAt}`)
    })

    // Query ด้วย conditions
    console.log('5. QUERY CONDITIONS:')
    console.log('   - phone:', formattedPhone)
    console.log('   - type:', type)
    console.log('   - verified:', false)

    const otpRecord = await prisma.otpVerification.findFirst({
      where: {
        phone: formattedPhone,
        type,
        verified: false,
      },
      orderBy: { createdAt: 'desc' },
    })

    console.log('6. QUERY RESULT:', otpRecord ? JSON.stringify(otpRecord, null, 2) : 'NULL - NOT FOUND')

    if (!otpRecord) {
      console.log('ERROR: OTP record not found')
      console.log('========================================')
      return NextResponse.json(
        { error: 'ไม่พบรหัส OTP กรุณาขอรหัสใหม่' },
        { status: 400 }
      )
    }

    console.log('7. CHECKING EXPIRY:')
    console.log('   - now:', new Date())
    console.log('   - expiresAt:', otpRecord.expiresAt)
    console.log('   - expired?:', new Date() > otpRecord.expiresAt)

    if (new Date() > otpRecord.expiresAt) {
      await prisma.otpVerification.delete({ where: { id: otpRecord.id } })
      console.log('ERROR: OTP expired')
      console.log('========================================')
      return NextResponse.json(
        { error: 'รหัส OTP หมดอายุ กรุณาขอรหัสใหม่' },
        { status: 400 }
      )
    }

    console.log('8. CHECKING ATTEMPTS:', otpRecord.attempts, '>= 5?', otpRecord.attempts >= 5)

    if (otpRecord.attempts >= 5) {
      await prisma.otpVerification.delete({ where: { id: otpRecord.id } })
      console.log('ERROR: Too many attempts')
      console.log('========================================')
      return NextResponse.json(
        { error: 'ลองผิดหลายครั้งเกินไป กรุณาขอรหัสใหม่' },
        { status: 400 }
      )
    }

    console.log('9. COMPARING CODES:')
    console.log('   - DB code:', otpRecord.code, '(type:', typeof otpRecord.code, ')')
    console.log('   - Input code:', code, '(type:', typeof code, ')')
    console.log('   - Match?:', otpRecord.code === code)
    console.log('   - Strict equal?:', otpRecord.code === String(code))

    if (otpRecord.code !== code) {
      await prisma.otpVerification.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      })
      const remaining = 5 - otpRecord.attempts - 1
      console.log('ERROR: Code mismatch, remaining:', remaining)
      console.log('========================================')
      return NextResponse.json(
        { error: `รหัส OTP ไม่ถูกต้อง (เหลือ ${remaining} ครั้ง)` },
        { status: 400 }
      )
    }

    // Mark as verified
    await prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { verified: true },
    })

    console.log('SUCCESS: OTP verified!')
    console.log('========================================')

    return NextResponse.json({
      success: true,
      verificationToken: otpRecord.id,
    })

  } catch (error) {
    console.log('EXCEPTION:', error)
    console.log('========================================')
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    )
  }
}