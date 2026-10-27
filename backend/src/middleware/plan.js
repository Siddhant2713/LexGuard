import { proRequired } from "../services/plans.js";

// Authorization by plan. Runs after requireAuth; responds 402 with code PRO_REQUIRED so the
// frontend can send the user to the upgrade page.
export const requirePro = (feature) => (req, _res, next) =>
  next(req.user.isPro() ? undefined : proRequired(feature));
