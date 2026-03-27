const express = require("express");
const fetch = require("node-fetch");
const app = express();

app.use(express.json());

// ambil dari ENV (Railway)
const CLIENT_ID = process.env.CLIENT_ID;
const SECRET = process.env.SECRET;

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
  const { plan } = req.body;
  const price = PRICES[plan];

  if (!price) {
    return res.status(400).json({ error: "Invalid plan" });
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

// test endpoint
app.get("/", (req, res) => {
  res.send("Backend aktif 🚀");
});

app.listen(3000, () => console.log("Server running"));
