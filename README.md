<p align="center">
  <img src="frontend/assets/logo.png" alt="Pani Chahye Logo" width="180" />
</p>

<h1 align="center">🚰 Pani Chahye — Water Tanker Delivery Platform</h1>

<p align="center">
  A full-stack, real-time water tanker delivery marketplace connecting <b>Customers</b>, <b>Suppliers</b>, and <b>Drivers</b> — built with React Native (Expo) and Node.js.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-React_Native_(Expo_54)-61DAFB?logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/Backend-Node.js_(Express)-339933?logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Database-PostgreSQL_(Supabase)-4169E1?logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/Realtime-Socket.IO-010101?logo=socket.io&logoColor=white" />
  <img src="https://img.shields.io/badge/Deploy-Render-46E3B7?logo=render&logoColor=white" />
</p>

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Database Setup](#1-database-setup)
  - [Backend Setup](#2-backend-setup)
  - [Frontend Setup](#3-frontend-setup)
- [Environment Variables](#-environment-variables)
- [API Reference](#-api-reference)
- [Database Schema](#-database-schema)
- [Real-Time Events](#-real-time-events-socketio)
- [Order Lifecycle](#-order-lifecycle)
- [Authentication Flow](#-authentication-flow)
- [Build & Deployment](#-build--deployment)
- [License](#-license)

---

## 🌊 Overview

**Pani Chahye** ("Need Water" in Urdu) is a mobile-first marketplace for on-demand water tanker delivery. It operates as a three-sided platform:

| Role | Description |
|------|------------|
| **Customer** | Places water delivery orders with a bid price, reviews supplier bids, accepts offers, tracks delivery in real-time, and rates service |
| **Supplier** | Manages a fleet of drivers, browses open customer orders, places competitive bids, assigns drivers, and oversees active deliveries |
| **Driver** | Receives order assignments from their linked supplier, accepts/rejects trips, and manages the ride lifecycle (start → reached → finish) |

The platform uses a **competitive bidding model** — customers post orders with a starting price, multiple suppliers bid, and the customer picks the best offer.

---

## ✨ Key Features

### 🔐 Authentication & Onboarding
- **Phone-based OTP authentication** — no passwords needed
- OTP rate limiting (max 3 per 24-hour window, 1-minute cooldown between sends)
- Max 3 incorrect OTP attempts per issued code
- OTP expires after 10 minutes
- Session-token based auth persisted via AsyncStorage
- Role selection during onboarding (Customer / Supplier / Driver)
- Automatic session restoration on app launch

### 👤 Customer
- Browse standardized water quantities (1,000 – 7,000 gallons) with base pricing
- Place delivery orders with custom bid price and delivery location
- View and compare incoming supplier bids in real-time
- Accept, reject, or update bids
- Track full order lifecycle (open → supplier_timer → accepted → ride_started → reached → finished)
- Cancel orders at any stage (pre-finished)
- Rate suppliers after delivery completion
- View order history with ratings

### 🏢 Supplier
- Register with business contact and yard location
- Manage a driver roster — add/remove drivers by phone number
- View driver online/offline status in real-time
- Browse open customer orders in the marketplace
- Place competitive bids on customer orders
- Receive timed windows to assign a driver after bid acceptance
- Assign available drivers to accepted orders
- Track all active deliveries
- View order history
- Supplier rating system (penalized for late cancellations: −0.2 per infraction)

### 🚛 Driver
- Auto-linked to supplier when matching phone number is registered
- Receive assignment notifications via Socket.IO
- Accept or reject assigned orders within a time window
- Manage ride lifecycle:
  - **Accept Assignment** → **Start Ride** → **Mark Reached** → **Finish Order**
- Automatically set to available/unavailable based on session state
- View order history

### ⚡ Real-Time
- Socket.IO with token-based authentication
- Per-user rooms (`user_{id}`) for targeted notifications
- Supplier broadcast room for marketplace updates
- Driver online/offline notifications to linked suppliers
- Live order status updates pushed to all parties

### 🛡️ Security & Reliability
- Bearer token + session-based authentication
- Role-based endpoint authorization (customer, supplier, driver guards)
- Phone-based rate limiting middleware
- Request timeout handling (15s client-side)
- Automatic cleanup of expired timer states (supplier & driver windows)
- Graceful server shutdown with connection pool cleanup
- Database-level constraints and validation

---

## 🏗 Architecture

```
┌──────────────────────────────────────────────────────┐
│                   React Native (Expo)                │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │ Customer │  │ Supplier │  │      Driver        │  │
│  │Dashboard │  │Dashboard │  │    Dashboard       │  │
│  └────┬─────┘  └────┬─────┘  └────────┬───────────┘  │
│       └──────────────┼────────────────┘               │
│              ┌───────┴────────┐                       │
│              │   API Client   │──── REST (fetch)      │
│              │ Socket Client  │──── WebSocket          │
│              └───────┬────────┘                       │
└──────────────────────┼───────────────────────────────┘
                       │
               ┌───────┴────────┐
               │  Express.js    │
               │  + Socket.IO   │
               │  (Node.js)     │
               └───────┬────────┘
                       │
               ┌───────┴────────┐
               │  PostgreSQL    │
               │  (Supabase)    │
               │  PL/pgSQL      │
               └────────────────┘
```

---

## 🛠 Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Mobile App** | React Native + Expo | RN 0.81.5 / Expo 54 |
| **Navigation** | React Navigation (Native Stack) | v7 |
| **Icons** | Lucide React Native | v1.8 |
| **Maps** | React Native Maps | v1.20.1 |
| **State** | React Hooks + AsyncStorage | — |
| **Backend** | Express.js | v4.18 |
| **Realtime** | Socket.IO | v4.7.5 |
| **Database** | PostgreSQL (Supabase) | — |
| **Auth** | Custom OTP + Session Tokens | — |
| **Validation** | express-validator | v7 |
| **Hashing** | bcrypt | v5.1 |
| **DB Client** | node-postgres (pg) | v8.11 |
| **DB Setup** | Python (psycopg2) | — |
| **Deployment** | Render (backend) / EAS (mobile) | — |

---

## 📂 Project Structure

```
tanker-delivery/
├── backend/                    # Node.js Express API server
│   ├── config/
│   │   └── database.js         # PostgreSQL connection pool (pg)
│   ├── controllers/
│   │   └── startupController.js # All business logic controllers
│   ├── middleware/
│   │   └── phoneRateLimiter.js  # Per-phone rate limiting
│   ├── routes/
│   │   ├── startupRoutes.js    # Auth routes (phone, OTP, startup)
│   │   ├── customerRoutes.js   # Customer API endpoints
│   │   ├── supplierRoutes.js   # Supplier API endpoints
│   │   └── driverRoutes.js     # Driver API endpoints
│   ├── server.js               # Express + HTTP server entry
│   ├── socket.js               # Socket.IO initialization & helpers
│   ├── package.json
│   └── .env                    # Backend environment variables
│
├── frontend/                   # React Native Expo app
│   ├── src/
│   │   ├── api/                # API layer
│   │   │   ├── client.js       # fetch wrapper with timeout & auth
│   │   │   ├── authApi.js      # Auth API calls
│   │   │   ├── customerApi.js  # Customer API calls
│   │   │   ├── supplierApi.js  # Supplier API calls
│   │   │   └── driverApi.js    # Driver API calls
│   │   ├── components/ui/      # Reusable UI components
│   │   │   ├── AppButton.js
│   │   │   ├── AppDropdown.js
│   │   │   ├── AppInput.js
│   │   │   ├── AppLoader.js
│   │   │   ├── BasicButton.js
│   │   │   ├── ErrorBanner.js
│   │   │   ├── ErrorModal.js
│   │   │   └── Toast.js
│   │   ├── constants/
│   │   │   └── config.js       # API_BASE_URL & SOCKET_URL
│   │   ├── navigation/
│   │   │   └── index.js        # React Navigation stack
│   │   ├── screens/
│   │   │   ├── SplashScreen.js
│   │   │   ├── EnterPhoneScreen.js
│   │   │   ├── VerifyOtpScreen.js
│   │   │   ├── EnterDetailsScreen.js
│   │   │   ├── DashboardScreen.js
│   │   │   └── dashboard/
│   │   │       ├── CustomerDashboard.js
│   │   │       ├── SupplierDashboard.js
│   │   │       └── DriverDashboard.js
│   │   ├── state/              # State management
│   │   └── theme/
│   │       └── tokens.js       # Design tokens (colors, spacing, etc.)
│   ├── assets/                 # App icons & splash screens
│   ├── app.json                # Expo configuration
│   ├── eas.json                # EAS Build configuration
│   ├── package.json
│   └── .env                    # Frontend environment variables
│
├── database/                   # SQL schema & setup
│   ├── schema.sql              # Core tables, triggers, functions
│   ├── customer.sql            # Customer-specific DB functions
│   ├── supplier.sql            # Supplier-specific DB functions
│   ├── driver.sql              # Driver-specific DB functions
│   └── db_setup.py             # Python script to initialize DB
│
├── documents/                  # Project documentation
│   ├── business rules.docx
│   ├── code logic.docx
│   ├── database design.docx
│   └── stack.docx
│
├── logo.png                    # App logo
├── requirements.txt            # Python dependencies (db setup)
└── .gitignore
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18.x
- **npm** ≥ 9.x
- **Python** ≥ 3.8 (for database setup only)
- **Expo CLI** — `npm install -g expo-cli`
- **PostgreSQL** database (or a [Supabase](https://supabase.com) project)
- **Android/iOS device** or emulator for mobile testing

### 1. Database Setup

```bash
# Install Python dependencies
pip install -r requirements.txt

# Create your .env in backend/ with DATABASE_URL (see Environment Variables)

# Run the database initialization script
cd database
python db_setup.py
```

This executes the SQL files in order:
1. `schema.sql` — Core tables, triggers, auth functions
2. `customer.sql` — Customer-specific stored procedures
3. `supplier.sql` — Supplier-specific stored procedures
4. `driver.sql` — Driver-specific stored procedures

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env file (see Environment Variables section below)

# Start development server (with hot reload)
npm run dev

# Or start production server
npm start
```

The server starts on `http://localhost:5000` by default.

**Health Check:** `GET http://localhost:5000/health` → `{ "status": "ok" }`

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env file (see Environment Variables section below)

# Start Expo development server
npx expo start

# Or run directly on a platform
npx expo start --android
npx expo start --ios
```

---

## 🔐 Environment Variables

### Backend (`backend/.env`)

```env
# Server
PORT=5000
NODE_ENV=development

# Database — PostgreSQL connection string
DATABASE_URL=postgresql://user:password@host:5432/database

# CORS
CORS_ORIGIN=*
```

### Frontend (`frontend/.env`)

```env
# API base URL (include /api path)
EXPO_PUBLIC_API_BASE_URL=http://localhost:5000/api

# Socket.IO server URL (no path)
EXPO_PUBLIC_SOCKET_URL=http://localhost:5000
```

> **Note:** For production builds, these values are configured in `frontend/eas.json` under the `preview` and `production` build profiles.

---

## 📡 API Reference

All endpoints are prefixed with `/api`. Session tokens are sent via `Authorization: Bearer <token>` header.

### Auth & Startup (`/api/app`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/startup` | Determine next screen based on session state |
| `POST` | `/enter-number` | Register/validate phone number |
| `POST` | `/store-otp` | Store OTP for phone (rate limited) |
| `POST` | `/verify-otp` | Verify OTP and create session (rate limited) |

### Customer (`/api/customer`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/enter-details` | Complete customer profile (name, address) |
| `GET` | `/orders/quantities` | List available water quantities with base prices |
| `GET` | `/orders/current` | Get current active order details |
| `POST` | `/orders/start` | Create a new water delivery order |
| `GET` | `/orders/:orderId/bids` | List bids on customer's open order |
| `PATCH` | `/orders/:orderId/bid` | Update customer's bid price |
| `POST` | `/orders/:orderId/bids/:bidId/reject` | Reject a supplier bid |
| `POST` | `/orders/:orderId/accept-bid` | Accept a supplier bid |
| `POST` | `/orders/:orderId/cancel` | Cancel an order |
| `POST` | `/orders/:orderId/rating` | Submit post-delivery rating |
| `GET` | `/history` | View past order history |
| `GET` | `/history/:orderId` | View specific past order details |
| `POST` | `/logout` | Logout and destroy session |
| `DELETE` | `/` | Delete customer account |

### Supplier (`/api/supplier`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/enter-details` | Complete supplier profile (yard location, business contact) |
| `POST` | `/drivers/add` | Add a driver to roster by phone number |
| `GET` | `/drivers` | List all drivers in roster |
| `DELETE` | `/drivers/remove` | Remove a driver from roster |
| `GET` | `/supplierdriverready` | Check if supplier has any available drivers |
| `GET` | `/orders/available` | Browse open orders in marketplace |
| `GET` | `/orders/available/:orderId` | View details of an available order |
| `POST` | `/orders/:orderId/bids` | Place a bid on an order |
| `GET` | `/orders/active` | List supplier's active orders |
| `GET` | `/orders/active/:orderId` | View active order details |
| `GET` | `/orders/active/:orderId/drivers` | List assignable drivers for an order |
| `POST` | `/orders/active/:orderId/assign-driver` | Assign a driver to an order |
| `POST` | `/orders/active/:orderId/cancel` | Cancel an active order |
| `GET` | `/history` | View past order history |
| `GET` | `/history/:orderId` | View specific past order details |
| `POST` | `/logout` | Logout and destroy session |
| `DELETE` | `/` | Delete supplier account |

### Driver (`/api/driver`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/enter-details` | Complete driver profile |
| `GET` | `/orders/current` | Get current assigned/pending order |
| `GET` | `/orders/:orderId/details` | View assigned order details |
| `POST` | `/orders/:orderId/accept` | Accept an assigned order |
| `POST` | `/orders/:orderId/reject` | Reject an assigned order |
| `POST` | `/orders/:orderId/start-ride` | Start the delivery ride |
| `POST` | `/orders/:orderId/reached` | Mark arrival at customer location |
| `POST` | `/orders/:orderId/finish` | Complete the delivery |
| `POST` | `/orders/:orderId/cancel` | Cancel an assigned order |
| `GET` | `/history` | View past order history |
| `GET` | `/history/:orderId` | View specific past order details |
| `POST` | `/logout` | Logout and destroy session |
| `DELETE` | `/` | Delete driver account |

---

## 🗃 Database Schema

### Tables

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│     users        │     │    suppliers      │     │ supplier_drivers │
├─────────────────┤     ├──────────────────┤     ├──────────────────┤
│ user_id (PK)    │◄────│ user_id (PK,FK)  │◄────│ supplier_user_id │
│ name            │     │ yard_location    │     │ driver_phone_num │
│ phone (UNIQUE)  │     │ business_contact │     │ driver_user_id   │
│ role            │     │ rating           │     │ available        │
│ verified        │     │ total_orders     │     │ joined_at        │
│ created_at      │     │ created_at       │     └──────────────────┘
└─────────────────┘     └──────────────────┘

┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│     orders       │     │      bids        │     │ driver_assignment│
├──────────────────┤     ├──────────────────┤     ├──────────────────┤
│ order_id (PK)    │◄────│ order_id (FK)    │     │ order_id (FK)    │
│ customer_id (FK) │     │ supplier_id (FK) │     │ driver_id (FK)   │
│ supplier_id (FK) │     │ bid_price        │     │ supplier_id (FK) │
│ driver_id (FK)   │     │ created_at       │     │ time_limit       │
│ delivery_location│     └──────────────────┘     │ order_rejected   │
│ requested_capacity│                             └──────────────────┘
│ customer_bid_price│
│ status           │     ┌──────────────────┐     ┌──────────────────┐
│ accepted_price   │     │  order_history   │     │    sessions      │
│ time_limit_*     │     ├──────────────────┤     ├──────────────────┤
│ created_at       │     │ history_id (PK)  │     │ token (PK)       │
│ updated_at       │     │ order_id         │     │ user_id (FK)     │
└──────────────────┘     │ all parties info │     └──────────────────┘
                         │ price, quantity  │
                         │ status, rating   │
                         └──────────────────┘

┌──────────────────┐     ┌──────────────────┐
│  pending_users   │     │ quantity_pricing  │
├──────────────────┤     ├──────────────────┤
│ phone (PK)       │     │ quantity (PK)    │
│ otp              │     │ base_price       │
│ otp_attempt_count│     └──────────────────┘
│ otp_sent_count   │
│ timestamps       │
└──────────────────┘
```

### Key Database Functions (PL/pgSQL)

| Function | Purpose |
|----------|---------|
| `check_session()` | Validate session token → return user_id |
| `phone_number_exists()` | Register/check phone in pending_users |
| `store_otp()` | Store OTP with rate limiting & cooldown logic |
| `verify_otp_and_activate_user()` | Verify OTP, create/activate user, create session |
| `create_session()` | Generate 64-char hex token, enforce single session per user |
| `cancel_order()` | Cancel order with history tracking & rating penalties |
| `cleanup_expired_failures()` | GC for expired driver assignments & supplier timers |
| `view_past_orders()` | Role-aware order history retrieval |

### Triggers

| Trigger | Table | Purpose |
|---------|-------|---------|
| `trigger_unlink_driver_on_session_delete` | `sessions` | When a driver's session is deleted, set their `driver_user_id` to NULL in `supplier_drivers` for clean re-linking |

---

## 🔌 Real-Time Events (Socket.IO)

### Connection

Clients connect with session token authentication:

```javascript
const socket = io(SOCKET_URL, {
  auth: { token: sessionToken },
  transports: ['websocket'],
});
```

### Rooms

| Room | Members | Purpose |
|------|---------|---------|
| `user_{userId}` | Individual user | Targeted notifications |
| `suppliers` | All supplier users | Marketplace broadcast |

### Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `available_drivers_updated` | Server → Supplier | A linked driver came online/offline |
| `order_status_updated` | Server → User | Order state changed |
| `new_bid_received` | Server → Customer | New bid on their order |
| `driver_assigned` | Server → Driver | New order assignment |

---

## 🔄 Order Lifecycle

```
Customer places order
        │
        ▼
   ┌─────────┐
   │  OPEN   │ ◄── Suppliers can see & bid
   └────┬────┘
        │ Customer accepts a bid
        ▼
┌───────────────┐
│ SUPPLIER_TIMER│ ◄── Supplier must assign a driver within time window
└───────┬───────┘
        │ Driver assigned & accepts
        ▼
   ┌──────────┐
   │ ACCEPTED │ ◄── Driver confirmed, preparing for delivery
   └────┬─────┘
        │ Driver starts ride
        ▼
┌──────────────┐
│ RIDE_STARTED │ ◄── Tanker is en route
└──────┬───────┘
       │ Driver arrives
       ▼
   ┌──────────┐
   │ REACHED  │ ◄── Tanker at customer location
   └────┬─────┘
        │ Driver completes delivery
        ▼
   ┌──────────┐
   │ FINISHED │ ◄── Delivery complete, customer can rate
   └──────────┘
```

> **Cancellation:** Orders can be cancelled at any stage before `FINISHED`. Cancellations after `ACCEPTED` incur a supplier rating penalty (−0.2) if initiated by supplier/driver.

> **Timer Expiry:** Expired supplier timers and driver assignments are automatically cleaned up by `cleanup_expired_failures()`.

---

## 🔐 Authentication Flow

```
┌──────────┐     POST /enter-number      ┌──────────────┐
│  Phone   │ ──────────────────────────► │ Pending User  │
│  Entry   │                             │ Created in DB │
└──────────┘                             └──────┬───────┘
                                                │
┌──────────┐     POST /store-otp         ┌──────┴───────┐
│  OTP     │ ──────────────────────────► │  OTP Stored   │
│  Send    │                             │ (6-digit)     │
└──────────┘                             └──────┬───────┘
                                                │
┌──────────┐     POST /verify-otp        ┌──────┴───────┐
│  OTP     │ ──────────────────────────► │ User Created/ │
│  Verify  │                             │ Activated +   │
└──────────┘                             │ Session Token │
                                         └──────┬───────┘
                                                │
                                 ┌──────────────┴──────────────┐
                                 │                             │
                            New User                    Returning User
                           (role=undefined)              (role=customer/
                                 │                     supplier/driver)
                                 ▼                             │
                         Enter Details                         ▼
                         Screen                          Dashboard
```

---

## 🏗 Build & Deployment

### Backend (Render)

The backend is deployed on [Render](https://render.com) at:
```
https://render-tanker-delivery.onrender.com
```

To deploy your own instance:
1. Push the `backend/` directory to a Git repository
2. Create a new **Web Service** on Render
3. Set the build command: `npm install`
4. Set the start command: `npm start`
5. Add environment variables (see above)

### Frontend (EAS Build)

> **📦 Download the latest Android APK:**
> [https://expo.dev/accounts/expo_go12345/projects/pani-chahye/builds/43587a23-76e7-4a1f-b00e-5fd850fcbafa](https://expo.dev/accounts/expo_go12345/projects/pani-chahye/builds/43587a23-76e7-4a1f-b00e-5fd850fcbafa)

The mobile app is built using [Expo Application Services (EAS)](https://expo.dev/eas):

```bash
cd frontend

# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build for Android (preview/internal testing)
eas build --platform android --profile preview

# Build for Android (production)
eas build --platform android --profile production

# Build for iOS
eas build --platform ios --profile production
```

### Quantity Pricing (Pre-configured)

| Gallons | Base Price (PKR) |
|---------|-----------------|
| 1,000 | ₨ 6,500 |
| 2,000 | ₨ 10,000 |
| 3,000 | ₨ 15,000 |
| 4,000 | ₨ 22,000 |
| 5,000 | ₨ 25,000 |
| 6,000 | ₨ 30,000 |
| 7,000 | ₨ 35,000 |

---

## 📄 License

This project is licensed under the [ISC License](https://opensource.org/licenses/ISC).

---

