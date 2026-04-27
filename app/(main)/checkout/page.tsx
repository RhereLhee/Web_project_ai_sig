// app/(main)/checkout/page.tsx
// Standalone checkout page is retired — Signal purchases now go through the
// CheckoutModal opened from /signals (which POSTs to /api/checkout/signal).
// Anyone who lands here gets redirected back to the package picker.
import { redirect } from "next/navigation"

export default async function CheckoutPage() {
  redirect("/signals")
}
