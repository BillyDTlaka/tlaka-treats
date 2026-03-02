#!/bin/bash

set -e

echo "🍪 Setting up Tlaka Treats..."

# ─── Backend ──────────────────────────────────────────────────────────────────
echo ""
echo "📦 Installing backend dependencies..."
cd api
npm install

echo ""
echo "⚙️  Setting up environment..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✅ Created api/.env - please update DATABASE_URL with your PostgreSQL credentials"
else
  echo "ℹ️  api/.env already exists, skipping"
fi

cd ..

# ─── Mobile ───────────────────────────────────────────────────────────────────
echo ""
echo "📦 Installing mobile dependencies..."
cd mobile
npm install
cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Next Steps:"
echo ""
echo "  1. Edit api/.env and update DATABASE_URL"
echo "  2. Create PostgreSQL database: CREATE DATABASE tlaka_treats;"
echo "  3. cd api && npm run db:migrate && npm run db:seed"
echo "  4. Start backend: cd api && npm run dev"
echo "  5. Start mobile: cd mobile && npm run start"
echo ""
echo "  Admin login: admin@tlakatreats.co.za / Admin@12345"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
