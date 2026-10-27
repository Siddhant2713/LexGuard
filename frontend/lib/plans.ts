// Plan copy shared by the landing page and /billing. Limits are enforced by the API
// (backend/src/services/plans.js); keep these in step with it.

export const PRO_PRICE = "₹499"
export const PRO_DAYS = 30
export const FREE_UPLOADS = 3

export const FREE_FEATURES = [`${FREE_UPLOADS} contracts a month`, "Every clause rated and explained", "Ask questions about your contract"]
export const PRO_FEATURES = ["Unlimited contracts", "Export and share reports", "Compare two versions of a contract"]

/** Why the user landed on /billing, from `?feature=`. */
export const FEATURE_PITCH: Record<string, string> = {
  uploads: `You’ve used this month’s ${FREE_UPLOADS} free contracts. Pro has no limit.`,
  export: "Exporting reports is part of Pro.",
  share: "Sharing reports is part of Pro.",
  compare: "Comparing two versions of a contract is part of Pro.",
}
