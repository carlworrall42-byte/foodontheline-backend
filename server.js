const express = require("express");
const twilio = require("twilio");
const { Resend } = require("resend");

const app = express();
app.use(express.json());

let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

const resend = new Resend(process.env.RESEND_API_KEY);

app.post("/webhook", async (req, res) => {
  const { customer_name, customer_phone, order_type, delivery_address, order_items } = req.body;

  const missing = [];
  if (!customer_name) missing.push("customer_name");
  if (!customer_phone) missing.push("customer_phone");
  if (!order_type) missing.push("order_type");
  if (order_type === "delivery" && !delivery_address) missing.push("delivery_address");
  if (!order_items) missing.push("order_items");

  if (missing.length > 0) {
    console.log("REJECTED — missing fields:", missing, req.body);
    return res.status(400).json({ success: false, missing });
  }

  console.log("ORDER RECEIVED:", req.body);

  if (twilioClient && process.env.TWILIO_PHONE_NUMBER) {
    try {
      await twilioClient.messages.create({
        body: `Hi ${customer_name}, your order (${order_items}) is confirmed for ${order_type}${order_type === "delivery" ? " to " + delivery_address : ""}. Thanks for calling FoodOnTheLine!`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: customer_phone,
      });
      console.log("SMS sent to", customer_phone);
    } catch (err) {
      console.log("SMS FAILED:", err.message);
    }
  } else {
    console.log("SMS skipped — Twilio not connected yet");
  }

  try {
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: process.env.SHOP_EMAIL,
      subject: `New Order — ${customer_name}`,
      text: `New order received:\n\nName: ${customer_name}\nPhone: ${customer_phone}\nType: ${order_type}\nAddress: ${delivery_address || "N/A (collection)"}\nItems: ${order_items}`,
    });
    console.log("Email sent to", process.env.SHOP_EMAIL);
  } catch (err) {
    console.log("EMAIL FAILED:", err.message);
  }

  res.json({ success: true });
});

app.post("/book-demo", async (req, res) => {
  const { name, shop, phone, weekly_orders } = req.body;

  if (!name || !shop || !phone) {
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }

  console.log("DEMO BOOKING:", req.body);

  try {
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: process.env.SHOP_EMAIL,
      subject: `New Demo Booking — ${shop}`,
      text: `New demo request:\n\nName: ${name}\nShop: ${shop}\nPhone: ${phone}\nWeekly orders: ${weekly_orders || "not specified"}`,
    });
    console.log("Booking email sent to", process.env.SHOP_EMAIL);
  } catch (err) {
    console.log("BOOKING EMAIL FAILED:", err.message);
  }

  res.json({ success: true });
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
