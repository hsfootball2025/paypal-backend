const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();

// ✅ FIX CORS (WAJIB)
app.use(cors({
  origin: "*"
}));

app.use(express.json());

// ENV dari Railway
const CLIENT_ID = process.env.CLIENT_ID;
const SECRET = process.env.SECRET;

// database sementara (memory)
let users = {};

// mapping harga aman
const PRICES = {
  "Annual Pass": "13.99",
  "Monthly Pass": "4.99"
};

// ambil access token PayPal (LIVE)
async function getAccessToken() {
  const res = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Authorization": "Basic " + Buffer.from(CLIENT_ID + ":" + SECRET).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  const data = await res.json();

  if (!data.access_token) {
    console.error("❌ Gagal ambil token:", data);
  }

  return data.access_token;
}

// ==========================
// CREATE ORDER
// ==========================
app.post("/create-order", async (req, res) => {
  try {
    const { plan, email } = req.body;
    const price = PRICES[plan];

    if (!price) {
      return res.status(400).json({ error: "Invalid plan" });
    }

    // simpan user sementara
    if (email) {
      users[email] = { premium: false };
    }

    const token = await getAccessToken();

    const response = await fetch("https://api-m.paypal.com/v2/checkout/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: "USD",
              value: price
            }
          }
        ]
      })
    });

    const data = await response.json();

    if (!data.id) {
      console.error("❌ Create order error:", data);
      return res.status(500).json(data);
    }

    res.json(data);

  } catch (err) {
    console.error("❌ SERVER ERROR (create-order):", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ==========================
// CAPTURE ORDER
// ==========================
app.post("/capture-order", async (req, res) => {
  try {
    const { orderID } = req.body;

    const token = await getAccessToken();

    const response = await fetch(`https://api-m.paypal.com/v2/checkout/orders/${orderID}/capture`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    const data = await response.json();

    console.log("✅ Capture result:", data);

    res.json(data);

  } catch (err) {
    console.error("❌ SERVER ERROR (capture):", err);
    res.status(500).json({ error: "Capture failed" });
  }
});

// ==========================
// WEBHOOK (OPTIONAL)
// ==========================
app.post("/webhook", (req, res) => {

  const event = req.body;

  console.log("📩 Webhook:", event.event_type);

  if (
    event.event_type === "CHECKOUT.ORDER.APPROVED" ||
    event.event_type === "PAYMENT.CAPTURE.COMPLETED"
  ) {

    const email = event.resource?.payer?.email_address;

    if (email) {
      users[email] = { premium: true };
      console.log("🔥 User premium:", email);
    }
  }

  res.sendStatus(200);
});

// ==========================
// CHECK USER
// ==========================
app.get("/check-user", (req, res) => {
  const email = req.query.email;

  if (users[email] && users[email].premium) {
    res.json({ premium: true });
  } else {
    res.json({ premium: false });
  }
});

// ==========================
// TEST SERVER
// ==========================
app.get("/", (req, res) => {
  res.send("🚀 Backend aktif & siap LIVE");
});

// ==========================
// RUN SERVER
// ==========================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});
