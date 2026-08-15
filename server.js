const express = require("express");
const twilio = require("twilio");
const { Resend } = require("resend");

const app = express();
app.use(express.json());

// 1. Initialize Twilio Client (safely handling missing keys)
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

// 2. Initialize Resend Client
const resend = new Resend(process.env.RESEND_API_KEY);

// 3. Takeaway Order Webhook
app.post("/webhook", async (req, res) => {
  console.log("ORDER RECEIVED:", req.body);

  // Safely extract parameters from ElevenLabs payload
  const { customer_name, customer_phone, order_items, order_type, delivery_address } = req.body;

  // Send Confirmation SMS via Twilio
  if (twilioClient && process.env.TWILIO_PHONE_NUMBER && customer_phone) {
    try {
      await twilioClient.messages.create({
        body: `Hi ${customer_name || "there"}, your order (${order_items}) is confirmed for ${order_type}${order_type === "delivery" ? " to " + delivery_address : ""}. Thanks for calling FoodOnTheLine!`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: customer_phone,
      });
      console.log("SMS sent to", customer_phone);
    } catch (err) {
      console.log("SMS FAILED:", err.message);
    }
  } else {
    console.log("SMS skipped — Twilio missing configuration or phone number not provided");
  }

  // Send Order Email to Shop Owner via Resend
  try {
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: process.env.SHOP_EMAIL,
      subject: `New Order Received — ${customer_name || "Customer"}`,
      text: `New Order Details:\n\nName: ${customer_name}\nType: ${order_type}\nAddress: ${delivery_address || "N/A"}\nItems: ${order_items}\nPhone: ${customer_phone || "N/A"}`,
    });
    console.log("Order email sent to", process.env.SHOP_EMAIL);
  } catch (err) {
    console.log("ORDER EMAIL FAILED:", err.message);
  }

  res.json({ success: true });
});

// 4. Demo Request Endpoint
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

// 5. Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
