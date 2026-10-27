import { config } from "../config.js";
import { Payment } from "../models/index.js";
import { User } from "../models/User.js";
import * as razorpay from "./razorpay.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function createProOrder(user) {
  const { amount, currency, days } = config.pro;
  const order = await razorpay.createOrder({
    amount,
    currency,
    // Razorpay caps receipts at 40 chars.
    receipt: `pro_${String(user._id)}_${Date.now().toString(36)}`.slice(0, 40),
    notes: { user_id: String(user._id), plan: "pro", days: String(days) },
  });
  await Payment.create({ user_id: user._id, order_id: order.id, amount, currency, days });
  return order;
}

// Adds the order's days to pro_until, counting from now or from the end of the current pass,
// whichever is later. The `pro_orders: { $ne }` filter and the push happen in one atomic
// update, so the same order can never be credited twice.
const grantPro = (userId, orderId, days) => {
  const now = new Date();
  return User.updateOne({ _id: userId, pro_orders: { $ne: orderId } }, [
    {
      $set: {
        pro_until: { $add: [{ $max: [{ $ifNull: ["$pro_until", now] }, now] }, days * DAY_MS] },
        pro_orders: { $concatArrays: [{ $ifNull: ["$pro_orders", []] }, [orderId]] },
      },
    },
  ]);
};

// Reverses grantPro for a refunded order. Also a no-op on repeat.
const revokePro = (userId, orderId, days) =>
  User.updateOne({ _id: userId, pro_orders: orderId }, [
    {
      $set: {
        pro_until: { $subtract: ["$pro_until", days * DAY_MS] },
        pro_orders: { $filter: { input: "$pro_orders", cond: { $ne: ["$$this", orderId] } } },
      },
    },
  ]);

/**
 * Credits Pro for a Razorpay payment entity, from either the checkout callback (after fetching
 * the payment from the API) or a signed webhook. Safe to call any number of times.
 * Returns the Payment row, or null when the payment doesn't belong to one of our orders.
 */
export async function settlePayment(payment) {
  const row = await Payment.findOne({ order_id: String(payment.order_id ?? "") });
  if (!row) return null;
  // Never trust the client about money: the captured amount must be exactly what we charged.
  if (payment.amount !== row.amount || payment.currency !== row.currency) {
    console.error(`Payment ${payment.id} amount ${payment.amount} ${payment.currency} does not match order ${row.order_id}`);
    return null;
  }
  if (row.status === "refunded") return row;

  let status = payment.status;
  if (status === "authorized") {
    // Accounts without auto-capture leave payments authorized; capture so the money settles.
    try {
      status = (await razorpay.capturePayment(payment.id, row.amount, row.currency)).status;
    } catch (err) {
      // Already captured by the other path (webhook vs callback) racing us.
      status = (await razorpay.fetchPayment(payment.id)).status;
      if (status !== "captured") throw err;
    }
  }
  if (status !== "captured") return row;

  await Payment.updateOne(
    { _id: row._id, status: "created" },
    { status: "paid", payment_id: payment.id, paid_at: new Date(), method: payment.method ?? null },
  );
  await grantPro(row.user_id, row.order_id, row.days);
  return Payment.findById(row._id);
}

/** Full refunds take back the days that order bought. Partial refunds leave Pro in place. */
export async function settleRefund(payment) {
  const row = await Payment.findOne({ order_id: String(payment.order_id ?? ""), status: "paid" });
  if (!row || (payment.amount_refunded ?? 0) < row.amount) return;
  const moved = await Payment.updateOne({ _id: row._id, status: "paid" }, { status: "refunded" });
  if (moved.modifiedCount) await revokePro(row.user_id, row.order_id, row.days);
}
