const express = require("express");

const app = express();
app.use(express.json());

app.post("/webhook", (req, res) => {
  console.log("ORDER RECEIVED:", req.body);
  res.json({ success: true });
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});