const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');
const env = require('dotenv').config({ path: './.env' });

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  appInfo: {
    name: "stripe-samples/accept-a-payment/payment-element",
    version: "0.0.2",
    url: "https://github.com/stripe-samples"
  }
});

// Ensure STATIC_DIR exists
const staticDir = process.env.STATIC_DIR || path.join(__dirname, "public");
if (!fs.existsSync(staticDir)) {
  fs.mkdirSync(staticDir, { recursive: true });
}
app.use(express.static(staticDir));

app.use(express.json({
  verify: function (req, res, buf) {
    if (req.originalUrl.startsWith('/webhook')) {
      req.rawBody = buf.toString();
    }
  },
}));

// Serve the frontend
app.get('/', (req, res) => {
  const indexPath = path.join(staticDir, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send("⚠️ index.html not found.");
  }
});

// Send Stripe publishable key to frontend
app.get('/config', (req, res) => {
  res.send({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
});

// Create PaymentIntent with dynamic return_url
app.post('/create-payment-intent', async (req, res) => {
  const { amount, currency, return_url } = req.body;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: { return_url }
    });

    res.send({ clientSecret: paymentIntent.client_secret });
  } catch (e) {
    res.status(400).send({ error: { message: e.message } });
  }
});

// Webhook endpoint for Stripe events
app.post('/webhook', async (req, res) => {
  let data, eventType;

  if (process.env.STRIPE_WEBHOOK_SECRET) {
    let signature = req.headers['stripe-signature'];
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.log(`⚠️ Webhook signature verification failed.`);
      return res.sendStatus(400);
    }
    data = event.data;
    eventType = event.type;
  } else {
    data = req.body.data;
    eventType = req.body.type;
  }

  if (eventType === 'payment_intent.succeeded') {
    console.log('💰 Payment captured!');
  } else if (eventType === 'payment_intent.payment_failed') {
    console.log('❌ Payment failed.');
  }
  res.sendStatus(200);
});

module.exports = app;
