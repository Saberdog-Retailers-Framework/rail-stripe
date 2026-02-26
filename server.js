const express = require('express');
const Stripe = require('stripe');
const app = express();
app.use(express.json());

const stripe = Stripe(process.env.STRIPE_SECRET_KEY); // sk_live_ or sk_test_

// 1. Create PaymentIntent when buyer starts checkout
app.post('/api/create-payment-intent', async (req, res) => {
  const { amount, procurementId, description = 'SABERDOG LLC Procurement Payment' } = req.body; // amount in cents, e.g. 150000 = $1,500.00

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,                    // required, cents
      currency: 'usd',
      automatic_payment_methods: { enabled: true }, // enables cards + wallets
      metadata: {
        procurement_id: procurementId,
        company: 'SABERDOG LLC',
        description,
      },
      // Optional for procurement holds:
      // capture_method: 'manual',   // authorize only, capture later
      // setup_future_usage: 'off_session' // if saving card for future
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Webhook endpoint (MUST implement – this is how you know payment succeeded)
app.post('/api/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('✅ Payment succeeded!', paymentIntent.metadata.procurement_id);
      // Update your procurement record → mark as PAID, send email, release goods, etc.
      break;

    case 'payment_intent.payment_failed':
      console.log('❌ Payment failed', event.data.object.last_payment_error);
      break;
  }

  res.json({ received: true });
});

app.listen(3000, () => console.log('Server running → http://localhost:3000'));
