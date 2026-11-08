# Firebase setup

1. Firebase Console -> create a project -> add a **Web app** and copy its config.
2. Copy the values into `.env` (see `.env.example`, `VITE_FIREBASE_*`). Set the same vars in Netlify.
3. **Authentication** -> Sign-in method -> enable **Email/Password**.
   Add your deployed domain under Authentication -> Settings -> Authorized domains.
4. **Firestore Database** -> create database, then publish `firestore.rules`
   (paste in Rules tab, or `firebase deploy --only firestore:rules`).
5. `npm install` (or `bun install`) to fetch the `firebase` package.
6. Create the admin: sign up in the app, then in Firestore open
   `profiles/<that user's uid>` and set `role` to `ADMIN`.
7. (Optional) Seed wallet addresses: create `system_config/main` with fields
   `btcAddress`, `ethAddress`, `solAddress` (or just save them once from the admin panel).

## Data model
- `profiles/{uid}`: email, fullName, role, balance, isActive, createdAt
- `transactions/{autoId}`: userId, userEmail, type, amount, status, method, planId, date
- `system_config/main`: btcAddress, ethAddress, solAddress

## Account approval & support chat
- New sign-ups are created with `accountStatus: PENDING` and cannot sign in until an admin
  approves them in **User Directory** (Approve / Reject buttons). Admins and older accounts
  without a status are treated as approved.
- Customer support chat uses the `support_messages` collection. Users chat from
  **Customer Support**, admins reply from **Support Inbox**.
- After updating, re-publish `firestore.rules` (Firestore -> Rules -> paste -> Publish).
- To create the first admin: sign up, then in Firestore set the profile's `role` to `ADMIN`
  (admins are always allowed to sign in, even if the status still says PENDING).

## Email verification code (sign-up)
Flow: sign up -> 6-digit code emailed -> user enters it -> account is "email verified" but still
PENDING -> admin approves in User Directory -> user can sign in.
Unverified accounts show "Awaiting email code" instead of an Approve button.

Server functions live in `api/` (Vercel runs them automatically). Add these in
Vercel -> Settings -> Environment Variables, then Redeploy:

| Name | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | the whole JSON file from Firebase > Project settings > Service accounts |
| `RESEND_API_KEY` **or** `BREVO_API_KEY` | API key from your email provider (use one) |
| `EMAIL_FROM` | sender address, e.g. `no-reply@yourdomain.com` |
| `EMAIL_FROM_NAME` | `EquityVest Pro` |

- **Resend:** you must verify a domain you own, then send from an address on it.
  (The test sender `onboarding@resend.dev` only delivers to your own email.)
- **Brevo:** no domain needed. Verify a single sender address under Senders, and use it as `EMAIL_FROM`.
- Never put the service-account JSON in GitHub or in a `VITE_` variable.
- Re-publish `firestore.rules` after this update.

## Approval email
When an admin taps **Approve**, the user gets a "your account is approved" email (sent once).
It uses the same Brevo setup. Optional Vercel variable `SITE_URL` (default `https://equityvestpro.com`)
sets the sign-in link in the email. Accounts approved by hand in the Firestore console are not emailed.
