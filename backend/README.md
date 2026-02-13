# Tanker Delivery Management System - Backend API

## Overview

Backend API for the Tanker Delivery Management System built with Express.js and PostgreSQL.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL (Supabase)
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcrypt
- **Validation**: express-validator

## Project Structure

```
backend/
├── config/
│   └── database.js          # Database connection configuration
├── middleware/
│   └── authMiddleware.js    # Authentication & authorization middleware
├── routes/
│   ├── authRoutes.js        # Authentication routes
│   ├── customerRoutes.js    # Customer management routes
│   ├── driverRoutes.js      # Driver management routes
│   ├── supplierRoutes.js    # Supplier management routes
│   └── orderRoutes.js       # Order management routes
├── controllers/             # Route controllers (implemented)
├── models/                  # Database models
├── utils/                   # Utility functions
├── .env.example             # Environment variables template
├── .gitignore
├── package.json
└── server.js               # Main application entry point
```

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- Oracle Database
- npm or yarn

### Installation

1. **Navigate to backend directory**

   ```bash
   cd backend
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**
   - Copy `.env.example` to `.env`

   ```bash
   copy .env.example .env
   ```

   - Update the following variables in `.env`:
     - `DATABASE_URL`: Your PostgreSQL connection string
     - `JWT_SECRET`: A secure random string for JWT signing
     - `PORT`: Server port (default: 5000)

4. **Ensure database is set up**
   - Make sure you've run the database setup scripts from the `/database` folder

### Running the Application

**Development mode (with auto-reload)**

```bash
npm run dev
```

**Production mode**

```bash
npm start
```

The server will start on `http://localhost:5000` (or your configured PORT)

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user

### Customers

- `GET /api/customers` - Get all customers
- `GET /api/customers/:id` - Get customer by ID
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer

### Drivers

- `GET /api/drivers` - Get all drivers
- `GET /api/drivers/:id` - Get driver by ID
- `PUT /api/drivers/:id` - Update driver
- `PUT /api/drivers/:id/status` - Update driver status

### Suppliers

- `GET /api/suppliers` - Get all suppliers
- `GET /api/suppliers/:id` - Get supplier by ID
- `PUT /api/suppliers/:id` - Update supplier

### Orders

- `POST /api/orders` - Create new order
- `GET /api/orders` - Get all orders
- `GET /api/orders/:id` - Get order by ID
- `PUT /api/orders/:id` - Update order
- `PUT /api/orders/:id/status` - Update order status
- `DELETE /api/orders/:id` - Cancel order

### Health Check

- `GET /health` - Check server status

## Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Development Status

✅ **Current Status**: Backend API structure complete with PostgreSQL integration and all controllers implemented.

### Completed

- ✅ Express server setup with middleware
- ✅ PostgreSQL database connection
- ✅ JWT authentication system
- ✅ All route handlers (auth, customers, drivers, suppliers, orders)
- ✅ Controllers with database queries
- ✅ Error handling and response helpers

### Next Steps

1. Add file upload functionality for CNIC images (suppliers)
2. Implement OTP verification system
3. Add WebSocket support for real-time updates
4. Add request rate limiting
5. Implement comprehensive logging system
6. Add API documentation (Swagger/OpenAPI)
7. Write unit and integration tests

## Error Handling

The API returns consistent error responses:

```json
{
  "success": false,
  "message": "Error description"
}
```

## Contributing

Follow standard Node.js/Express best practices and maintain consistent code style.
