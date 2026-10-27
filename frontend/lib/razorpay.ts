import { createOrder, verifyPayment, type PaymentConfirmation } from "./api"
import type { User } from "./types"

// Razorpay Checkout (https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/).
// The script is loaded on demand from Razorpay's CDN; next.config.js allows it in the CSP.
const SCRIPT = "https://checkout.razorpay.com/v1/checkout.js"

interface RazorpayInstance {
  open(): void
}
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance
  }
}

let loading: Promise<void> | null = null
function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve()
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script")
    s.src = SCRIPT
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      loading = null
      s.remove()
      reject(new Error("Couldn't reach Razorpay. Check your connection and try again."))
    }
    document.body.appendChild(s)
  })
  return loading
}

export type CheckoutResult =
  | { status: "paid"; user: User }
  | { status: "dismissed" }

/**
 * Runs the whole purchase: the API creates the order (and fixes the amount), Checkout collects
 * the payment, and the API verifies it with Razorpay before granting Pro. Rejects with a
 * user-facing message on failure.
 */
export async function buyPro(): Promise<CheckoutResult> {
  const [order] = await Promise.all([createOrder(), loadCheckout()])
  if (!window.Razorpay) throw new Error("Couldn't start Razorpay Checkout. Please try again.")
  const Razorpay = window.Razorpay

  return new Promise<CheckoutResult>((resolve, reject) => {
    const rzp = new Razorpay({
      key: order.key_id,
      order_id: order.order_id,
      amount: order.amount,
      currency: order.currency,
      name: "LexGuard",
      description: `Pro · ${order.days} days`,
      prefill: order.prefill,
      theme: { color: "#F2551F" },
      // A failed attempt is shown inside the modal and the user can retry there, so the only
      // outcomes that reach us are success (handler) and closing the modal (ondismiss).
      retry: { enabled: true },
      handler: (confirmation: PaymentConfirmation) => {
        verifyPayment(confirmation).then((user) => resolve({ status: "paid", user }), reject)
      },
      modal: { ondismiss: () => resolve({ status: "dismissed" }), confirm_close: true },
    })
    rzp.open()
  })
}
