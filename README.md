# ParceFlyte

ParceFlyte is a secure peer-to-peer parcel delivery platform that connects senders with trusted travelers (carriers) who can deliver packages along their travel routes. The platform features intelligent matching, KYC/verification, negotiation for delivery fees, and a robust admin dashboard for compliance and risk management.

## Features

- **User Registration & Authentication** (Auth0)
- **KYC/Verification System**: Multi-step onboarding, document upload, risk assessment, admin review
- **Intelligent Matching**: Multi-factor scoring (route, timing, price, rating, capacity)
- **Negotiation System**: Modal/stepper for bargaining delivery fees, with history tracking
- **Admin Dashboard**: KYC review, compliance, and risk analytics
- **Modern UI/UX**: Built with Next.js, Tailwind CSS, Radix UI, and Lucide icons

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS, Radix UI
- **Backend/API**: Next.js API routes, MongoDB (native driver)
- **Authentication**: Auth0 (scope-based access control)
- **Validation**: Zod
- **Other**: React Hook Form, date-fns, Lucide icons

## Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/parceflyte.git
cd parceflyte-v1
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up Environment Variables
Create a `.env.local` file in the root of `parceflyte-v1` with the following:
```env
MONGODB_URI=mongodb://localhost:27017/parceflyte
AUTH0_SECRET=your_auth0_secret
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
AUTH0_CLIENT_ID=your_auth0_client_id
AUTH0_CLIENT_SECRET=your_auth0_client_secret
```

### 4. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Development Notes
- Ensure MongoDB is running locally or update `MONGODB_URI` for your setup.
- Auth0 must be configured for authentication to work.
- Test/demo pages are included for development and should be removed or protected in production.

