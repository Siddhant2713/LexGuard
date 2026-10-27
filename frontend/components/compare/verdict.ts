import type { Verdict } from "@/lib/types"

export const verdictLabel: Record<Verdict, string> = {
  better: "Better for you",
  worse: "Worse for you",
  mixed: "Mixed",
  same: "No real changes",
}

/** Pill colours, using the same one-accent scale as severities: worse is loud, better is calm. */
export const verdictStyle: Record<Verdict, React.CSSProperties> = {
  worse: { background: "var(--acc)", color: "var(--onacc)", border: "1px solid var(--acc)" },
  mixed: { background: "var(--bg0)", color: "var(--acctx)", border: "1px solid var(--acc)" },
  better: { background: "var(--bg0)", color: "var(--t0)", border: "1px solid var(--t0)" },
  same: { background: "var(--bg0)", color: "var(--t2)", border: "1px solid var(--bd1)" },
}
