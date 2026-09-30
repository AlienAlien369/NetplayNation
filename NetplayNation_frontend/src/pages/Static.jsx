import { Link, useParams } from 'react-router-dom';
import { useTitle } from '../components/ui';
import { SITE } from '../site';

const POLICIES = {
  shipping: {
    title: 'Shipping',
    body: (
      <>
        <h2>Delivery times</h2>
        <p>Orders are packed within 1 to 2 business days. Delivery usually takes 3 to 7 business days depending on your pincode.</p>
        <h2>Shipping charges</h2>
        <p>Shipping is free on orders of ₹999 and above. Smaller orders have a flat shipping fee shown at checkout before you pay.</p>
        <h2>Tracking</h2>
        <p>You can follow every order from the <Link to="/orders">My orders</Link> page, from placed to delivered.</p>
        <h2>Payment options</h2>
        <p>Pay online with UPI, cards or net banking, or choose cash on delivery where available.</p>
      </>
    ),
  },
  returns: {
    title: 'Returns and refunds',
    body: (
      <>
        <h2>7-day returns</h2>
        <p>You can return unused items in their original packaging within 7 days of delivery. Contact us with your order number to start a return.</p>
        <h2>Items we cannot take back</h2>
        <p>Grips, shuttles and other items that are opened or used, and any item marked as non-returnable on its page.</p>
        <h2>Refunds</h2>
        <p>Once we receive and check the item, online payments are refunded to the original payment method within 5 to 7 business days. Cash on delivery refunds are sent by bank transfer or UPI.</p>
        <h2>Cancellations</h2>
        <p>You can cancel an order from My orders until it is packed. If you already paid online, contact us and we will refund you.</p>
      </>
    ),
  },
  privacy: {
    title: 'Privacy',
    body: (
      <>
        <h2>What we collect</h2>
        <p>Your name, email, delivery address, phone number and order history, so we can deliver your orders and support you.</p>
        <h2>Payments</h2>
        <p>Online payments are processed by Razorpay. We never see or store your card details.</p>
        <h2>Cookies</h2>
        <p>We use one essential cookie to keep you signed in. We do not use advertising cookies.</p>
        <h2>Your data</h2>
        <p>We do not sell your data. To ask for a copy or to delete your account, email us at {SITE.email}.</p>
      </>
    ),
  },
  terms: {
    title: 'Terms of use',
    body: (
      <>
        <h2>Orders</h2>
        <p>An order is confirmed once it shows as placed in My orders. We may cancel an order if an item is unavailable or a price was listed in error, and we will refund any payment made.</p>
        <h2>Prices</h2>
        <p>All prices are in Indian rupees and include applicable taxes. Prices and stock can change without notice.</p>
        <h2>Accounts</h2>
        <p>You are responsible for keeping your password safe and for the activity on your account.</p>
        <h2>Contact</h2>
        <p>Questions about these terms: {SITE.email}.</p>
      </>
    ),
  },
};

export function Policy() {
  const { slug } = useParams();
  const policy = POLICIES[slug];
  useTitle(policy?.title);
  if (!policy) return <NotFound />;
  return (
    <div className="container page page-enter">
      <div className="prose">
        <h1>{policy.title}</h1>
        {policy.body}
      </div>
    </div>
  );
}

export function About() {
  useTitle('About us');
  return (
    <div className="container page page-enter">
      <div className="prose">
        <h1>About {SITE.name}</h1>
        <p>{SITE.name} is an online store for sports gear across India. We started with badminton and now stock cricket, football, running, fitness and tennis equipment.</p>
        <p>We keep things simple: fair prices, honest product descriptions, tracked delivery, and the option to pay on delivery.</p>
        <h2>Talk to us</h2>
        <p>Email <a href={`mailto:${SITE.email}`} className="link-more">{SITE.email}</a> or call {SITE.phone}.</p>
        <p style={{ marginTop: 20 }}><Link to="/shop" className="btn btn-primary">Shop the range</Link></p>
      </div>
    </div>
  );
}

export function NotFound() {
  useTitle('Page not found');
  return (
    <div className="container page empty">
      <h1>Page not found</h1>
      <p className="muted">The page you are looking for does not exist.</p>
      <Link className="btn btn-primary" to="/">Go to the home page</Link>
    </div>
  );
}
