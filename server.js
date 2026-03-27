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

// ambil access token PayPal
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
  return data.access_token;
}

// CREATE ORDER
app.post("/create-order", async (req, res) => {
  const { plan, email } = req.body;
  const price = PRICES[plan];

  if (!price) {
    return res.status(400).json({ error: "Invalid plan" });
  }

  // simpan user sementara (belum premium)
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
  res.json(data);
});

// CAPTURE ORDER
app.post("/capture-order", async (req, res) => {
  const { orderID } = req.body;

  const token = await getAccessToken();

  const response = await fetch(`https://api-m.paypal.com/v2/checkout/orders/${orderID}/capture`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });

  const data = await response.json();
  res.json(data);
});

// WEBHOOK PAYPAL (ANTI FAKE PAYMENT)
app.post("/webhook", (req, res) => {

  const event = req.body;

  console.log("Webhook masuk:", event.event_type);

  // jika pembayaran benar-benar selesai
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

// CEK USER PREMIUM
app.get("/check-user", (req, res) => {
  const email = req.query.email;

  if (users[email] && users[email].premium) {
    res.json({ premium: true });
  } else {
    res.json({ premium: false });
  }
});

// TEST SERVER
app.get("/", (req, res) => {
  res.send("Backend aktif 🚀");
});

app.listen(3000, () => console.log("Server running"));
