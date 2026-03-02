# Tlaka Treats - Platform

A bakery and community-commerce platform built on:
- **Backend**: Node.js + Fastify + Prisma + PostgreSQL
- **Mobile**: React Native (Expo)

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 20+
- PostgreSQL running locally
- Expo Go app on your phone

### 2. Clone & Install

```bash
cd ~/Projects
git clone <your-repo-url> tlaka-treats
cd tlaka-treats

# Install backend dependencies
cd api && npm install

# Install mobile dependencies
cd ../mobile && npm install
```

### 3. Set Up the Database

```bash
# Create your .env file
cd api
cp .env.example .env

# Edit .env and update DATABASE_URL with your PostgreSQL credentials
# e.g. postgresql://postgres:yourpassword@localhost:5432/tlaka_treats

# Create the database (run in psql or TablePlus)
# CREATE DATABASE tlaka_treats;

# Run migrations
npm run db:migrate

# Generate Prisma client
npm run db:generate

# Seed the database (creates roles, admin user, sample products)
npm run db:seed
```

### 4. Start the Backend

```bash
cd api
npm run dev
```

API will be running at `http://localhost:3000`

Test it: `curl http://localhost:3000/health`

### 5. Start the Mobile App

```bash
cd mobile
npm run start
```

Scan the QR code with Expo Go on your phone.

---

## 👤 Default Admin Credentials

```
Email: admin@tlakatreats.co.za
Password: Admin@12345
```

⚠️ **Change this password after first login!**

---

## 📁 Project Structure

```
tlaka-treats/
├── api/                      # Fastify backend
│   └── src/
│       ├── modules/          # Feature modules
│       │   ├── auth/
│       │   ├── products/
│       │   ├── orders/
│       │   └── ambassadors/
│       ├── shared/           # Middleware, plugins, utils
│       ├── config/
│       └── prisma/           # Schema + seed
└── mobile/                   # Expo React Native app
    └── app/
        ├── (auth)/           # Login, Register
        ├── (customer)/       # Customer screens
        ├── (ambassador)/     # Ambassador screens
        └── (admin)/          # Admin screens
```

---

## 🔑 API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /auth/register | - | Register user |
| POST | /auth/login | - | Login |
| GET | /auth/me | ✅ | Get profile |
| GET | /products | - | List products |
| GET | /products/:id | - | Product detail |
| POST | /products | Admin | Create product |
| POST | /orders | Customer | Place order |
| GET | /orders/my | Customer | My orders |
| GET | /orders/ambassador | Ambassador | Attributed orders |
| PATCH | /orders/:id/status | Admin | Update status |
| POST | /ambassadors/apply | Customer | Apply as ambassador |
| GET | /ambassadors/me | Ambassador | My ambassador profile |
| PATCH | /ambassadors/:id/status | Admin | Approve/suspend |

---

## 🚢 Deployment

- **Backend**: Railway (connect GitHub repo)
- **Mobile**: Expo EAS (`eas build`)
