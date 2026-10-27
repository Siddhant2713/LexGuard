// Grants Pro by hand (support, testing, comps) without editing documents in a database UI.
//   npm run grant-pro -- <email> [days=30]
// Adds the days on top of any Pro time left, like a purchase does. Use a negative number to remove days.
import mongoose from "mongoose";
import { connectMongo } from "../src/lib/mongo.js";
import { User } from "../src/models/User.js";

const [email, daysArg = "30"] = process.argv.slice(2);
const days = Number(daysArg);
if (!email || !Number.isInteger(days) || days === 0) {
  console.error("Usage: npm run grant-pro -- <email> [days=30]");
  process.exit(1);
}

await connectMongo();
const now = new Date();
// A value that isn't a real date (e.g. text typed into a database UI) counts as no Pro time left.
const current = { $cond: [{ $eq: [{ $type: "$pro_until" }, "date"] }, "$pro_until", now] };
const user = await User.findOneAndUpdate(
  { email: email.trim().toLowerCase() },
  [{ $set: { pro_until: { $add: [{ $max: [current, now] }, days * 24 * 60 * 60 * 1000] } } }],
  { new: true },
);
if (!user) console.error(`No account with email ${email}`);
else console.log(`${user.email}: ${user.isPro() ? `Pro until ${user.pro_until.toISOString()}` : "Free (no Pro time left)"}`);
await mongoose.disconnect();
process.exit(user ? 0 : 1);
