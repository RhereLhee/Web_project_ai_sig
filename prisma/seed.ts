import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // สร้าง Admin
  const adminPassword = await bcrypt.hash('admin123456', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@techtrade.io' },
    update: {},
    create: {
      email: 'admin@techtrade.io',
      password: adminPassword,
      name: 'Admin',
      role: 'ADMIN',
    },
  })
  console.log('✅ Admin:', admin.email)

  // สร้าง Demo User
  const demoPassword = await bcrypt.hash('demo123456', 10)
  const demo = await prisma.user.upsert({
    where: { email: 'demo@techtrade.io' },
    update: {},
    create: {
      email: 'demo@techtrade.io',
      password: demoPassword,
      name: 'Demo User',
      role: 'USER',
    },
  })
  console.log('✅ Demo:', demo.email)

  // ============================================
  // COURSES
  // ============================================

  // FREE - Finance
  await prisma.course.upsert({
    where: { slug: 'free-finance-basics' },
    update: {},
    create: {
      title: 'พื้นฐานการเงินสำหรับมือใหม่',
      slug: 'free-finance-basics',
      description: 'เรียนรู้พื้นฐานการเงินส่วนบุคคล การออม การลงทุน',
      type: 'FINANCE',
      access: 'FREE',
      order: 1,
      isPublished: true,
      sections: {
        create: [
          {
            title: 'บทนำ',
            order: 1,
            videos: {
              create: [
                { title: 'ทำไมต้องเรียนรู้การเงิน', order: 1, provider: 'youtube', videoId: 'dQw4w9WgXcQ', duration: 600 },
                { title: 'เป้าหมายทางการเงิน', order: 2, provider: 'youtube', videoId: 'dQw4w9WgXcQ', duration: 480 },
              ]
            }
          },
        ]
      }
    }
  })

  // FREE - Trading
  await prisma.course.upsert({
    where: { slug: 'free-trading-basics' },
    update: {},
    create: {
      title: 'พื้นฐานการเทรดสำหรับมือใหม่',
      slug: 'free-trading-basics',
      description: 'เรียนรู้พื้นฐานการเทรด Forex สำหรับผู้เริ่มต้น',
      type: 'TRADING',
      access: 'FREE',
      order: 2,
      isPublished: true,
      sections: {
        create: [
          {
            title: 'รู้จักตลาด',
            order: 1,
            videos: {
              create: [
                { title: 'ตลาด Forex คืออะไร', order: 1, provider: 'youtube', videoId: 'dQw4w9WgXcQ', duration: 600 },
                { title: 'คู่เงินหลักที่ควรรู้', order: 2, provider: 'youtube', videoId: 'dQw4w9WgXcQ', duration: 480 },
              ]
            }
          },
        ]
      }
    }
  })

  // PRO - Finance
  await prisma.course.upsert({
    where: { slug: 'pro-finance-advanced' },
    update: {},
    create: {
      title: 'การลงทุนขั้นสูง',
      slug: 'pro-finance-advanced',
      description: 'เทคนิคการลงทุนขั้นสูง การจัดพอร์ต',
      type: 'FINANCE',
      access: 'PRO',
      order: 3,
      isPublished: true,
      sections: {
        create: [
          {
            title: 'การจัดพอร์ต',
            order: 1,
            videos: {
              create: [
                { title: 'Asset Allocation', order: 1, provider: 'youtube', videoId: 'dQw4w9WgXcQ', duration: 1200 },
              ]
            }
          }
        ]
      }
    }
  })

  // PRO - Trading
  await prisma.course.upsert({
    where: { slug: 'pro-trading-strategy' },
    update: {},
    create: {
      title: 'กลยุทธ์การเทรดขั้นสูง',
      slug: 'pro-trading-strategy',
      description: 'เรียนรู้กลยุทธ์ Price Action, SMC',
      type: 'TRADING',
      access: 'PRO',
      order: 4,
      isPublished: true,
      sections: {
        create: [
          {
            title: 'Price Action',
            order: 1,
            videos: {
              create: [
                { title: 'Price Action คืออะไร', order: 1, provider: 'youtube', videoId: 'dQw4w9WgXcQ', duration: 1500 },
              ]
            }
          },
        ]
      }
    }
  })

  // PARTNER - Finance
  await prisma.course.upsert({
    where: { slug: 'partner-finance-exclusive' },
    update: {},
    create: {
      title: 'สร้างธุรกิจการเงิน',
      slug: 'partner-finance-exclusive',
      description: 'เรียนรู้การสร้างธุรกิจในสายการเงิน',
      type: 'FINANCE',
      access: 'PARTNER',
      order: 5,
      isPublished: true,
      sections: {
        create: [
          {
            title: 'เริ่มต้นธุรกิจ',
            order: 1,
            videos: {
              create: [
                { title: 'โอกาสในธุรกิจการเงิน', order: 1, provider: 'youtube', videoId: 'dQw4w9WgXcQ', duration: 900 },
              ]
            }
          }
        ]
      }
    }
  })

  // PARTNER - Trading
  await prisma.course.upsert({
    where: { slug: 'partner-trading-exclusive' },
    update: {},
    create: {
      title: 'สร้างทีมเทรดเดอร์',
      slug: 'partner-trading-exclusive',
      description: 'วิธีสร้างทีมและ Community เทรดเดอร์',
      type: 'TRADING',
      access: 'PARTNER',
      order: 6,
      isPublished: true,
      sections: {
        create: [
          {
            title: 'สร้าง Community',
            order: 1,
            videos: {
              create: [
                { title: 'สร้าง Community เทรดเดอร์', order: 1, provider: 'youtube', videoId: 'dQw4w9WgXcQ', duration: 1500 },
              ]
            }
          }
        ]
      }
    }
  })

  console.log('✅ Courses created')

  console.log('\n🎉 Seed completed!\n')
  console.log('Test accounts:')
  console.log('  Admin: admin@techtrade.io / admin123456')
  console.log('  Demo:  demo@techtrade.io / demo123456')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })