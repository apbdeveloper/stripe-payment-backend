document.addEventListener('DOMContentLoaded', async () => {
  // Load the publishable key from the server
  const { publishableKey } = await fetch('/config').then((r) => r.json());
  if (!publishableKey) {
    alert('Please set your Stripe publishable API key in the .env file');
    return;
  }

  const stripe = Stripe(publishableKey, {
    apiVersion: '2020-08-27',
  });

  // Dynamically set return_url based on the page
  const returnUrl = window.location.origin + "/thank-you.html"; // Adjust per form

  // Fetch clientSecret with the dynamic return_url
  const { error: backendError, clientSecret } = await fetch('/create-payment-intent', {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: 1400, // Replace with dynamic amount if needed
      currency: "usd",
      return_url: returnUrl
    })
  }).then(r => r.json());

  if (backendError) {
    console.error(backendError.message);
    return;
  }

  // Initialize Stripe Elements
  const elements = stripe.elements({ clientSecret, loader: 'auto' });
  const paymentElement = elements.create('payment');
  paymentElement.mount('#payment-element');

  // Mount linkAuthenticationElement
  const linkAuthenticationElement = elements.create("linkAuthentication");
  linkAuthenticationElement.mount("#link-authentication-element");

  // Handle form submission
  const form = document.getElementById('payment-form');
  let submitted = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (submitted) return;
    submitted = true;
    form.querySelector('button').disabled = true;

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl
      }
    });

    if (stripeError) {
      console.error(stripeError.message);
      submitted = false;
      form.querySelector('button').disabled = false;
    }
  });
});
