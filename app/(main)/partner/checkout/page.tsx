// app/(main)/partner/checkout/page.tsx
// Partner is no longer a paid product — this route is retired.
// Redirect to the main Partner dashboard, which now shows the free bank-info form.
import { redirect } from "next/navigation"

export default async function PartnerCheckoutPage() {
  redirect("/partner")
}
