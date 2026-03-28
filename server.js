const express = require("express");
const fetch = require("node-fetch");
const app = express();

app.use(express.json());

// 🔴 ENV dari Railway (WAJIB LIVE)
const CLIENT_ID = process.env.CLIENT_ID;
const SECRET = process.env.SECRET;

// database sementara (memory)
let users = {};

// mapping harga
const PRICES = {
  "Annual Pass": "13.99",
  "Monthly Pass": "4.99"
};

// 🔑 ambil access token PayPal (LIVE)
async function getAccessToken() {
  try {
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
      console.error("TOKEN ERROR:", data);
      throw new Error("Gagal ambil access token");
    }

    return data.access_token;

  } catch (err) {
    console.error("ACCESS TOKEN ERROR:", err);
    throw err;
  }
}

// 🧾 CREATE ORDER (FIX UTAMA DI SINI)
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
        purchase_units: [{
          amount: {
            currency_code: "USD",
            value: price
          }
        }]
      })
    });

    const data = await response.json();

    console.log("CREATE ORDER:", data);

    // ❗ WAJIB ADA
    if (!data.id) {
      return res.status(500).json({ error: "Order gagal dibuat", data });
    }

    // ✅ KIRIM HANYA ID (PENTING)
    res.json({ id: data.id });

  } catch (err) {
    console.error("CREATE ORDER ERROR:", err);
    res.status(500).json({ error: "Server error create-order" });
  }
});

// 💳 CAPTURE ORDER
app.post("/capture-order", async (req, res) => {
  try {
    const { orderID } = req.body;

    const token = await getAccessToken();

    const response = await fetch(`https://api-m.paypal.com/v2/checkout/orders/${orderID}/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });

    const data = await response.json();

    console.log("CAPTURE:", data);

    res.json(data);

  } catch (err) {
    console.error("CAPTURE ERROR:", err);
    res.status(500).json({ error: "Server error capture-order" });
  }
});

// 🔔 WEBHOOK (opsional)
app.post("/webhook", (req, res) => {
  const event = req.body;

  console.log("Webhook masuk:", event.event_type);

  if (
    event.event_type === "CHECKOUT.ORDER.APPROVED" ||
    event.event_type === "PAYMENT.CAPTURE.COMPLETED"
  ) {
    const email = event.resource?.payer?.email_address;

    if (email) {
      users[email] = { premium: true };
      console.log("User jadi premium:", email);
    }
  }

  res.sendStatus(200);
});

// 🔍 CEK USER PREMIUM
app.get("/check-user", (req, res) => {
  const email = req.query.email;

  if (users[email] && users[email].premium) {
    res.json({ premium: true });
  } else {
    res.json({ premium: false });
  }
});

// 🧪 TEST SERVER
app.get("/", (req, res) => {
  res.send("Backend aktif 🚀");
});

// 🚀 START SERVER
app.listen(3000, () => console.log("Server running on port 3000"));
