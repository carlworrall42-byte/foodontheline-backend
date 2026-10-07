const express = require("express");
const crypto = require("crypto");

const app = express();
app.use(express.json({ limit: "100kb" }));

const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET; // set this in your host's environment settings

if (!WEBHOOK_SECRET) {
  console.warn("WARNING: WEBHOOK_SECRET is not set. All webhook calls will be rejected.");
}

// ---------------------------------------------------------------
// NOTIFIERS: the "Triple Lock". Each one is independent and swappable.
// Replace the bodies with real printer / tablet / SMS code later.
// Each must throw on failure so we can see it in the logs.
// ---------------------------------------------------------------
const notifiers = {
  printer: async (order) => {
    console.log(`[PRINTER] would print order ${order.id}`);
  },
  tablet: async (order) => {
    console.log(`[TABLET] would flash order ${order.id}`);
  },
  sms: async (order) => {
    console.log(`[SMS] would text staff about order ${order.id}`);
  },
};

async function fireAlerts(order) {
  // allSettled: one failing channel never blocks the others
  const names = Object.keys(notifiers);
  const results = await Promise.allSettled(names.map((n) => notifiers[n](order)));
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`[ALERT FAILED] ${names[i]} for order ${order.id}:`, r.reason);
    }
  });
  return results.map((r, i) => ({ channel: names[i], ok: r.status === "fulfilled" }));
}

// ---------------------------------------------------------------
// Auth: voice agent must send header  x-webhook-secret: <secret>
// ---------------------------------------------------------------
function checkSecret(req, res, next) {
  const given = Buffer.from(req.get("x-webhook-secret") || "");
  const expected = Buffer.from(WEBHOOK_SECRET || "");
  const ok = expected.length > 0 && given.length === expected.length && crypto.timingSafeEqual(given, expected);
  if (!ok) return res.status(401).json({ success: false, message: "Unauthorized" });
  next();
}

// ---------------------------------------------------------------
// Validation
// ---------------------------------------------------------------
function validate(body) {
  const { customer_name, order_type, address, items } = body || {};
  if (!["collection", "delivery"].includes(order_type)) return "order_type must be 'collection' or 'delivery'";
  if (!Array.isArray(items) || items.length === 0) return "items must be a non-empty array";
  if (order_type === "delivery" && !address) return "address is required for delivery";
  if (customer_name && typeof customer_name !== "string") return "customer_name must be text";
  return null;
}

// ---------------------------------------------------------------
// Routes
// ---------------------------------------------------------------
app.get("/health", (req, res) => res.json({ ok: true }));

app.post("/webhook", checkSecret, async (req, res) => {
  const error = validate(req.body);
  if (error) return res.status(400).json({ success: false, message: error });

  const { customer_name, order_type, address, items } = req.body;
  const order = {
    id: "ORD-" + crypto.randomBytes(3).toString("hex").toUpperCase(),
    receivedAt: new Date().toISOString(),
    customer_name: customer_name || "Unknown",
    order_type,
    address: address || null,
    items,
  };

  // TODO: save the order to a real database here (see notes).
  // Keep personal data out of logs in production.
  console.log(`Order ${order.id} received (${order.order_type}, ${order.items.length} items)`);

  const alerts = await fireAlerts(order);
  res.json({ success: true, orderId: order.id, alerts });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
