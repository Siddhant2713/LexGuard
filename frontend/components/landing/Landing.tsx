"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Logo, LogoMark, ThemeToggle } from "@/components/brand"
import { FREE_FEATURES, PRO_DAYS, PRO_FEATURES, PRO_PRICE } from "@/lib/plans"

const MARQUEE = ["Offer letters", "Leases", "Freelance agreements", "NDAs", "Terms of service", "Contractor agreements"]

const FAQS = [
  { q: "Is this legal advice?", a: "No. LexGuard explains what your contract says and points out terms worth questioning. It is not a law firm. For decisions with serious consequences, talk to a lawyer." },
  { q: "What kinds of contracts can it read?", a: "Job offers and employment agreements, freelance and contractor agreements, residential leases, NDAs and terms of service, in English." },
  { q: "Which files can I upload?", a: "PDF and Word (DOCX) files up to 20 MB." },
  { q: "How long does it take?", a: "Most contracts are done in under a minute." },
  { q: "Who can see my contract?", a: "Only you. Files are encrypted, never used to train AI models, and you can delete a contract and its report at any time." },
  { q: "How does Pro billing work?", a: `Pro is a one-time payment of ${PRO_PRICE} for ${PRO_DAYS} days, paid through Razorpay with UPI, cards or netbanking. Nothing renews on its own. Buy again before it ends and the new days are added on top.` },
]

const QUOTES = [
  { text: "I almost signed away every side project I’d ever build. The company changed the clause the day I asked.", name: "Priya S.", role: "Product designer" },
  { text: "The first lease I understood before I moved in, not after.", name: "Marcus T.", role: "Renter, Chicago" },
  { text: "Every client contract goes through it now. The suggested wording alone has paid for Pro.", name: "Elena R.", role: "Freelance developer" },
]

const ASKS = [
  { q: "What happens if I quit after a year?", a: "You’d owe 60 days’ notice and repay the full $8,000 relocation allowance, since you’d leave before 18 months.", cites: ["§12 Termination", "§7 Relocation"] },
  { q: "Can my landlord enter without telling me?", a: "Only in an emergency. Otherwise the lease requires 24 hours’ written notice before entry.", cites: ["§14 Access"] },
  { q: "When does the client have to pay me?", a: "Within 60 days of an approved invoice. Approval has no deadline, so payment could be delayed indefinitely.", cites: ["§5 Payment"] },
]

const STEPS = [
  { n: "01", title: "Drop it in", body: "A PDF or Word file. Offer letters, leases, freelance agreements, NDAs." },
  { n: "02", title: "Read the marks", body: "Risky clauses are shaded by severity, right where they sit in your contract." },
  { n: "03", title: "Ask before you sign", body: "Ask questions in your own words, and get suggested wording to send back." },
]

const serif = "var(--serif)"
const h2: React.CSSProperties = { margin: 0, fontFamily: serif, fontWeight: 400, fontSize: "clamp(40px,5.6vw,80px)", lineHeight: 1, letterSpacing: "-0.035em" }
const wrap: React.CSSProperties = { maxWidth: 1280, margin: "0 auto", padding: "clamp(88px,11vw,160px) clamp(20px,4vw,48px)" }
const eyebrow = (color: string): React.CSSProperties => ({ font: "500 12px/1 var(--mono)", letterSpacing: ".08em", color })
const up = (delay: number, dur = 1) => `lgUp ${dur}s ${delay}s cubic-bezier(.19,1,.22,1) both`
const pillBtn = (bg: string, color: string, pad = "17px 30px", size = 16): React.CSSProperties => ({
  font: `500 ${size}px var(--sans)`, background: bg, color, border: 0, padding: pad, borderRadius: 999, cursor: "pointer", whiteSpace: "nowrap", display: "inline-block",
})
const tag: React.CSSProperties = { position: "absolute", right: 10, top: -9, font: "500 10px/1 var(--sans)", padding: "3px 8px", borderRadius: 999 }

export default function Landing() {
  const productRef = useRef<HTMLDivElement>(null)
  const [quote, setQuote] = useState(0)
  const [faq, setFaq] = useState(0)

  // The product window tilts flat as the page scrolls.
  useEffect(() => {
    const onScroll = () => {
      const el = productRef.current
      if (!el) return
      const p = Math.min(window.scrollY / 480, 1)
      el.style.transform = `rotateX(${(14 * (1 - p)).toFixed(2)}deg) scale(${(0.94 + 0.06 * p).toFixed(3)})`
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    const iv = setInterval(() => setQuote((q) => (q + 1) % QUOTES.length), 6500)
    return () => clearInterval(iv)
  }, [])

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })
  const q = QUOTES[quote]

  return (
    <div style={{ background: "var(--bg0)", color: "var(--t0)", overflowX: "hidden" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 20, background: "color-mix(in oklch, var(--bg0) 78%, transparent)", backdropFilter: "blur(16px) saturate(1.4)", WebkitBackdropFilter: "blur(16px) saturate(1.4)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 clamp(20px,4vw,48px)", height: 68, display: "flex", alignItems: "center", gap: "clamp(16px,3vw,40px)" }}>
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flex: "none", background: "none", border: 0, padding: 0, color: "var(--t0)" }}>
            <Logo />
          </button>
          <nav style={{ display: "flex", gap: "clamp(16px,2.4vw,32px)", fontSize: 14, color: "var(--t1)", flex: 1, minWidth: 0, overflow: "hidden", whiteSpace: "nowrap" }}>
            <span className="lg-navlink" onClick={() => scrollTo("product")}>Product</span>
            <span className="lg-navlink" onClick={() => scrollTo("how")}>How it works</span>
            <span className="lg-navlink" onClick={() => scrollTo("pricing")}>Pricing</span>
            <span className="lg-navlink" onClick={() => scrollTo("faq")}>FAQ</span>
          </nav>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "none" }}>
            <ThemeToggle />
            <Link href="/login" style={{ font: "500 14px var(--sans)", color: "var(--t0)", padding: "9px 14px", whiteSpace: "nowrap" }}>Sign in</Link>
            <Link href="/register" style={{ ...pillBtn("var(--t0)", "var(--bg0)", "10px 18px", 14) }}>Try it free</Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section style={{ padding: "clamp(56px,9vw,120px) clamp(20px,4vw,48px) 0", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, font: "500 12px/1 var(--mono)", letterSpacing: ".06em", color: "var(--t1)", border: "1px solid var(--bd1)", padding: "8px 14px", borderRadius: 999, animation: up(0, 0.8) }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--acc)" }} />
          CONTRACT REVIEW IN PLAIN ENGLISH
        </div>
        <h1 style={{ margin: "32px 0 0", fontFamily: serif, fontWeight: 400, fontSize: "clamp(64px,10vw,148px)", lineHeight: 0.92, letterSpacing: "-0.045em", animation: up(0.08) }}>
          Read before<br />you sign<span style={{ color: "var(--acc)" }}>.</span>
        </h1>
        <p style={{ margin: "32px 0 0", maxWidth: 620, fontSize: "clamp(17px,1.5vw,20px)", lineHeight: 1.55, color: "var(--t1)", textWrap: "pretty", animation: up(0.16) } as React.CSSProperties}>
          Upload any contract. LexGuard marks the clauses that could cost you, explains them in plain English, and answers your questions with the exact line to point to.
        </p>
        <div style={{ marginTop: 40, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12, animation: up(0.24) }}>
          <Link href="/register" className="lg-btn-acc" style={pillBtn("var(--acc)", "var(--onacc)")}>Analyze a contract</Link>
          <button type="button" onClick={() => scrollTo("product")} style={pillBtn("var(--bg2)", "var(--t0)", "17px 28px")}>See how it reads</button>
        </div>
        <div style={{ marginTop: 18, fontSize: 13, color: "var(--t2)" }}>Free for 3 contracts a month</div>

        {/* Product window */}
        <div style={{ width: "100%", maxWidth: 1280, marginTop: "clamp(56px,7vw,96px)", perspective: 2200, animation: up(0.35, 1.2) }} aria-hidden="true">
          <div ref={productRef} style={{ transform: "rotateX(14deg) scale(.94)", transformOrigin: "50% 0", transition: "transform .1s linear", background: "var(--win)", borderRadius: 18, boxShadow: "var(--sh)", overflow: "hidden", textAlign: "left" }}>
            <div style={{ height: 48, display: "flex", alignItems: "center", gap: 14, padding: "0 18px", borderBottom: "1px solid var(--bd0)" }}>
              <LogoMark size={18} cut="var(--win)" compact />
              <span style={{ font: "400 12px var(--mono)", color: "var(--t1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Offer_Letter_Northwind_2026.pdf</span>
              <span style={{ flex: 1 }} />
              <span style={{ font: "500 12px/1 var(--sans)", color: "var(--acctx)", border: "1px solid var(--acc)", padding: "5px 10px", borderRadius: 999, whiteSpace: "nowrap" }}>High risk · 7.2</span>
            </div>
            <div style={{ display: "flex", height: "clamp(420px,46vw,600px)" }}>
              <div style={{ flex: "1 1 56%", minWidth: 0, background: "var(--bg1)", padding: "clamp(20px,3vw,40px)", overflow: "hidden", position: "relative" }}>
                <div style={{ maxWidth: 600, margin: "0 auto", background: "var(--bg0)", borderRadius: 10, padding: "clamp(22px,3vw,44px)", position: "relative", overflow: "hidden", height: "120%" }}>
                  <div style={{ position: "absolute", left: 0, right: 0, height: 1, background: "var(--acc)", boxShadow: "0 0 18px 3px var(--acc)", animation: "lgScan 12s linear infinite", zIndex: 2 }} />
                  <div style={{ fontFamily: serif, fontSize: "clamp(20px,2vw,28px)", letterSpacing: "-0.02em" }}>Employment Agreement</div>
                  <div style={{ font: "400 11px var(--mono)", color: "var(--t2)", margin: "6px 0 22px" }}>Northwind Labs, Inc. · Jordan Lee</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: "clamp(12px,1.05vw,14px)", lineHeight: 1.6, color: "var(--t1)" }}>
                    <p style={{ margin: 0, padding: "10px 14px" }}><b style={{ color: "var(--t0)", fontWeight: 500 }}>3. Compensation.</b> The Company shall pay Employee an annual base salary of $142,000, payable on the standard payroll schedule.</p>
                    <div style={{ position: "relative", padding: "10px 14px", borderRadius: 8, animation: "lgT1 12s linear infinite" }}>
                      <span style={{ ...tag, background: "var(--acc)", color: "var(--onacc)", padding: "4px 8px", animation: "lgL1 12s linear infinite" }}>Critical</span>
                      <p style={{ margin: 0 }}><b style={{ color: "var(--t0)", fontWeight: 500 }}>4. Inventions.</b> Employee assigns to the Company any invention conceived during employment, <span style={{ color: "var(--t0)" }}>whether or not during working hours</span> and whether or not using Company resources.</p>
                    </div>
                    <div style={{ position: "relative", padding: "10px 14px", borderRadius: 8, animation: "lgT2 12s linear infinite" }}>
                      <span style={{ ...tag, background: "var(--bg0)", color: "var(--acctx)", border: "1px solid var(--acc)", animation: "lgL2 12s linear infinite" }}>High</span>
                      <p style={{ margin: 0 }}><b style={{ color: "var(--t0)", fontWeight: 500 }}>9. Restrictive covenants.</b> For twenty-four (24) months following termination for any reason, Employee shall not work for any competing business anywhere in the world.</p>
                    </div>
                    <div style={{ position: "relative", padding: "10px 14px", borderRadius: 8, animation: "lgT3 12s linear infinite" }}>
                      <span style={{ ...tag, background: "var(--bg0)", color: "var(--acctx)", border: "1px solid var(--acc)", animation: "lgL3 12s linear infinite" }}>High</span>
                      <p style={{ margin: 0 }}><b style={{ color: "var(--t0)", fontWeight: 500 }}>12. Termination.</b> The Company may terminate upon seven (7) days’ notice. Employee shall provide not less than sixty (60) days’ notice.</p>
                    </div>
                    <p style={{ margin: 0, padding: "10px 14px" }}><b style={{ color: "var(--t0)", fontWeight: 500 }}>13. Benefits.</b> Employee is eligible for the Company’s standard health, dental and retirement plans.</p>
                  </div>
                </div>
              </div>
              <div style={{ flex: "1 1 44%", minWidth: 0, display: "flex", flexDirection: "column", borderLeft: "1px solid var(--bd0)" }}>
                <div style={{ flex: 1, padding: "clamp(18px,2.4vw,32px)", display: "flex", flexDirection: "column", gap: 20, overflow: "hidden", fontSize: "clamp(12.5px,1.05vw,14.5px)" }}>
                  <div style={{ display: "flex", gap: 12, animation: "lgC1 12s linear infinite" }}>
                    <LogoMark size={22} cut="var(--win)" compact />
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div>I read all 11 clauses. Three need your attention before you sign.</div>
                      <div style={{ fontFamily: serif, fontSize: "clamp(22px,2vw,30px)", lineHeight: 1, letterSpacing: "-0.02em" }}>
                        High risk <span style={{ font: "500 13px var(--mono)", color: "var(--t2)", letterSpacing: 0 }}>7.2 / 10</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ alignSelf: "flex-end", background: "var(--bg2)", padding: "10px 16px", borderRadius: 18, animation: "lgC2 12s linear infinite" }}>Can they own code I write at home?</div>
                  <div style={{ display: "flex", gap: 12, animation: "lgC3 12s linear infinite" }}>
                    <div style={{ width: 22, flex: "none" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div>Yes, as written. Clause 4 covers anything you create during your employment, “whether or not during working hours.” Weekend projects on your own laptop would count.</div>
                      <span style={{ alignSelf: "flex-start", font: "400 11px var(--mono)", color: "var(--t1)", background: "var(--bg1)", border: "1px solid var(--bd1)", padding: "3px 8px", borderRadius: 6 }}>§4 Inventions</span>
                    </div>
                  </div>
                </div>
                <div style={{ padding: "14px 18px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--bg1)", borderRadius: 14, padding: "12px 12px 12px 16px", fontSize: 14, color: "var(--t2)" }}>
                    <span style={{ flex: 1 }}>Ask about this contract</span>
                    <span style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--acc)" }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Marquee ── */}
      <section style={{ padding: "clamp(64px,8vw,104px) 0", overflow: "hidden", borderBottom: "1px solid var(--bd0)" }}>
        <div style={{ display: "flex", width: "max-content", animation: "lgMarq 40s linear infinite", fontFamily: serif, fontSize: "clamp(32px,4vw,56px)", letterSpacing: "-0.02em", color: "var(--t2)", whiteSpace: "nowrap" }}>
          {[...MARQUEE, ...MARQUEE].map((m, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: "clamp(28px,3vw,48px)", paddingRight: "clamp(28px,3vw,48px)" }}>
              {m}
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--acc)" }} />
            </span>
          ))}
        </div>
      </section>

      {/* ── The fine print, marked ── */}
      <section id="product" style={{ scrollMarginTop: 68 }}>
        <div style={wrap}>
          <div style={{ ...eyebrow("var(--acctx)"), marginBottom: 24 }}>THE FINE PRINT, MARKED</div>
          <h2 style={{ ...h2, maxWidth: 900 }}>The lines that matter, and what they mean for you.</h2>
          <div style={{ marginTop: "clamp(48px,6vw,88px)", position: "relative", background: "var(--tc)", borderRadius: 20, padding: "clamp(28px,4vw,56px)" }}>
            <span style={{ position: "absolute", top: -14, left: "clamp(28px,4vw,56px)", font: "500 12px/1 var(--sans)", background: "var(--acc)", color: "var(--onacc)", padding: "8px 14px", borderRadius: 999 }}>Critical · §4 Inventions</span>
            <p style={{ margin: 0, fontFamily: serif, fontSize: "clamp(24px,2.8vw,40px)", lineHeight: 1.3, letterSpacing: "-0.015em", textWrap: "pretty" } as React.CSSProperties}>
              “Employee hereby assigns to the Company all right, title and interest in any invention conceived during the term of employment, whether or not during working hours and whether or not using Company resources.”
            </p>
          </div>
          <div style={{ marginTop: "clamp(40px,5vw,64px)", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))", gap: "clamp(28px,4vw,64px)" }}>
            {[
              ["IN PLAIN ENGLISH", "var(--t2)", "The company would own anything you build while you work there, including side projects made at home on your own laptop."],
              ["IF YOU SIGN THIS", "var(--acctx)", "An app or open-source library you make in your own time could legally belong to them."],
              ["WHAT TO ASK FOR", "var(--t2)", "Limit it to work related to their business or made with their equipment, and list your existing projects as excluded."],
            ].map(([label, color, body]) => (
              <div key={label} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ font: "500 12px var(--mono)", letterSpacing: ".06em", color }}>{label}</div>
                <p style={{ margin: 0, fontSize: "clamp(18px,1.5vw,21px)", lineHeight: 1.5, textWrap: "pretty" } as React.CSSProperties}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Ask the contract ── */}
      <section style={{ background: "var(--inv)", color: "var(--oninv)" }}>
        <div style={{ ...wrap, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,440px),1fr))", gap: "clamp(48px,6vw,96px)", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={eyebrow("var(--acc)")}>ASK THE CONTRACT</div>
            <h2 style={h2}>Ask it anything. Get the clause, not a guess.</h2>
            <p style={{ margin: 0, maxWidth: 440, fontSize: 18, color: "var(--oninv2)", textWrap: "pretty" } as React.CSSProperties}>
              Every answer cites the section it comes from, so you can check it yourself or quote it back to the other side.
            </p>
          </div>
          <div style={{ position: "relative", height: "clamp(300px,30vw,360px)" }}>
            {ASKS.map((a, i) => (
              <div key={a.q} style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 24, animation: `lgQ${i + 1} 15s linear infinite` }}>
                <div style={{ fontFamily: serif, fontSize: "clamp(28px,3vw,42px)", lineHeight: 1.15, letterSpacing: "-0.02em" }}>“{a.q}”</div>
                <div style={{ fontSize: 18, lineHeight: 1.55, color: "var(--oninv2)", maxWidth: 520 }}>{a.a}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {a.cites.map((c) => (
                    <span key={c} style={{ font: "400 12px var(--mono)", border: "1px solid var(--oninv2)", padding: "4px 10px", borderRadius: 6 }}>{c}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" style={{ scrollMarginTop: 68 }}>
        <div style={wrap}>
          <h2 style={{ ...h2, marginBottom: "clamp(40px,5vw,72px)" }}>About a minute,<br />start to finish.</h2>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {STEPS.map((s, i) => (
              <div key={s.n} style={{ display: "grid", gridTemplateColumns: "minmax(60px,120px) minmax(0,1fr) minmax(0,1fr)", gap: 24, alignItems: "baseline", padding: "clamp(24px,3vw,40px) 0", borderTop: "1px solid var(--bd1)", borderBottom: i === STEPS.length - 1 ? "1px solid var(--bd1)" : undefined }}>
                <span style={{ font: "500 14px var(--mono)", color: "var(--acctx)" }}>{s.n}</span>
                <span style={{ fontFamily: serif, fontSize: "clamp(28px,3.4vw,48px)", lineHeight: 1.05, letterSpacing: "-0.02em" }}>{s.title}</span>
                <span style={{ fontSize: 17, color: "var(--t1)", textWrap: "pretty" } as React.CSSProperties}>{s.body}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section style={{ background: "var(--bg1)" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "clamp(88px,11vw,160px) clamp(20px,4vw,48px)", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 40 }}>
          <blockquote style={{ margin: 0, minHeight: "3.6em", fontFamily: serif, fontSize: "clamp(28px,3.6vw,52px)", lineHeight: 1.18, letterSpacing: "-0.025em", textWrap: "balance" } as React.CSSProperties}>“{q.text}”</blockquote>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 15, fontWeight: 500 }}>{q.name}</span>
            <span style={{ fontSize: 14, color: "var(--t2)" }}>{q.role}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {QUOTES.map((_, i) => (
              <button key={i} type="button" aria-label={`Quote ${i + 1}`} onClick={() => setQuote(i)} style={{ width: 32, height: 3, padding: 0, border: 0, borderRadius: 2, cursor: "pointer", background: i === quote ? "var(--acc)" : "var(--bd1)" }} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Privacy ── */}
      <section>
        <div style={{ ...wrap, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,440px),1fr))", gap: "clamp(40px,6vw,96px)" }}>
          <h2 style={h2}>Your contract never trains anyone’s AI.</h2>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            {["Encrypted in transit and at rest", "Visible only to you", "Delete a contract and its report in one click"].map((t, i, all) => (
              <div key={t} style={{ display: "flex", justifyContent: "space-between", gap: 24, padding: "22px 0", borderTop: "1px solid var(--bd1)", borderBottom: i === all.length - 1 ? "1px solid var(--bd1)" : undefined, fontSize: 17 }}>
                <span>{t}</span>
                <span style={{ color: "var(--acctx)" }}>●</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" style={{ borderTop: "1px solid var(--bd0)", scrollMarginTop: 68 }}>
        <div style={wrap}>
          <h2 style={{ ...h2, marginBottom: "clamp(40px,5vw,72px)" }}>Pricing</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,360px),1fr))", gap: "clamp(32px,5vw,80px)" }}>
            <Plan name="Free" price="₹0" rule="var(--t0)" features={FREE_FEATURES} cta="Start free" href="/register" ctaBg="var(--bg2)" ctaColor="var(--t0)" />
            <Plan name="Pro" price={PRO_PRICE} per="/ month" rule="var(--acc)" features={PRO_FEATURES} cta="Get Pro" href="/register?next=/billing" ctaBg="var(--acc)" ctaColor="var(--onacc)" />
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" style={{ borderTop: "1px solid var(--bd0)", scrollMarginTop: 68 }}>
        <div style={{ ...wrap, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,360px),1fr))", gap: "clamp(32px,5vw,80px)" }}>
          <h2 style={h2}>Questions</h2>
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            {FAQS.map((f, i) => {
              const open = faq === i
              return (
                <div key={f.q} style={{ borderTop: "1px solid var(--bd1)" }}>
                  <button type="button" aria-expanded={open} onClick={() => setFaq(open ? -1 : i)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "24px 0", cursor: "pointer", fontSize: 18, fontWeight: 500, background: "none", border: 0, color: "var(--t0)", textAlign: "left" }}>
                    <span>{f.q}</span>
                    <span style={{ width: 28, height: 28, flex: "none", borderRadius: "50%", display: "grid", placeItems: "center", font: "400 18px/1 var(--sans)", background: open ? "var(--t0)" : "var(--bg2)", color: open ? "var(--bg0)" : "var(--t0)" }}>{open ? "−" : "+"}</span>
                  </button>
                  {open && <p style={{ margin: "0 0 28px", color: "var(--t1)", fontSize: 16, maxWidth: 600, textWrap: "pretty" } as React.CSSProperties}>{f.a}</p>}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ background: "var(--acc)", color: "#0A0A0A" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(96px,12vw,180px) clamp(20px,4vw,48px)", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 40 }}>
          <h2 style={{ margin: 0, fontFamily: serif, fontWeight: 400, fontSize: "clamp(52px,8vw,128px)", lineHeight: 0.92, letterSpacing: "-0.045em" }}>Know what<br />you’re signing.</h2>
          <Link href="/register" style={pillBtn("#0A0A0A", "#F5F5F4", "18px 32px")}>Analyze your first contract</Link>
        </div>
      </section>

      <footer style={{ overflow: "hidden" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px clamp(20px,4vw,48px) 0", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 24, fontSize: 13, color: "var(--t2)" }}>
          <span style={{ maxWidth: 520 }}>LexGuard is not a law firm and does not give legal advice. For decisions with serious consequences, talk to a lawyer.</span>
          <div style={{ display: "flex", gap: 24, color: "var(--t1)" }}><span>Privacy</span><span>Terms</span><span>Contact</span><span>© 2026</span></div>
        </div>
        <div style={{ font: "600 clamp(80px,21vw,300px)/.78 var(--sans)", letterSpacing: "-0.06em", textAlign: "center", marginTop: 40, marginBottom: "-0.08em", color: "var(--t0)", whiteSpace: "nowrap" }}>LexGuard</div>
      </footer>
    </div>
  )
}

function Plan({ name, price, per, rule, features, cta, href, ctaBg, ctaColor }: { name: string; price: string; per?: string; rule: string; features: string[]; cta: string; href: string; ctaBg: string; ctaColor: string }) {
  const priceStyle: React.CSSProperties = { fontFamily: serif, fontSize: "clamp(56px,6vw,88px)", lineHeight: 0.9, letterSpacing: "-0.04em" }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, borderTop: `2px solid ${rule}`, paddingTop: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 18, fontWeight: 500 }}>{name}</span>
        {per ? (
          <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={priceStyle}>{price}</span>
            <span style={{ fontSize: 15, color: "var(--t2)" }}>{per}</span>
          </span>
        ) : (
          <span style={priceStyle}>{price}</span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", fontSize: 16, color: "var(--t1)" }}>
        {features.map((f) => <span key={f} style={{ padding: "12px 0", borderBottom: "1px solid var(--bd0)" }}>{f}</span>)}
      </div>
      <Link href={href} style={{ ...pillBtn(ctaBg, ctaColor, "14px 26px", 15), alignSelf: "flex-start" }}>{cta}</Link>
    </div>
  )
}
