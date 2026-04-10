const express = require("express");
const fetch = require("node-fetch");

const app = express();
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

// ===============================
// 🔐 GET ACCESS TOKEN
// ===============================
async function getAccessToken() {
  try {
    const res = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Authorization":
          "Basic " +
          Buffer.from(CLIENT_ID + ":" + SECRET).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    });

    const data = await res.json();

    if (!data.access_token) {
      console.error("❌ Gagal ambil token:", data);
      throw new Error("Token error");
    }

    return data.access_token;

  } catch (err) {
    console.error("❌ ERROR TOKEN:", err);
    throw err;
  }
}

// ===============================
// 🧾 CREATE ORDER
// ===============================
app.post("/create-order", async (req, res) => {
  try {
    const { plan, email } = req.body;

    const price = PRICES[plan];

    if (!price) {
      return res.status(400).json({ error: "Invalid plan" });
    }

    if (email) {
      users[email] = { premium: false };
    }

    const token = await getAccessToken();

    const response = await fetch(
      "https://api-m.paypal.com/v2/checkout/orders",
      {
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
      }
    );

    const data = await response.json();

    console.log("🧾 CREATE ORDER:", data);

    // ❗ WAJIB ADA
    if (!data.id) {
      return res.status(500).json({
        error: "Failed create order",
        details: data
      });
    }

    res.json({ id: data.id });

  } catch (err) {
    console.error("❌ CREATE ORDER ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===============================
// 💳 CAPTURE ORDER
// ===============================
app.post("/capture-order", async (req, res) => {
  try {
    const { orderID } = req.body;

    const token = await getAccessToken();

    const response = await fetch(
      `https://api-m.paypal.com/v2/checkout/orders/${orderID}/capture`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      }
    );

    const data = await response.json();

    console.log("💰 CAPTURE:", data);

    // ❗ VALIDASI SUKSES
    if (data.status !== "COMPLETED") {
      return res.status(400).json({
        error: "Payment not completed",
        details: data
      });
    }

    res.json(data);

  } catch (err) {
    console.error("❌ CAPTURE ERROR:", err);
    res.status(500).json({ error: "Capture failed" });
  }
});

// ===============================
// 🔔 WEBHOOK (OPTIONAL)
// ===============================
app.post("/webhook", (req, res) => {
  const event = req.body;

  console.log("📩 Webhook:", event.event_type);

  if (
    event.event_type === "PAYMENT.CAPTURE.COMPLETED"
  ) {
    const email = event.resource?.payer?.email_address;

    if (email) {
      users[email] = { premium: true };
      console.log("✅ Premium:", email);
    }
  }

  res.sendStatus(200);
});

// ===============================
// 👤 CHECK USER
// ===============================
app.get("/check-user", (req, res) => {
  const email = req.query.email;

  if (users[email]?.premium) {
    res.json({ premium: true });
  } else {
    res.json({ premium: false });
  }
});

// ===============================
// 🚀 TEST
// ===============================
app.get("/", (req, res) => {
  res.send("Backend aktif 🚀");
});

app.listen(3000, () => console.log("Server running on 3000"));
