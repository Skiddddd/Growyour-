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
