"use client"

import { useCallback, useEffect, useState } from "react"
import { getBilling } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { buyPro } from "@/lib/razorpay"
import { FEATURE_PITCH, PRO_FEATURES } from "@/lib/plans"
import { daysUntil, formatDate, formatMoney } from "@/lib/utils"
import AppShell from "@/components/AppShell"
import type { BillingStatus } from "@/lib/types"

const serif = "var(--serif)"
const bigNumber: React.CSSProperties = { fontFamily: serif, fontSize: "clamp(56px,6vw,88px)", lineHeight: 0.9, letterSpacing: "-0.04em" }
const label: React.CSSProperties = { font: "500 12px/1 var(--mono)", letterSpacing: ".08em", color: "var(--t2)" }

const METHOD: Record<string, string> = { upi: "UPI", card: "Card", netbanking: "Netbanking", wallet: "Wallet", emi: "EMI", paylater: "Pay later" }

export default function BillingPage() {
  const { user, refresh } = useAuth()
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [pitch, setPitch] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paid, setPaid] = useState(false)

  const load = useCallback(() => getBilling().then(setStatus).catch((e) => setError((e as Error).message)), [])

  useEffect(() => {
    if (user) load()
  }, [user, load])

  useEffect(() => {
    setPitch(FEATURE_PITCH[new URLSearchParams(window.location.search).get("feature") ?? ""] ?? null)
  }, [])

  async function checkout() {
    setBusy(true)
    setError(null)
    try {
      const result = await buyPro()
      if (result.status === "paid") {
        await refresh(result.user)
        await load()
        setPaid(true)
        setPitch(null)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const pro = status?.user.plan === "pro" && status.user.pro_until
  const price = status ? formatMoney(status.price.amount, status.price.currency) : ""
  const usage = status?.usage

  return (
    <AppShell>
      <main style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "clamp(40px,6vw,80px) clamp(20px,4vw,48px) 80px", display: "flex", flexDirection: "column", gap: "clamp(48px,6vw,80px)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h1 style={{ margin: 0, fontFamily: serif, fontWeight: 400, fontSize: "clamp(48px,6vw,80px)", lineHeight: 0.95, letterSpacing: "-0.04em" }}>Plan</h1>
            {pitch && <p style={{ margin: 0, fontSize: 17, color: "var(--t1)", maxWidth: 560 }}>{pitch}</p>}
            {paid && pro && (
              <p role="status" style={{ margin: 0, fontSize: 17, maxWidth: 560 }}>
                <span style={{ color: "var(--acctx)", fontWeight: 500 }}>Payment received.</span> You’re on Pro until {formatDate(status!.user.pro_until!)}.
              </p>
            )}
          </div>

          {status && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,360px),1fr))", gap: "clamp(32px,5vw,80px)" }}>
              {/* ── Current plan ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: 28, borderTop: "2px solid var(--t0)", paddingTop: 28 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16 }}>
                  <span style={{ fontSize: 18, fontWeight: 500 }}>Your plan</span>
                  <span style={bigNumber}>{pro ? "Pro" : "Free"}</span>
                </div>
                {pro ? (
                  <div style={{ display: "flex", flexDirection: "column", fontSize: 16, color: "var(--t1)" }}>
                    <span style={{ padding: "12px 0", borderBottom: "1px solid var(--bd0)", display: "flex", justifyContent: "space-between", gap: 16 }}>
                      <span>Active until</span><span style={{ color: "var(--t0)" }}>{formatDate(status.user.pro_until!)}</span>
                    </span>
                    <span style={{ padding: "12px 0", borderBottom: "1px solid var(--bd0)", display: "flex", justifyContent: "space-between", gap: 16 }}>
                      <span>Days left</span><span style={{ color: "var(--t0)" }}>{daysUntil(status.user.pro_until!)}</span>
                    </span>
                    <span style={{ padding: "12px 0", borderBottom: "1px solid var(--bd0)" }}>Doesn’t renew on its own. Add more days whenever you like.</span>
                  </div>
                ) : (
                  usage && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, fontSize: 16 }}>
                        <span style={{ color: "var(--t1)" }}>Contracts this month</span>
                        <span style={{ font: "500 14px var(--mono)" }}>{usage.used} / {usage.limit}</span>
                      </div>
                      <div style={{ height: 2, background: "var(--bd1)", borderRadius: 1, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min(100, (usage.used / usage.limit) * 100)}%`, background: "var(--acc)" }} />
                      </div>
                      <span style={{ fontSize: 14, color: "var(--t2)" }}>Resets {formatDate(usage.resets_at)}</span>
                    </div>
                  )
                )}
              </div>

              {/* ── Pro ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: 28, borderTop: "2px solid var(--acc)", paddingTop: 28 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16 }}>
                  <span style={{ fontSize: 18, fontWeight: 500 }}>Pro</span>
                  <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={bigNumber}>{price}</span>
                    <span style={{ fontSize: 15, color: "var(--t2)" }}>/ {status.price.days} days</span>
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", fontSize: 16, color: "var(--t1)" }}>
                  {PRO_FEATURES.map((f) => <span key={f} style={{ padding: "12px 0", borderBottom: "1px solid var(--bd0)" }}>{f}</span>)}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px 20px" }}>
                  <button
                    type="button"
                    className="lg-btn-acc"
                    onClick={checkout}
                    disabled={busy}
                    style={{ font: "500 15px var(--sans)", background: "var(--acc)", color: "var(--onacc)", border: 0, padding: "14px 26px", borderRadius: 999, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1, whiteSpace: "nowrap" }}
                  >
                    {busy ? "Opening Razorpay…" : pro ? `Add ${status.price.days} days · ${price}` : `Get Pro · ${price}`}
                  </button>
                  <span style={{ fontSize: 13, color: "var(--t2)" }}>One-time payment. UPI, cards and netbanking via Razorpay.</span>
                </div>
                {error && <div role="alert" style={{ marginTop: -12, fontSize: 14, color: "var(--acctx)" }}>{error}</div>}
              </div>
            </div>
          )}

          {/* ── History ── */}
          {status && status.payments.length > 0 && (
            <div>
              <div style={{ ...label, paddingBottom: 14, borderBottom: "1px solid var(--bd1)" }}>PAYMENTS</div>
              {status.payments.map((p) => (
                <div key={p.order_id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", gap: "clamp(16px,3vw,48px)", alignItems: "center", padding: "20px 8px", borderBottom: "1px solid var(--bd0)" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 500 }}>Pro · {p.days} days</div>
                    <div style={{ fontSize: 14, color: "var(--t2)", marginTop: 2 }}>
                      {p.paid_at ? formatDate(p.paid_at) : "–"}{p.method ? ` · ${METHOD[p.method] ?? p.method}` : ""}
                    </div>
                  </div>
                  <span style={{ font: "500 12px/1 var(--sans)", color: p.status === "refunded" ? "var(--t2)" : "var(--t1)", border: "1px solid var(--bd1)", padding: "6px 11px", borderRadius: 999 }}>
                    {p.status === "refunded" ? "Refunded" : "Paid"}
                  </span>
                  <span style={{ fontFamily: serif, fontSize: 26, letterSpacing: "-0.02em", textAlign: "right", textDecoration: p.status === "refunded" ? "line-through" : "none", color: p.status === "refunded" ? "var(--t2)" : "var(--t0)" }}>
                    {formatMoney(p.amount, p.currency)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {!status && error && <div role="alert" style={{ fontSize: 14, color: "var(--acctx)" }}>{error}</div>}
        </div>
      </main>
    </AppShell>
  )
}
