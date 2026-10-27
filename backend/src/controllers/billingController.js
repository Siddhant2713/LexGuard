import { config } from "../config.js";
import { HttpError } from "../lib/httpError.js";
import { VerifyPaymentInput } from "../lib/schemas.js";
import { Payment } from "../models/index.js";
import { User } from "../models/User.js";
import { createProOrder, settlePayment, settleRefund } from "../services/billing.js";
import { periodResetsAt, uploadsThisPeriod } from "../services/plans.js";
import * as razorpay from "../services/razorpay.js";

const PAYMENT_FAILED = "We couldn't confirm this payment. If you were charged, it will be credited automatically within a few minutes, or refunded by Razorpay.";

// Plan, allowance and payment history for the billing page.
export async function status(req, res) {
  const pro = req.user.isPro();
  const [used, payments] = await Promise.all([
    uploadsThisPeriod(req.user._id),
    Payment.find({ user_id: req.user._id, status: { $ne: "created" } }).sort({ createdAt: -1 }).limit(24).lean(),
  ]);
  res.json({
    user: req.user.toPublic(),
    price: config.pro,
    usage: pro ? null : { used, limit: config.freeUploadsPerMonth, resets_at: periodResetsAt() },
    payments: payments.map((p) => ({
      order_id: p.order_id,
      amount: p.amount,
      currency: p.currency,
      days: p.days,
      status: p.status,
      paid_at: p.paid_at,
      method: p.method,
    })),
  });
}

// Step 1 of checkout: the server fixes the amount; the browser only ever gets an order id.
export async function createOrder(req, res) {
  let order;
  try {
    order = await createProOrder(req.user);
  } catch (err) {
    console.error(`Razorpay order failed: ${err.message}`);
    throw new HttpError(502, "Payments are unavailable right now. Please try again in a minute.");
  }
  res.status(201).json({
    key_id: config.razorpayKeyId,
    order_id: order.id,
    amount: order.amount,
    currency: order.currency,
    days: config.pro.days,
    prefill: { name: req.user.name, email: req.user.email },
  });
}

// Step 2: Checkout's success callback. The signature proves the ids came from Razorpay; the
// payment is then re-read from the API so its amount and status are Razorpay's, not the client's.
export async function verify(req, res) {
  const parsed = VerifyPaymentInput.safeParse(req.body);
  if (!parsed.success) throw new HttpError(422, "Invalid payment confirmation.");
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = parsed.data;

  // Scoped to the signed-in user, so one account can't claim another account's order.
  const row = await Payment.findOne({ order_id: orderId, user_id: req.user._id }).lean();
  if (!row || !razorpay.isValidPaymentSignature(orderId, paymentId, signature)) throw new HttpError(400, PAYMENT_FAILED);

  let payment;
  try {
    payment = await razorpay.fetchPayment(paymentId);
  } catch (err) {
    console.error(`Razorpay fetch ${paymentId} failed: ${err.message}`);
    throw new HttpError(502, PAYMENT_FAILED);
  }
  if (payment.order_id !== orderId) throw new HttpError(400, PAYMENT_FAILED);

  const settled = await settlePayment(payment);
  if (settled?.status !== "paid") throw new HttpError(402, PAYMENT_FAILED);

  const user = await User.findById(req.user._id);
  res.json({ user: user.toPublic() });
}

// Step 3 (and the safety net when the browser closes before step 2): Razorpay's webhook.
// Mounted with express.raw so the signature is checked against the exact bytes received.
export async function webhook(req, res) {
  if (!config.razorpayWebhookSecret) {
    console.warn("Razorpay webhook received but RAZORPAY_WEBHOOK_SECRET is not set; ignoring it.");
    throw new HttpError(503, "Webhook not configured.");
  }
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  if (!razorpay.isValidWebhookSignature(raw, req.headers["x-razorpay-signature"])) {
    throw new HttpError(400, "Invalid signature.");
  }

  let event;
  try {
    event = JSON.parse(raw.toString("utf8"));
  } catch {
    throw new HttpError(400, "Malformed JSON body.");
  }

  const payment = event?.payload?.payment?.entity;
  if (payment) {
    if (["payment.authorized", "payment.captured", "order.paid"].includes(event.event)) await settlePayment(payment);
    else if (["refund.processed", "payment.refunded"].includes(event.event)) await settleRefund(payment);
  }
  // Always 200 for a valid signature so Razorpay stops retrying events we don't act on.
  res.json({ ok: true });
}
