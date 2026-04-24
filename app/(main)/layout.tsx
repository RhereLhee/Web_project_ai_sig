// app/(main)/layout.tsx
import { getUserWithSubscription, hasPartnerBankInfo, hasSignalAccess } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/Sidebar"
import { Footer } from "@/components/Footer"
import { PipProviderWrapper } from "./PipProviderWrapper"

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getUserWithSubscription()

  if (!user) {
    redirect("/login")
  }

  // "Partner" badge in the sidebar now means the user has registered bank info
  // (not that they paid for a Partner subscription, which no longer exists).
  const hasPartner = hasPartnerBankInfo(user)
  const hasSignal = hasSignalAccess(user)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Sidebar 
        user={user} 
        hasPartner={hasPartner} 
        hasSignal={hasSignal} 
      />
      
      {/* Main Content */}
      <main className="md:ml-64 flex-1 flex flex-col">
        {/* Spacer for mobile header */}
        <div className="h-14 md:h-0 flex-shrink-0" />
        
        {/* Content with PipProvider */}
        <PipProviderWrapper hasSignal={hasSignal}>
          <div className="flex-1 p-4 md:p-6 max-w-6xl mx-auto w-full">
            {children}
          </div>
        </PipProviderWrapper>
        
        <Footer />
      </main>
    </div>
  )
}