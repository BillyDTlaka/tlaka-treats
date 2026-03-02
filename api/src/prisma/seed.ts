import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const db = prisma as any

// ─── Helpers ──────────────────────────────────────────────────────────────────
const daysAgo  = (n: number) => new Date(Date.now() - n * 86_400_000)
const hoursAgo = (n: number) => new Date(Date.now() - n * 3_600_000)

function orderTotals(items: Array<{ unitPrice: number; quantity: number }>, deliveryFee = 0) {
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  return { subtotal: +subtotal.toFixed(2), deliveryFee, total: +(subtotal + deliveryFee).toFixed(2) }
}

async function main() {
  console.log('🌱 Seeding database…')

  // ─── Clean slate (FK-safe order) ────────────────────────────────────────────
  await db.financeTransaction.deleteMany({})   // references order, bankTransaction, financeAccount
  await db.bankTransaction.deleteMany({})
  await db.bankAccount.deleteMany({})
  await db.financeAccount.deleteMany({})
  await db.stockMovement.deleteMany({})
  await db.purchaseOrderItem.deleteMany({})
  await db.purchaseOrder.deleteMany({})
  await db.recipeIngredient.deleteMany({})
  await db.productionRun.deleteMany({})
  await db.recipe.deleteMany({})
  await db.stockItem.deleteMany({})
  await db.orderItem.deleteMany({})
  await db.orderStatusLog.deleteMany({})
  await db.commission.deleteMany({})
  await prisma.order.deleteMany({})
  await prisma.variantPrice.deleteMany({})
  await prisma.productVariant.deleteMany({})
  await db.product.deleteMany({})
  await db.supplier.deleteMany({})
  await prisma.category.deleteMany({})
  await db.payout.deleteMany({})
  await db.ambassador.deleteMany({})
  await prisma.address.deleteMany({})
  await prisma.userRole.deleteMany({})
  await prisma.user.deleteMany({})
  await prisma.permission.deleteMany({})
  await prisma.role.deleteMany({})
  console.log('🧹  Cleaned existing data')

  // ─── Roles & Permissions ────────────────────────────────────────────────────
  const adminRole = await prisma.role.create({
    data: {
      name: 'ADMIN', description: 'Full system access',
      permissions: { create: [
        { action: 'manage', subject: 'user' },
        { action: 'manage', subject: 'order' },
        { action: 'manage', subject: 'product' },
        { action: 'manage', subject: 'commission' },
        { action: 'manage', subject: 'payout' },
        { action: 'manage', subject: 'ambassador' },
      ]},
    },
  })
  const ambassadorRole = await prisma.role.create({
    data: {
      name: 'AMBASSADOR', description: 'Sources customers, earns commissions',
      permissions: { create: [
        { action: 'read', subject: 'product' },
        { action: 'read', subject: 'order' },
        { action: 'read', subject: 'commission' },
      ]},
    },
  })
  const customerRole = await prisma.role.create({
    data: {
      name: 'CUSTOMER', description: 'Places orders',
      permissions: { create: [
        { action: 'read',   subject: 'product' },
        { action: 'create', subject: 'order'   },
        { action: 'read',   subject: 'order'   },
      ]},
    },
  })
  console.log('✅  Roles seeded')

  // ─── Admin User ─────────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('Admin@12345', 12)
  const admin = await prisma.user.create({
    data: {
      email: 'admin@tlakatreats.co.za', firstName: 'Billy', lastName: 'Tlaka',
      passwordHash: adminPassword,
      roles: { create: { roleId: adminRole.id } },
    },
  })
  console.log('✅  Admin:', admin.email)

  // ─── Customers ───────────────────────────────────────────────────────────────
  const custPw = await bcrypt.hash('Customer@123', 12)
  const [nomsa, thabo, priya, lisa, sipho, aisha] = await Promise.all([
    prisma.user.create({ data: { email: 'nomsa.dlamini@gmail.com',       firstName: 'Nomsa',   lastName: 'Dlamini',   phone: '0821234567', passwordHash: custPw, roles: { create: { roleId: customerRole.id } } } }),
    prisma.user.create({ data: { email: 'thabo.mokoena@gmail.com',       firstName: 'Thabo',   lastName: 'Mokoena',   phone: '0839876543', passwordHash: custPw, roles: { create: { roleId: customerRole.id } } } }),
    prisma.user.create({ data: { email: 'priya.naidoo@outlook.com',      firstName: 'Priya',   lastName: 'Naidoo',    phone: '0764455667', passwordHash: custPw, roles: { create: { roleId: customerRole.id } } } }),
    prisma.user.create({ data: { email: 'lisa.van.wyk@webmail.co.za',    firstName: 'Lisa',    lastName: 'Van Wyk',   phone: '0711223344', passwordHash: custPw, roles: { create: { roleId: customerRole.id } } } }),
    prisma.user.create({ data: { email: 'sipho.ndlovu@gmail.com',        firstName: 'Sipho',   lastName: 'Ndlovu',    phone: '0792223344', passwordHash: custPw, roles: { create: { roleId: customerRole.id } } } }),
    prisma.user.create({ data: { email: 'aisha.patel@icloud.com',        firstName: 'Aisha',   lastName: 'Patel',     phone: '0861234321', passwordHash: custPw, roles: { create: { roleId: customerRole.id } } } }),
  ])
  console.log('✅  Customers: 6')

  // ─── Addresses ───────────────────────────────────────────────────────────────
  const [addrNomsa, addrThabo, addrPriya, addrLisa, addrSipho, addrAisha] = await Promise.all([
    prisma.address.create({ data: { userId: nomsa.id, label: 'Home', street: '14 Jacaranda St', suburb: 'Naturena',   city: 'Johannesburg', province: 'Gauteng',        postalCode: '1835', isDefault: true } }),
    prisma.address.create({ data: { userId: thabo.id, label: 'Home', street: '7 Acacia Ave',    suburb: 'Soweto',     city: 'Johannesburg', province: 'Gauteng',        postalCode: '1804', isDefault: true } }),
    prisma.address.create({ data: { userId: priya.id, label: 'Home', street: '22 Palm Rd',      suburb: 'Lenasia',    city: 'Johannesburg', province: 'Gauteng',        postalCode: '1820', isDefault: true } }),
    prisma.address.create({ data: { userId: lisa.id,  label: 'Home', street: '5 Berg St',       suburb: 'Randburg',   city: 'Johannesburg', province: 'Gauteng',        postalCode: '2194', isDefault: true } }),
    prisma.address.create({ data: { userId: sipho.id, label: 'Home', street: '33 Oak Rd',       suburb: 'Tembisa',    city: 'Ekurhuleni',   province: 'Gauteng',        postalCode: '1632', isDefault: true } }),
    prisma.address.create({ data: { userId: aisha.id, label: 'Home', street: '88 Lotus Rd',     suburb: 'Laudium',    city: 'Pretoria',     province: 'Gauteng',        postalCode: '0037', isDefault: true } }),
  ])
  console.log('✅  Addresses: 6')

  // ─── Ambassador Users ─────────────────────────────────────────────────────────
  const ambPw = await bcrypt.hash('Ambassador@123', 12)
  const [ambUser1, ambUser2, ambUser3] = await Promise.all([
    prisma.user.create({ data: { email: 'zanele.khumalo@gmail.com',  firstName: 'Zanele',   lastName: 'Khumalo', phone: '0835559988', passwordHash: ambPw, roles: { create: [{ roleId: customerRole.id }, { roleId: ambassadorRole.id }] } } }),
    prisma.user.create({ data: { email: 'michael.ferreira@gmail.com',firstName: 'Michael',  lastName: 'Ferreira',phone: '0724448899', passwordHash: ambPw, roles: { create: [{ roleId: customerRole.id }, { roleId: ambassadorRole.id }] } } }),
    prisma.user.create({ data: { email: 'sibusiso.zulu@gmail.com',   firstName: 'Sibusiso', lastName: 'Zulu',    phone: '0612227788', passwordHash: ambPw, roles: { create: [{ roleId: customerRole.id }, { roleId: ambassadorRole.id }] } } }),
  ])

  const [zane, michael, sibu] = await Promise.all([
    db.ambassador.create({ data: {
      userId: ambUser1.id, code: 'TT-ZANE7823', commissionRate: 0.12, status: 'ACTIVE',
      bio: 'Passionate foodie and mom of 3. Love sharing Tlaka Treats with my community!',
      kycStatus: 'APPROVED',
      kycData: { phone: '0835559988', address: { street: '2 Flame Lily St', suburb: 'Protea Glen', city: 'Johannesburg', province: 'Gauteng', postalCode: '1818' }, idType: 'ID_BOOK', idNumber: '8504150XXXX084', submittedAt: daysAgo(60).toISOString() },
    }}),
    db.ambassador.create({ data: {
      userId: ambUser2.id, code: 'TT-MICH4419', commissionRate: 0.10, status: 'ACTIVE',
      bio: 'Gym trainer and health enthusiast promoting quality baked goods.',
      kycStatus: 'SUBMITTED',
      kycData: { phone: '0724448899', address: { street: '45 Cosmos Rd', suburb: 'Kempton Park', city: 'Ekurhuleni', province: 'Gauteng', postalCode: '1619' }, idType: 'PASSPORT', idNumber: 'M234567XX', submittedAt: daysAgo(10).toISOString() },
    }}),
    db.ambassador.create({ data: {
      userId: ambUser3.id, code: 'TT-SIBU0312', commissionRate: 0.10, status: 'ACTIVE',
      bio: 'Community leader in Soweto. Tlaka Treats is my go-to gifting brand.',
      kycStatus: 'APPROVED',
      kycData: { phone: '0612227788', address: { street: '18 Bougainvillea Ln', suburb: 'Diepkloof', city: 'Johannesburg', province: 'Gauteng', postalCode: '1864' }, idType: 'ID_BOOK', idNumber: '9011235XXXX088', submittedAt: daysAgo(45).toISOString() },
    }}),
  ])
  console.log('✅  Ambassadors: 3 (Zanele ACTIVE/KYC APPROVED, Michael ACTIVE/KYC SUBMITTED, Sibusiso ACTIVE/KYC APPROVED)')

  // ─── Categories ──────────────────────────────────────────────────────────────
  const [catBiscuits, catScones, catCakes, catBread] = await Promise.all([
    prisma.category.create({ data: { name: 'Biscuits', description: 'Freshly baked biscuits and cookies' } }),
    prisma.category.create({ data: { name: 'Scones',   description: 'Light and fluffy scones' } }),
    prisma.category.create({ data: { name: 'Cakes',    description: 'Decadent home-style cakes' } }),
    prisma.category.create({ data: { name: 'Bread',    description: 'Artisan breads baked fresh daily' } }),
  ])

  // ─── Sellable Products ───────────────────────────────────────────────────────
  await prisma.product.create({
    data: {
      name: 'Choc Chip Biscuits', categoryId: catBiscuits.id,
      description: 'Classic chocolate chip biscuits — soft in the middle, golden on the outside. Made with real butter and premium Belgian chocolate chips.',
      variants: { create: [
        { name: '12 Pack', prices: { create: [{ tier: 'RETAIL', price: 55 }, { tier: 'AMBASSADOR', price: 48 }, { tier: 'WHOLESALE', price: 40 }] } },
        { name: '24 Pack', prices: { create: [{ tier: 'RETAIL', price: 99 }, { tier: 'AMBASSADOR', price: 88 }, { tier: 'WHOLESALE', price: 72 }] } },
      ]},
    },
  })
  await prisma.product.create({
    data: {
      name: 'Classic Vanilla Scones', categoryId: catScones.id,
      description: 'Light, fluffy scones made with fresh cream and a hint of vanilla. Perfect with jam and cream.',
      variants: { create: [
        { name: '6 Pack',  prices: { create: [{ tier: 'RETAIL', price: 65 }, { tier: 'AMBASSADOR', price: 58 }, { tier: 'WHOLESALE', price: 50 }] } },
        { name: '12 Pack', prices: { create: [{ tier: 'RETAIL', price: 120 }, { tier: 'AMBASSADOR', price: 108 }, { tier: 'WHOLESALE', price: 90 }] } },
      ]},
    },
  })
  await prisma.product.create({
    data: {
      name: 'Chocolate Fudge Cake', categoryId: catCakes.id,
      description: 'Rich, moist chocolate fudge cake made from scratch. Smothered in a velvety chocolate ganache.',
      variants: { create: [
        { name: 'Whole Cake (8")', prices: { create: [{ tier: 'RETAIL', price: 280 }, { tier: 'AMBASSADOR', price: 252 }, { tier: 'WHOLESALE', price: 220 }] } },
        { name: 'Half Cake',       prices: { create: [{ tier: 'RETAIL', price: 150 }, { tier: 'AMBASSADOR', price: 135 }, { tier: 'WHOLESALE', price: 120 }] } },
      ]},
    },
  })
  await prisma.product.create({
    data: {
      name: 'Sourdough Loaf', categoryId: catBread.id,
      description: 'Slow-fermented sourdough with a crispy crust and chewy crumb. Baked fresh each morning.',
      variants: { create: [
        { name: 'Standard Loaf', prices: { create: [{ tier: 'RETAIL', price: 75 }, { tier: 'AMBASSADOR', price: 68 }, { tier: 'WHOLESALE', price: 55 }] } },
      ]},
    },
  })
  await prisma.product.create({
    data: {
      name: 'Lemon Poppy Seed Cake', categoryId: catCakes.id,
      description: 'Zesty lemon drizzle cake dotted with poppy seeds, topped with a lemon glaze.',
      variants: { create: [
        { name: 'Whole Cake (8")', prices: { create: [{ tier: 'RETAIL', price: 260 }, { tier: 'AMBASSADOR', price: 234 }, { tier: 'WHOLESALE', price: 200 }] } },
        { name: 'Half Cake',       prices: { create: [{ tier: 'RETAIL', price: 140 }, { tier: 'AMBASSADOR', price: 126 }, { tier: 'WHOLESALE', price: 110 }] } },
      ]},
    },
  })
  await prisma.product.create({
    data: {
      name: 'Rooibos Shortbread', categoryId: catBiscuits.id,
      description: 'Melt-in-your-mouth shortbread infused with South African rooibos tea. Proudly local.',
      variants: { create: [
        { name: '12 Pack', prices: { create: [{ tier: 'RETAIL', price: 60 }, { tier: 'AMBASSADOR', price: 52 }, { tier: 'WHOLESALE', price: 44 }] } },
        { name: '24 Pack', prices: { create: [{ tier: 'RETAIL', price: 110 }, { tier: 'AMBASSADOR', price: 96 }, { tier: 'WHOLESALE', price: 80 }] } },
      ]},
    },
  })
  console.log('✅  Sellable products: 6')

  // ─── Variant lookup map ───────────────────────────────────────────────────────
  const allVariants = await prisma.productVariant.findMany({ include: { product: true, prices: true } })
  const V: Record<string, Record<string, typeof allVariants[0]>> = {}
  for (const v of allVariants) {
    if (!V[v.product.name]) V[v.product.name] = {}
    V[v.product.name][v.name] = v
  }
  const price = (pName: string, vName: string, tier: string) =>
    Number((V[pName][vName] as any).prices.find((p: any) => p.tier === tier)?.price ?? 0)

  // ─── Suppliers ────────────────────────────────────────────────────────────────
  const [flourMills, capedairy, bakeryPack, chocWorld] = await Promise.all([
    db.supplier.create({ data: { name: 'SA Flour Mills',       contactName: 'Johan Pretorius', phone: '0113456789', email: 'orders@saflour.co.za',   address: '12 Industrial Rd, Germiston', city: 'Johannesburg', notes: 'Main flour and sugar supplier. Min order R500. Delivers Tue & Fri.', status: 'ACTIVE' } }),
    db.supplier.create({ data: { name: 'Cape Dairy Co',        contactName: 'Anele Botha',     phone: '0219876543', email: 'supply@capedairy.co.za',  address: '45 Dairy Rd, Bellville',     city: 'Cape Town',    notes: 'Fresh dairy. Weekly delivery. Keep refrigerated.',              status: 'ACTIVE' } }),
    db.supplier.create({ data: { name: 'Bakery Packaging SA',  contactName: 'Ravi Nair',       phone: '0317654321', email: 'sales@bakpacksa.co.za',   address: '8 Commerce St, Pinetown',    city: 'Durban',       notes: 'All packaging. Lead time 3-5 biz days. Min 100 units.',         status: 'ACTIVE' } }),
    db.supplier.create({ data: { name: 'Choc World Imports',   contactName: 'Maria Santos',    phone: '0114445566', email: 'orders@chocworld.co.za',  address: '22 Trade Ave, Midrand',      city: 'Johannesburg', notes: 'Premium Belgian and local chocolate. Couverture, chips, cocoa.', status: 'ACTIVE' } }),
  ])

  // ─── Ingredient & Packaging Products ─────────────────────────────────────────
  const [
    prodFlourAP, prodFlourCake, prodCasterSugar, prodBrownSugar, prodButter, prodEggs,
    prodFreshCream, prodMilk, prodBakingPowder, prodBicarb, prodVanillaEssence, prodSalt,
    prodChocChips, prodCocoPowder, prodChocBlock, prodRooibos,
    prodBox12, prodBox24, prodBox6, prodCakeTin, prodCelloBags, prodLabels, prodTwine,
  ] = await Promise.all([
    db.product.create({ data: { name: 'All-Purpose Flour',       classification: 'INGREDIENT', supplierId: flourMills.id } }),
    db.product.create({ data: { name: 'Cake Flour',              classification: 'INGREDIENT', supplierId: flourMills.id } }),
    db.product.create({ data: { name: 'Caster Sugar',            classification: 'INGREDIENT', supplierId: flourMills.id } }),
    db.product.create({ data: { name: 'Brown Sugar',             classification: 'INGREDIENT', supplierId: flourMills.id } }),
    db.product.create({ data: { name: 'Unsalted Butter',         classification: 'INGREDIENT', supplierId: capedairy.id  } }),
    db.product.create({ data: { name: 'Large Eggs',              classification: 'INGREDIENT', supplierId: capedairy.id  } }),
    db.product.create({ data: { name: 'Fresh Cream',             classification: 'INGREDIENT', supplierId: capedairy.id  } }),
    db.product.create({ data: { name: 'Full Cream Milk',         classification: 'INGREDIENT', supplierId: capedairy.id  } }),
    db.product.create({ data: { name: 'Baking Powder',           classification: 'INGREDIENT' } }),
    db.product.create({ data: { name: 'Bicarbonate of Soda',     classification: 'INGREDIENT' } }),
    db.product.create({ data: { name: 'Vanilla Essence',         classification: 'INGREDIENT' } }),
    db.product.create({ data: { name: 'Fine Salt',               classification: 'INGREDIENT' } }),
    db.product.create({ data: { name: 'Chocolate Chips (dark)',  classification: 'INGREDIENT', supplierId: chocWorld.id  } }),
    db.product.create({ data: { name: 'Cocoa Powder (Dutch)',    classification: 'INGREDIENT', supplierId: chocWorld.id  } }),
    db.product.create({ data: { name: 'Dark Chocolate (block)',  classification: 'INGREDIENT', supplierId: chocWorld.id  } }),
    db.product.create({ data: { name: 'Loose Leaf Rooibos',      classification: 'INGREDIENT' } }),
    db.product.create({ data: { name: 'Biscuit Box (12-pack)',   classification: 'PACKAGING',  supplierId: bakeryPack.id } }),
    db.product.create({ data: { name: 'Biscuit Box (24-pack)',   classification: 'PACKAGING',  supplierId: bakeryPack.id } }),
    db.product.create({ data: { name: 'Scone Box (6-pack)',      classification: 'PACKAGING',  supplierId: bakeryPack.id } }),
    db.product.create({ data: { name: 'Cake Tin Liner',          classification: 'CONSUMABLE', supplierId: bakeryPack.id } }),
    db.product.create({ data: { name: 'Cellophane Bags',         classification: 'PACKAGING',  supplierId: bakeryPack.id } }),
    db.product.create({ data: { name: 'Tlaka Treats Labels',     classification: 'PACKAGING',  supplierId: bakeryPack.id } }),
    db.product.create({ data: { name: 'Raffia Twine',            classification: 'PACKAGING',  supplierId: bakeryPack.id } }),
  ])

  // ─── Stock Items ──────────────────────────────────────────────────────────────
  const [
    flourAP, flourCake, casterSugar, brownSugar, butter, eggs,
    freshCream, milk, bakingPowder, bicarb, vanillaEssence, salt,
    chocChips, cocoPowder, chocGanache, rooibos,
    box12, box24, box6, cakeLiner, celloBags, labels, twine,
  ] = await Promise.all([
    db.stockItem.create({ data: { productId: prodFlourAP.id,         name: 'All-Purpose Flour',       sku: 'ING-FLOUR-AP', unit: 'kg',    currentStock: 25.000, minStockLevel: 10.000, costPerUnit: 14.50, notes: 'Store cool & dry. Check for weevils.' } }),
    db.stockItem.create({ data: { productId: prodFlourCake.id,       name: 'Cake Flour',              sku: 'ING-FLOUR-CK', unit: 'kg',    currentStock: 18.500, minStockLevel:  8.000, costPerUnit: 16.00 } }),
    db.stockItem.create({ data: { productId: prodCasterSugar.id,     name: 'Caster Sugar',            sku: 'ING-SUGAR-CS', unit: 'kg',    currentStock: 12.000, minStockLevel:  5.000, costPerUnit: 18.00 } }),
    db.stockItem.create({ data: { productId: prodBrownSugar.id,      name: 'Brown Sugar',             sku: 'ING-SUGAR-BR', unit: 'kg',    currentStock:  4.500, minStockLevel:  5.000, costPerUnit: 17.00, notes: 'BELOW MIN — reorder required' } }),
    db.stockItem.create({ data: { productId: prodButter.id,          name: 'Unsalted Butter',         sku: 'ING-BUTT-UN',  unit: 'kg',    currentStock:  8.200, minStockLevel:  4.000, costPerUnit: 95.00, notes: 'Keep refrigerated. Check expiry weekly.' } }),
    db.stockItem.create({ data: { productId: prodEggs.id,            name: 'Large Eggs',              sku: 'ING-EGGS-LG',  unit: 'units', currentStock: 120,    minStockLevel:  48,    costPerUnit:  5.50, notes: 'Free range. Expiry 3 weeks from delivery.' } }),
    db.stockItem.create({ data: { productId: prodFreshCream.id,      name: 'Fresh Cream',             sku: 'ING-CREM-FR',  unit: 'ml',    currentStock: 3500,   minStockLevel: 2000,   costPerUnit:  0.048, notes: 'Fridge. 5-day shelf life once opened.' } }),
    db.stockItem.create({ data: { productId: prodMilk.id,            name: 'Full Cream Milk',         sku: 'ING-MILK-FC',  unit: 'ml',    currentStock: 5000,   minStockLevel: 2000,   costPerUnit:  0.018 } }),
    db.stockItem.create({ data: { productId: prodBakingPowder.id,    name: 'Baking Powder',           sku: 'ING-BAKPOW',   unit: 'g',     currentStock:  800,   minStockLevel:  300,   costPerUnit:  0.085, notes: 'Rumford brand. Check moisture seal.' } }),
    db.stockItem.create({ data: { productId: prodBicarb.id,          name: 'Bicarbonate of Soda',     sku: 'ING-BICARB',   unit: 'g',     currentStock:  600,   minStockLevel:  200,   costPerUnit:  0.065 } }),
    db.stockItem.create({ data: { productId: prodVanillaEssence.id,  name: 'Vanilla Essence',         sku: 'ING-VAN-ES',   unit: 'ml',    currentStock:  350,   minStockLevel:  100,   costPerUnit:  0.52,  notes: 'Pure extract, not synthetic.' } }),
    db.stockItem.create({ data: { productId: prodSalt.id,            name: 'Fine Salt',               sku: 'ING-SALT-FN',  unit: 'g',     currentStock: 2000,   minStockLevel:  500,   costPerUnit:  0.009 } }),
    db.stockItem.create({ data: { productId: prodChocChips.id,       name: 'Chocolate Chips (dark)',  sku: 'ING-CHOC-DK',  unit: 'g',     currentStock: 3200,   minStockLevel: 1000,   costPerUnit:  0.12,  notes: '53% Callebaut. Keep below 18°C.' } }),
    db.stockItem.create({ data: { productId: prodCocoPowder.id,      name: 'Cocoa Powder (Dutch)',    sku: 'ING-COCO-PW',  unit: 'g',     currentStock:    0,   minStockLevel:  500,   costPerUnit:  0.095, notes: 'OUT OF STOCK — urgent reorder' } }),
    db.stockItem.create({ data: { productId: prodChocBlock.id,       name: 'Dark Chocolate (block)',  sku: 'ING-CHOC-BK',  unit: 'g',     currentStock: 1500,   minStockLevel:  500,   costPerUnit:  0.14,  notes: '70% cocoa for ganache.' } }),
    db.stockItem.create({ data: { productId: prodRooibos.id,         name: 'Loose Leaf Rooibos',      sku: 'ING-ROOI-LL',  unit: 'g',     currentStock:  400,   minStockLevel:  150,   costPerUnit:  0.18 } }),
    db.stockItem.create({ data: { productId: prodBox12.id,           name: 'Biscuit Box (12-pack)',   sku: 'PKG-BOX-12',   unit: 'units', currentStock:   85,   minStockLevel:   30,   costPerUnit:  5.50 } }),
    db.stockItem.create({ data: { productId: prodBox24.id,           name: 'Biscuit Box (24-pack)',   sku: 'PKG-BOX-24',   unit: 'units', currentStock:   40,   minStockLevel:   20,   costPerUnit:  7.50 } }),
    db.stockItem.create({ data: { productId: prodBox6.id,            name: 'Scone Box (6-pack)',      sku: 'PKG-BOX-06',   unit: 'units', currentStock:   60,   minStockLevel:   24,   costPerUnit:  4.80 } }),
    db.stockItem.create({ data: { productId: prodCakeTin.id,         name: 'Cake Tin Liner',          sku: 'PKG-CAKE-LN',  unit: 'units', currentStock:   50,   minStockLevel:   20,   costPerUnit:  1.20 } }),
    db.stockItem.create({ data: { productId: prodCelloBags.id,       name: 'Cellophane Bags',         sku: 'PKG-CELLO',    unit: 'units', currentStock:  200,   minStockLevel:  100,   costPerUnit:  0.90 } }),
    db.stockItem.create({ data: { productId: prodLabels.id,          name: 'Tlaka Treats Labels',     sku: 'PKG-LABEL',    unit: 'units', currentStock:  500,   minStockLevel:  150,   costPerUnit:  0.45,  notes: 'Custom printed. 2-week lead time.' } }),
    db.stockItem.create({ data: { productId: prodTwine.id,           name: 'Raffia Twine',            sku: 'PKG-TWINE',    unit: 'm',     currentStock:   80,   minStockLevel:   20,   costPerUnit:  0.35 } }),
  ])
  console.log('✅  Stock items: 23')

  // ─── Stock Movements ──────────────────────────────────────────────────────────
  await Promise.all([
    // Initial stock purchases (90 days ago)
    db.stockMovement.create({ data: { stockItemId: flourAP.id,        type: 'PURCHASE',       quantity: 30,    unitCost: 14.50, reference: 'PO-2025-001', note: 'Opening stock',                          createdAt: daysAgo(90) } }),
    db.stockMovement.create({ data: { stockItemId: flourCake.id,      type: 'PURCHASE',       quantity: 25,    unitCost: 16.00, reference: 'PO-2025-001',                                                 createdAt: daysAgo(90) } }),
    db.stockMovement.create({ data: { stockItemId: casterSugar.id,    type: 'PURCHASE',       quantity: 20,    unitCost: 18.00, reference: 'PO-2025-001',                                                 createdAt: daysAgo(90) } }),
    db.stockMovement.create({ data: { stockItemId: brownSugar.id,     type: 'PURCHASE',       quantity: 15,    unitCost: 17.00, reference: 'PO-2025-001',                                                 createdAt: daysAgo(90) } }),
    db.stockMovement.create({ data: { stockItemId: butter.id,         type: 'PURCHASE',       quantity: 15,    unitCost: 95.00, reference: 'PO-2025-002', note: 'Dairy delivery',                        createdAt: daysAgo(60) } }),
    db.stockMovement.create({ data: { stockItemId: eggs.id,           type: 'PURCHASE',       quantity: 240,   unitCost:  5.50, reference: 'PO-2025-002',                                                 createdAt: daysAgo(60) } }),
    db.stockMovement.create({ data: { stockItemId: freshCream.id,     type: 'PURCHASE',       quantity: 6000,  unitCost:  0.048,reference: 'PO-2025-002',                                                 createdAt: daysAgo(60) } }),
    db.stockMovement.create({ data: { stockItemId: milk.id,           type: 'PURCHASE',       quantity: 8000,  unitCost:  0.018,reference: 'PO-2025-002',                                                 createdAt: daysAgo(60) } }),
    db.stockMovement.create({ data: { stockItemId: chocChips.id,      type: 'PURCHASE',       quantity: 5000,  unitCost:  0.12, reference: 'PO-2025-003', note: 'Choc World order',                     createdAt: daysAgo(45) } }),
    db.stockMovement.create({ data: { stockItemId: cocoPowder.id,     type: 'PURCHASE',       quantity: 3000,  unitCost:  0.095,reference: 'PO-2025-003',                                                 createdAt: daysAgo(45) } }),
    db.stockMovement.create({ data: { stockItemId: chocGanache.id,    type: 'PURCHASE',       quantity: 3000,  unitCost:  0.14, reference: 'PO-2025-003',                                                 createdAt: daysAgo(45) } }),
    db.stockMovement.create({ data: { stockItemId: box12.id,          type: 'PURCHASE',       quantity: 150,   unitCost:  5.50, reference: 'PO-2025-004', note: 'Packaging order',                       createdAt: daysAgo(45) } }),
    db.stockMovement.create({ data: { stockItemId: box24.id,          type: 'PURCHASE',       quantity: 80,    unitCost:  7.50, reference: 'PO-2025-004',                                                 createdAt: daysAgo(45) } }),
    db.stockMovement.create({ data: { stockItemId: box6.id,           type: 'PURCHASE',       quantity: 120,   unitCost:  4.80, reference: 'PO-2025-004',                                                 createdAt: daysAgo(45) } }),
    db.stockMovement.create({ data: { stockItemId: labels.id,         type: 'PURCHASE',       quantity: 1000,  unitCost:  0.45, reference: 'PO-2025-004',                                                 createdAt: daysAgo(45) } }),
    // Production consumption
    db.stockMovement.create({ data: { stockItemId: flourAP.id,        type: 'PRODUCTION_USE', quantity: -5.0,  reference: 'PROD-001', note: 'Choc Chip Biscuits ×4 batches',        createdAt: daysAgo(30) } }),
    db.stockMovement.create({ data: { stockItemId: butter.id,         type: 'PRODUCTION_USE', quantity: -3.0,  reference: 'PROD-001',                                                createdAt: daysAgo(30) } }),
    db.stockMovement.create({ data: { stockItemId: chocChips.id,      type: 'PRODUCTION_USE', quantity: -1800, reference: 'PROD-001',                                                createdAt: daysAgo(30) } }),
    db.stockMovement.create({ data: { stockItemId: flourCake.id,      type: 'PRODUCTION_USE', quantity: -3.0,  reference: 'PROD-002', note: 'Vanilla Scones ×6 batches',            createdAt: daysAgo(20) } }),
    db.stockMovement.create({ data: { stockItemId: freshCream.id,     type: 'PRODUCTION_USE', quantity: -2500, reference: 'PROD-002',                                                createdAt: daysAgo(20) } }),
    db.stockMovement.create({ data: { stockItemId: cocoPowder.id,     type: 'PRODUCTION_USE', quantity: -3000, reference: 'PROD-003', note: 'Choc Fudge Cake ×5 cakes (now 0)',     createdAt: daysAgo(14) } }),
    db.stockMovement.create({ data: { stockItemId: chocGanache.id,    type: 'PRODUCTION_USE', quantity: -1500, reference: 'PROD-003',                                                createdAt: daysAgo(14) } }),
    // Waste & adjustments
    db.stockMovement.create({ data: { stockItemId: freshCream.id,     type: 'WASTE',          quantity: -500,  note: 'Expired — past use-by date',                                 createdAt: daysAgo(10) } }),
    db.stockMovement.create({ data: { stockItemId: eggs.id,           type: 'ADJUSTMENT_OUT', quantity: -12,   note: 'Stocktake variance — cracked/unusable',                      createdAt: daysAgo(7)  } }),
    db.stockMovement.create({ data: { stockItemId: brownSugar.id,     type: 'ADJUSTMENT_IN',  quantity: 1.0,   note: 'Found in storage — reconciliation',                          createdAt: daysAgo(3)  } }),
    // Packaging consumed
    db.stockMovement.create({ data: { stockItemId: box12.id,          type: 'PRODUCTION_USE', quantity: -65,   note: 'Packaged biscuit orders (3 months)',                         createdAt: daysAgo(15) } }),
    db.stockMovement.create({ data: { stockItemId: box24.id,          type: 'PRODUCTION_USE', quantity: -40,   note: 'Packaged biscuit orders (3 months)',                         createdAt: daysAgo(15) } }),
    db.stockMovement.create({ data: { stockItemId: box6.id,           type: 'PRODUCTION_USE', quantity: -60,   note: 'Packaged scone orders (3 months)',                           createdAt: daysAgo(15) } }),
    db.stockMovement.create({ data: { stockItemId: labels.id,         type: 'PRODUCTION_USE', quantity: -500,  note: 'Applied to all packs',                                       createdAt: daysAgo(15) } }),
  ])
  console.log('✅  Stock movements seeded')

  // ─── Purchase Orders ──────────────────────────────────────────────────────────
  await db.purchaseOrder.create({ data: {
    supplierId: flourMills.id, status: 'RECEIVED',
    orderDate: daysAgo(92), expectedDate: daysAgo(88),
    notes: 'Monthly flour and sugar restock',
    total: +(30*14.5 + 25*16 + 20*18 + 15*17).toFixed(2),
    items: { create: [
      { stockItemId: flourAP.id,    orderedQty: 30, receivedQty: 30, unitCost: 14.50, total: +(30*14.50).toFixed(2) },
      { stockItemId: flourCake.id,  orderedQty: 25, receivedQty: 25, unitCost: 16.00, total: +(25*16.00).toFixed(2) },
      { stockItemId: casterSugar.id,orderedQty: 20, receivedQty: 20, unitCost: 18.00, total: +(20*18.00).toFixed(2) },
      { stockItemId: brownSugar.id, orderedQty: 15, receivedQty: 15, unitCost: 17.00, total: +(15*17.00).toFixed(2) },
    ]},
  }})
  await db.purchaseOrder.create({ data: {
    supplierId: capedairy.id, status: 'RECEIVED',
    orderDate: daysAgo(62), expectedDate: daysAgo(60),
    notes: 'Bi-weekly dairy delivery',
    total: +(15*95 + 240*5.5 + 6000*0.048 + 8000*0.018).toFixed(2),
    items: { create: [
      { stockItemId: butter.id,     orderedQty: 15,   receivedQty: 15,   unitCost: 95.00,  total: +(15*95).toFixed(2)       },
      { stockItemId: eggs.id,       orderedQty: 240,  receivedQty: 240,  unitCost: 5.50,   total: +(240*5.5).toFixed(2)     },
      { stockItemId: freshCream.id, orderedQty: 6000, receivedQty: 6000, unitCost: 0.048,  total: +(6000*0.048).toFixed(2)  },
      { stockItemId: milk.id,       orderedQty: 8000, receivedQty: 8000, unitCost: 0.018,  total: +(8000*0.018).toFixed(2)  },
    ]},
  }})
  await db.purchaseOrder.create({ data: {
    supplierId: chocWorld.id, status: 'RECEIVED',
    orderDate: daysAgo(47), expectedDate: daysAgo(45),
    notes: 'Chocolate restock — chips, ganache, cocoa',
    total: +(5000*0.12 + 3000*0.095 + 3000*0.14).toFixed(2),
    items: { create: [
      { stockItemId: chocChips.id,  orderedQty: 5000, receivedQty: 5000, unitCost: 0.12,   total: +(5000*0.12).toFixed(2)   },
      { stockItemId: cocoPowder.id, orderedQty: 3000, receivedQty: 3000, unitCost: 0.095,  total: +(3000*0.095).toFixed(2)  },
      { stockItemId: chocGanache.id,orderedQty: 3000, receivedQty: 3000, unitCost: 0.14,   total: +(3000*0.14).toFixed(2)   },
    ]},
  }})
  await db.purchaseOrder.create({ data: {
    supplierId: chocWorld.id, status: 'ORDERED',
    orderDate: daysAgo(3), expectedDate: daysAgo(-4),
    notes: 'URGENT — cocoa out of stock, holding up cake production',
    total: +(3000*0.095 + 4000*0.12 + 2000*0.14).toFixed(2),
    items: { create: [
      { stockItemId: cocoPowder.id, orderedQty: 3000, receivedQty: 0, unitCost: 0.095, total: +(3000*0.095).toFixed(2) },
      { stockItemId: chocChips.id,  orderedQty: 4000, receivedQty: 0, unitCost: 0.12,  total: +(4000*0.12).toFixed(2)  },
      { stockItemId: chocGanache.id,orderedQty: 2000, receivedQty: 0, unitCost: 0.14,  total: +(2000*0.14).toFixed(2)  },
    ]},
  }})
  await db.purchaseOrder.create({ data: {
    supplierId: bakeryPack.id, status: 'DRAFT',
    orderDate: daysAgo(1),
    notes: 'Monthly packaging order — confirm stock before finalising',
    total: +(100*5.5 + 60*7.5 + 80*4.8 + 500*0.45 + 300*0.9 + 50*0.35).toFixed(2),
    items: { create: [
      { stockItemId: box12.id,    orderedQty: 100, receivedQty: 0, unitCost: 5.50, total: +(100*5.50).toFixed(2) },
      { stockItemId: box24.id,    orderedQty: 60,  receivedQty: 0, unitCost: 7.50, total: +(60*7.50).toFixed(2)  },
      { stockItemId: box6.id,     orderedQty: 80,  receivedQty: 0, unitCost: 4.80, total: +(80*4.80).toFixed(2)  },
      { stockItemId: labels.id,   orderedQty: 500, receivedQty: 0, unitCost: 0.45, total: +(500*0.45).toFixed(2) },
      { stockItemId: celloBags.id,orderedQty: 300, receivedQty: 0, unitCost: 0.90, total: +(300*0.90).toFixed(2) },
      { stockItemId: twine.id,    orderedQty: 50,  receivedQty: 0, unitCost: 0.35, total: +(50*0.35).toFixed(2)  },
    ]},
  }})
  console.log('✅  Purchase orders: 5')

  // ─── Recipes ──────────────────────────────────────────────────────────────────
  const [recipeChocBiscuits, recipeScones, recipeChocCake, recipeRooibos, recipeLemon] = await Promise.all([
    db.recipe.create({ data: {
      name: 'Choc Chip Biscuits (Classic)', yieldQty: 24, yieldUnit: 'biscuits',
      notes: 'Makes 24 biscuits. Bake 180°C for 12-14 min. Cool on wire rack.',
      isActive: true,
      ingredients: { create: [
        { stockItemId: flourAP.id,        quantity: 0.250, unit: 'kg'    },
        { stockItemId: butter.id,         quantity: 0.150, unit: 'kg'    },
        { stockItemId: casterSugar.id,    quantity: 0.100, unit: 'kg'    },
        { stockItemId: brownSugar.id,     quantity: 0.080, unit: 'kg'    },
        { stockItemId: chocChips.id,      quantity: 200,   unit: 'g'     },
        { stockItemId: eggs.id,           quantity: 2,     unit: 'units' },
        { stockItemId: vanillaEssence.id, quantity: 5,     unit: 'ml'    },
        { stockItemId: bakingPowder.id,   quantity: 5,     unit: 'g'     },
        { stockItemId: salt.id,           quantity: 3,     unit: 'g'     },
      ]},
    }}),
    db.recipe.create({ data: {
      name: 'Classic Cream Scones', yieldQty: 8, yieldUnit: 'scones',
      notes: "Don't overwork dough. Bake 220°C for 12-15 min until golden.",
      isActive: true,
      ingredients: { create: [
        { stockItemId: flourCake.id,      quantity: 0.500, unit: 'kg'    },
        { stockItemId: bakingPowder.id,   quantity: 20,    unit: 'g'     },
        { stockItemId: butter.id,         quantity: 0.080, unit: 'kg'    },
        { stockItemId: casterSugar.id,    quantity: 0.050, unit: 'kg'    },
        { stockItemId: freshCream.id,     quantity: 200,   unit: 'ml'    },
        { stockItemId: eggs.id,           quantity: 1,     unit: 'units' },
        { stockItemId: salt.id,           quantity: 3,     unit: 'g'     },
      ]},
    }}),
    db.recipe.create({ data: {
      name: 'Chocolate Fudge Cake', yieldQty: 1, yieldUnit: 'cake (8 inch)',
      notes: 'Bake 180°C for 30-35 min. Test with skewer. Ganache when fully cooled.',
      isActive: true,
      ingredients: { create: [
        { stockItemId: flourCake.id,      quantity: 0.300, unit: 'kg'    },
        { stockItemId: cocoPowder.id,     quantity: 60,    unit: 'g'     },
        { stockItemId: casterSugar.id,    quantity: 0.300, unit: 'kg'    },
        { stockItemId: butter.id,         quantity: 0.200, unit: 'kg'    },
        { stockItemId: eggs.id,           quantity: 4,     unit: 'units' },
        { stockItemId: milk.id,           quantity: 240,   unit: 'ml'    },
        { stockItemId: vanillaEssence.id, quantity: 10,    unit: 'ml'    },
        { stockItemId: bakingPowder.id,   quantity: 10,    unit: 'g'     },
        { stockItemId: bicarb.id,         quantity: 5,     unit: 'g'     },
        { stockItemId: salt.id,           quantity: 3,     unit: 'g'     },
        { stockItemId: chocGanache.id,    quantity: 250,   unit: 'g', notes: 'Ganache topping' },
      ]},
    }}),
    db.recipe.create({ data: {
      name: 'Rooibos Shortbread', yieldQty: 20, yieldUnit: 'shortbread pieces',
      notes: 'Melt-in-mouth. Bake 160°C for 18-20 min. Should be pale, not browned.',
      isActive: true,
      ingredients: { create: [
        { stockItemId: flourAP.id,    quantity: 0.300, unit: 'kg' },
        { stockItemId: butter.id,     quantity: 0.200, unit: 'kg' },
        { stockItemId: brownSugar.id, quantity: 0.100, unit: 'kg' },
        { stockItemId: rooibos.id,    quantity: 8,     unit: 'g'  },
        { stockItemId: salt.id,       quantity: 2,     unit: 'g'  },
      ]},
    }}),
    db.recipe.create({ data: {
      name: 'Lemon Poppy Seed Cake', yieldQty: 1, yieldUnit: 'cake (8 inch)',
      notes: 'Bake 175°C for 40 min. Add lemon glaze while still warm.',
      isActive: true,
      ingredients: { create: [
        { stockItemId: flourCake.id,      quantity: 0.280, unit: 'kg'    },
        { stockItemId: casterSugar.id,    quantity: 0.250, unit: 'kg'    },
        { stockItemId: butter.id,         quantity: 0.180, unit: 'kg'    },
        { stockItemId: eggs.id,           quantity: 3,     unit: 'units' },
        { stockItemId: milk.id,           quantity: 180,   unit: 'ml'    },
        { stockItemId: bakingPowder.id,   quantity: 8,     unit: 'g'     },
        { stockItemId: salt.id,           quantity: 2,     unit: 'g'     },
      ]},
    }}),
  ])

  await Promise.all([
    db.productionRun.create({ data: { recipeId: recipeChocBiscuits.id, batches: 8, status: 'COMPLETED', plannedDate: daysAgo(25), startedAt: daysAgo(25), completedAt: daysAgo(25), notes: 'Morning bake — 192 biscuits. Quality excellent.' } }),
    db.productionRun.create({ data: { recipeId: recipeScones.id,       batches: 6, status: 'COMPLETED', plannedDate: daysAgo(18), startedAt: daysAgo(18), completedAt: daysAgo(18), notes: '48 scones. Sold by noon.' } }),
    db.productionRun.create({ data: { recipeId: recipeChocCake.id,     batches: 5, status: 'COMPLETED', plannedDate: daysAgo(14), startedAt: daysAgo(14), completedAt: daysAgo(14), notes: '5 cakes for weekend orders.' } }),
    db.productionRun.create({ data: { recipeId: recipeRooibos.id,      batches: 4, status: 'COMPLETED', plannedDate: daysAgo(10), startedAt: daysAgo(10), completedAt: daysAgo(10), notes: 'Trial run — sold out at market.' } }),
    db.productionRun.create({ data: { recipeId: recipeChocBiscuits.id, batches: 10, status: 'IN_PROGRESS', plannedDate: daysAgo(0), startedAt: daysAgo(0), notes: 'Large weekend batch — ambassador pre-orders.' } }),
    db.productionRun.create({ data: { recipeId: recipeScones.id,       batches: 5, status: 'PLANNED',     plannedDate: daysAgo(-1), notes: 'Saturday morning scones.' } }),
    db.productionRun.create({ data: { recipeId: recipeChocCake.id,     batches: 4, status: 'PLANNED',     plannedDate: daysAgo(-3), notes: 'Pre-orders for birthday cakes. NOTE: cocoa restock must arrive first.' } }),
    db.productionRun.create({ data: { recipeId: recipeLemon.id,        batches: 3, status: 'PLANNED',     plannedDate: daysAgo(-5), notes: 'New product launch batch.' } }),
  ])
  console.log('✅  Recipes + production runs seeded')

  // ─── Finance: Chart of Accounts ───────────────────────────────────────────────
  const accounts = await Promise.all([
    db.financeAccount.create({ data: { code: '1001', name: 'Cash on Hand',        type: 'ASSET',     description: 'Physical cash in the business',            isSystem: true, sortOrder: 10 } }),
    db.financeAccount.create({ data: { code: '1010', name: 'Bank Account',         type: 'ASSET',     description: 'Business bank account balance',            isSystem: true, sortOrder: 11 } }),
    db.financeAccount.create({ data: { code: '1100', name: 'Accounts Receivable',  type: 'ASSET',     description: 'Money owed to the business by customers',  isSystem: true, sortOrder: 20 } }),
    db.financeAccount.create({ data: { code: '2001', name: 'Accounts Payable',     type: 'LIABILITY', description: 'Money owed to suppliers',                  isSystem: true, sortOrder: 10 } }),
    db.financeAccount.create({ data: { code: '2100', name: 'VAT Payable',          type: 'LIABILITY', description: 'VAT collected but not yet paid to SARS',   isSystem: true, sortOrder: 20 } }),
    db.financeAccount.create({ data: { code: '2200', name: 'Owner Loan',           type: 'LIABILITY', description: 'Funds loaned into the business by owner',  isSystem: true, sortOrder: 30 } }),
    db.financeAccount.create({ data: { code: '3001', name: "Owner's Equity",       type: 'EQUITY',    description: "Owner's investment in the business",       isSystem: true, sortOrder: 10 } }),
    db.financeAccount.create({ data: { code: '3100', name: 'Retained Earnings',    type: 'EQUITY',    description: 'Accumulated profits left in the business', isSystem: true, sortOrder: 20 } }),
    db.financeAccount.create({ data: { code: '4001', name: 'Product Sales',        type: 'INCOME',    description: 'Revenue from selling baked goods',         isSystem: true, sortOrder: 10 } }),
    db.financeAccount.create({ data: { code: '4002', name: 'Delivery Income',      type: 'INCOME',    description: 'Income earned from delivery fees',         isSystem: true, sortOrder: 20 } }),
    db.financeAccount.create({ data: { code: '4099', name: 'Other Income',         type: 'INCOME',    description: 'Any other miscellaneous income',           isSystem: true, sortOrder: 99 } }),
    db.financeAccount.create({ data: { code: '5001', name: 'Ingredients',          type: 'EXPENSE',   description: 'Raw ingredients used in production',       isSystem: true, sortOrder: 10 } }),
    db.financeAccount.create({ data: { code: '5002', name: 'Packaging',            type: 'EXPENSE',   description: 'Boxes, bags, ribbons, and other packaging',isSystem: true, sortOrder: 20 } }),
    db.financeAccount.create({ data: { code: '5003', name: 'Transport & Delivery', type: 'EXPENSE',   description: 'Fuel, courier, and delivery costs',        isSystem: true, sortOrder: 30 } }),
    db.financeAccount.create({ data: { code: '5004', name: 'Staff Wages',          type: 'EXPENSE',   description: 'Salaries and wages paid to staff',         isSystem: true, sortOrder: 40 } }),
    db.financeAccount.create({ data: { code: '5005', name: 'Rent & Premises',      type: 'EXPENSE',   description: 'Rent, rates, and premises costs',          isSystem: true, sortOrder: 50 } }),
    db.financeAccount.create({ data: { code: '5006', name: 'Marketing',            type: 'EXPENSE',   description: 'Advertising, social media, promotions',    isSystem: true, sortOrder: 60 } }),
    db.financeAccount.create({ data: { code: '5007', name: 'Utilities',            type: 'EXPENSE',   description: 'Electricity, water, internet, phone',      isSystem: true, sortOrder: 70 } }),
    db.financeAccount.create({ data: { code: '5008', name: 'Equipment & Supplies', type: 'EXPENSE',   description: 'Kitchen equipment, tools, small items',    isSystem: true, sortOrder: 80 } }),
    db.financeAccount.create({ data: { code: '5009', name: 'Bank Charges',         type: 'EXPENSE',   description: 'Bank fees and transaction charges',        isSystem: true, sortOrder: 85 } }),
    db.financeAccount.create({ data: { code: '5099', name: 'Other Expenses',       type: 'EXPENSE',   description: 'Miscellaneous expenses',                   isSystem: true, sortOrder: 99 } }),
  ])

  // Build a quick lookup: CoA[code] = account
  const CoA: Record<string, typeof accounts[0]> = {}
  for (const a of accounts) CoA[a.code] = a
  console.log('✅  Chart of Accounts: 21 accounts')

  // ─── Orders + Commissions ─────────────────────────────────────────────────────
  // Helper to build one order and its commission in one go
  type OrderSpec = {
    customer: typeof nomsa
    ambassador: typeof zane | null
    address:   typeof addrNomsa | null
    items:     Array<{ pName: string; vName: string; tier: string; qty: number }>
    delivery:  number
    status:    string
    notes?:    string
    createdAt: Date
    payRef?:   string
  }

  const ordersCreated: any[] = []

  async function makeOrder(spec: OrderSpec) {
    const itemData = spec.items.map(i => ({
      variantId: V[i.pName][i.vName].id,
      quantity:  i.qty,
      unitPrice: price(i.pName, i.vName, i.tier),
      subtotal:  +(price(i.pName, i.vName, i.tier) * i.qty).toFixed(2),
    }))
    const { subtotal, deliveryFee, total } = orderTotals(
      itemData.map(i => ({ unitPrice: i.unitPrice, quantity: i.quantity })),
      spec.delivery,
    )

    const order = await prisma.order.create({
      data: {
        customerId:   spec.customer.id,
        ambassadorId: spec.ambassador?.id ?? null,
        addressId:    spec.address?.id   ?? null,
        status:       spec.status as any,
        subtotal, deliveryFee, total,
        notes:      spec.notes ?? null,
        paymentRef: spec.payRef ?? null,
        paidAt:     spec.status === 'DELIVERED' ? spec.createdAt : null,
        createdAt:  spec.createdAt,
        updatedAt:  spec.createdAt,
        items: { create: itemData },
        statusLogs: { create: { status: spec.status as any, createdAt: spec.createdAt } },
      },
    })

    // Commission for ambassador orders that are DELIVERED
    if (spec.ambassador && spec.status === 'DELIVERED') {
      const rate = Number(spec.ambassador.commissionRate)
      await db.commission.create({
        data: {
          orderId:      order.id,
          ambassadorId: spec.ambassador.id,
          amount:       +(total * rate).toFixed(2),
          rate,
          status:       'PENDING',
          createdAt:    spec.createdAt,
          updatedAt:    spec.createdAt,
        },
      })
    }

    ordersCreated.push(order)
    return order
  }

  // ── Month 3 ago (daysAgo 90–76) ──────────────────────────────────────────────
  const o1  = await makeOrder({ customer: nomsa, ambassador: zane,    address: addrNomsa, delivery: 25, status: 'DELIVERED', createdAt: daysAgo(88), payRef: 'PAY-8802', items: [{ pName: 'Choc Chip Biscuits', vName: '12 Pack', tier: 'AMBASSADOR', qty: 2 }, { pName: 'Classic Vanilla Scones', vName: '6 Pack', tier: 'AMBASSADOR', qty: 1 }] })
  const o2  = await makeOrder({ customer: thabo, ambassador: null,    address: addrThabo, delivery: 25, status: 'DELIVERED', createdAt: daysAgo(85), payRef: 'PAY-8803', items: [{ pName: 'Chocolate Fudge Cake', vName: 'Whole Cake (8")', tier: 'RETAIL', qty: 1 }] })
  const o3  = await makeOrder({ customer: priya, ambassador: zane,    address: addrPriya, delivery: 25, status: 'DELIVERED', createdAt: daysAgo(83), payRef: 'PAY-8804', items: [{ pName: 'Choc Chip Biscuits', vName: '24 Pack', tier: 'AMBASSADOR', qty: 2 }] })
  const o4  = await makeOrder({ customer: lisa,  ambassador: zane,    address: addrLisa,  delivery: 25, status: 'DELIVERED', createdAt: daysAgo(82), payRef: 'PAY-8805', items: [{ pName: 'Classic Vanilla Scones', vName: '12 Pack', tier: 'AMBASSADOR', qty: 1 }, { pName: 'Sourdough Loaf', vName: 'Standard Loaf', tier: 'AMBASSADOR', qty: 1 }] })
  const o5  = await makeOrder({ customer: nomsa, ambassador: null,    address: null,       delivery: 0,  status: 'DELIVERED', createdAt: daysAgo(80), payRef: 'PAY-8806', items: [{ pName: 'Chocolate Fudge Cake', vName: 'Half Cake', tier: 'RETAIL', qty: 1 }] })
  const o6  = await makeOrder({ customer: sipho, ambassador: michael, address: addrSipho, delivery: 25, status: 'DELIVERED', createdAt: daysAgo(79), payRef: 'PAY-8807', items: [{ pName: 'Classic Vanilla Scones', vName: '6 Pack', tier: 'AMBASSADOR', qty: 2 }] })
  const o7  = await makeOrder({ customer: aisha, ambassador: zane,    address: addrAisha, delivery: 25, status: 'DELIVERED', createdAt: daysAgo(78), payRef: 'PAY-8808', items: [{ pName: 'Choc Chip Biscuits', vName: '12 Pack', tier: 'AMBASSADOR', qty: 3 }] })
  const _o8 = await makeOrder({ customer: thabo, ambassador: null,    address: addrThabo, delivery: 0,  status: 'CANCELLED', createdAt: daysAgo(77), notes: 'Customer cancelled — changed their mind', items: [{ pName: 'Sourdough Loaf', vName: 'Standard Loaf', tier: 'RETAIL', qty: 2 }] })

  // ── Month 2 ago (daysAgo 60–46) ──────────────────────────────────────────────
  const o9  = await makeOrder({ customer: nomsa, ambassador: zane,    address: addrNomsa, delivery: 25, status: 'DELIVERED', createdAt: daysAgo(60), payRef: 'PAY-8820', items: [{ pName: 'Choc Chip Biscuits', vName: '24 Pack', tier: 'AMBASSADOR', qty: 1 }, { pName: 'Chocolate Fudge Cake', vName: 'Half Cake', tier: 'AMBASSADOR', qty: 1 }] })
  const o10 = await makeOrder({ customer: priya, ambassador: null,    address: null,       delivery: 0,  status: 'DELIVERED', createdAt: daysAgo(58), payRef: 'PAY-8821', items: [{ pName: 'Classic Vanilla Scones', vName: '12 Pack', tier: 'RETAIL', qty: 1 }] })
  const o11 = await makeOrder({ customer: lisa,  ambassador: sibu,    address: addrLisa,  delivery: 25, status: 'DELIVERED', createdAt: daysAgo(56), payRef: 'PAY-8822', items: [{ pName: 'Choc Chip Biscuits', vName: '12 Pack', tier: 'AMBASSADOR', qty: 4 }] })
  const o12 = await makeOrder({ customer: thabo, ambassador: zane,    address: addrThabo, delivery: 0,  status: 'DELIVERED', createdAt: daysAgo(54), payRef: 'PAY-8823', items: [{ pName: 'Chocolate Fudge Cake', vName: 'Whole Cake (8")', tier: 'AMBASSADOR', qty: 1 }] })
  const o13 = await makeOrder({ customer: sipho, ambassador: null,    address: addrSipho, delivery: 25, status: 'DELIVERED', createdAt: daysAgo(52), payRef: 'PAY-8824', items: [{ pName: 'Sourdough Loaf', vName: 'Standard Loaf', tier: 'RETAIL', qty: 3 }] })
  const o14 = await makeOrder({ customer: aisha, ambassador: michael, address: addrAisha, delivery: 25, status: 'DELIVERED', createdAt: daysAgo(51), payRef: 'PAY-8825', items: [{ pName: 'Classic Vanilla Scones', vName: '6 Pack', tier: 'AMBASSADOR', qty: 1 }, { pName: 'Choc Chip Biscuits', vName: '12 Pack', tier: 'AMBASSADOR', qty: 2 }] })
  const o15 = await makeOrder({ customer: nomsa, ambassador: sibu,    address: addrNomsa, delivery: 0,  status: 'DELIVERED', createdAt: daysAgo(50), payRef: 'PAY-8826', items: [{ pName: 'Chocolate Fudge Cake', vName: 'Half Cake', tier: 'AMBASSADOR', qty: 2 }] })
  const o16 = await makeOrder({ customer: lisa,  ambassador: null,    address: null,       delivery: 0,  status: 'DELIVERED', createdAt: daysAgo(49), payRef: 'PAY-8827', items: [{ pName: 'Choc Chip Biscuits', vName: '24 Pack', tier: 'RETAIL', qty: 1 }, { pName: 'Sourdough Loaf', vName: 'Standard Loaf', tier: 'RETAIL', qty: 1 }] })
  const o17 = await makeOrder({ customer: priya, ambassador: zane,    address: addrPriya, delivery: 25, status: 'DELIVERED', createdAt: daysAgo(48), payRef: 'PAY-8828', items: [{ pName: 'Choc Chip Biscuits', vName: '12 Pack', tier: 'AMBASSADOR', qty: 2 }, { pName: 'Choc Chip Biscuits', vName: '24 Pack', tier: 'AMBASSADOR', qty: 1 }] })
  const _o18 = await makeOrder({ customer: thabo, ambassador: null,   address: addrThabo, delivery: 25, status: 'CANCELLED', createdAt: daysAgo(47), notes: 'Customer could not be reached for payment', items: [{ pName: 'Chocolate Fudge Cake', vName: 'Whole Cake (8")', tier: 'RETAIL', qty: 1 }] })
  const o19 = await makeOrder({ customer: sipho, ambassador: michael, address: addrSipho, delivery: 25, status: 'DELIVERED', createdAt: daysAgo(47), payRef: 'PAY-8830', items: [{ pName: 'Choc Chip Biscuits', vName: '24 Pack', tier: 'AMBASSADOR', qty: 2 }] })
  const o20 = await makeOrder({ customer: aisha, ambassador: zane,    address: null,       delivery: 0,  status: 'DELIVERED', createdAt: daysAgo(46), payRef: 'PAY-8831', items: [{ pName: 'Classic Vanilla Scones', vName: '12 Pack', tier: 'AMBASSADOR', qty: 1 }] })

  // ── Month 1 ago (daysAgo 30–16) ───────────────────────────────────────────────
  const o21 = await makeOrder({ customer: nomsa, ambassador: zane,    address: addrNomsa, delivery: 25, status: 'DELIVERED', createdAt: daysAgo(30), payRef: 'PAY-8840', items: [{ pName: 'Choc Chip Biscuits', vName: '12 Pack', tier: 'AMBASSADOR', qty: 3 }, { pName: 'Sourdough Loaf', vName: 'Standard Loaf', tier: 'AMBASSADOR', qty: 1 }] })
  const o22 = await makeOrder({ customer: priya, ambassador: sibu,    address: addrPriya, delivery: 25, status: 'DELIVERED', createdAt: daysAgo(28), payRef: 'PAY-8841', items: [{ pName: 'Chocolate Fudge Cake', vName: 'Whole Cake (8")', tier: 'AMBASSADOR', qty: 1 }, { pName: 'Classic Vanilla Scones', vName: '6 Pack', tier: 'AMBASSADOR', qty: 1 }] })
  const o23 = await makeOrder({ customer: lisa,  ambassador: null,    address: null,       delivery: 0,  status: 'DELIVERED', createdAt: daysAgo(26), payRef: 'PAY-8842', items: [{ pName: 'Choc Chip Biscuits', vName: '24 Pack', tier: 'RETAIL', qty: 2 }] })
  const o24 = await makeOrder({ customer: thabo, ambassador: zane,    address: addrThabo, delivery: 25, status: 'DELIVERED', createdAt: daysAgo(25), payRef: 'PAY-8843', items: [{ pName: 'Classic Vanilla Scones', vName: '12 Pack', tier: 'AMBASSADOR', qty: 2 }] })
  const o25 = await makeOrder({ customer: sipho, ambassador: null,    address: null,       delivery: 0,  status: 'DELIVERED', createdAt: daysAgo(24), payRef: 'PAY-8844', items: [{ pName: 'Chocolate Fudge Cake', vName: 'Half Cake', tier: 'RETAIL', qty: 1 }] })
  const o26 = await makeOrder({ customer: aisha, ambassador: michael, address: addrAisha, delivery: 25, status: 'DELIVERED', createdAt: daysAgo(22), payRef: 'PAY-8845', items: [{ pName: 'Choc Chip Biscuits', vName: '12 Pack', tier: 'AMBASSADOR', qty: 4 }] })
  const o27 = await makeOrder({ customer: nomsa, ambassador: null,    address: null,       delivery: 0,  status: 'DELIVERED', createdAt: daysAgo(21), payRef: 'PAY-8846', items: [{ pName: 'Sourdough Loaf', vName: 'Standard Loaf', tier: 'RETAIL', qty: 2 }, { pName: 'Classic Vanilla Scones', vName: '6 Pack', tier: 'RETAIL', qty: 2 }] })
  const o28 = await makeOrder({ customer: priya, ambassador: zane,    address: addrPriya, delivery: 25, status: 'DELIVERED', createdAt: daysAgo(20), payRef: 'PAY-8847', items: [{ pName: 'Choc Chip Biscuits', vName: '12 Pack', tier: 'AMBASSADOR', qty: 2 }, { pName: 'Chocolate Fudge Cake', vName: 'Half Cake', tier: 'AMBASSADOR', qty: 1 }] })
  const o29 = await makeOrder({ customer: lisa,  ambassador: sibu,    address: addrLisa,  delivery: 25, status: 'DELIVERED', createdAt: daysAgo(19), payRef: 'PAY-8848', items: [{ pName: 'Choc Chip Biscuits', vName: '24 Pack', tier: 'AMBASSADOR', qty: 3 }] })
  const o30 = await makeOrder({ customer: thabo, ambassador: null,    address: addrThabo, delivery: 25, status: 'DELIVERED', createdAt: daysAgo(18), payRef: 'PAY-8849', items: [{ pName: 'Chocolate Fudge Cake', vName: 'Whole Cake (8")', tier: 'RETAIL', qty: 1 }] })
  const o31 = await makeOrder({ customer: sipho, ambassador: null,    address: addrSipho, delivery: 0,  status: 'DELIVERED', createdAt: daysAgo(17), payRef: 'PAY-8850', items: [{ pName: 'Rooibos Shortbread', vName: '12 Pack', tier: 'RETAIL', qty: 2 }] })
  const o32 = await makeOrder({ customer: aisha, ambassador: zane,    address: addrAisha, delivery: 25, status: 'DELIVERED', createdAt: daysAgo(16), payRef: 'PAY-8851', items: [{ pName: 'Lemon Poppy Seed Cake', vName: 'Whole Cake (8")', tier: 'AMBASSADOR', qty: 1 }] })

  // ── This week / live orders (daysAgo 7–0) ────────────────────────────────────
  const o33 = await makeOrder({ customer: sipho, ambassador: zane,    address: addrSipho, delivery: 25, status: 'DELIVERED', createdAt: daysAgo(7),  payRef: 'PAY-8860', items: [{ pName: 'Classic Vanilla Scones', vName: '6 Pack', tier: 'AMBASSADOR', qty: 2 }, { pName: 'Choc Chip Biscuits', vName: '12 Pack', tier: 'AMBASSADOR', qty: 2 }] })
  const o34 = await makeOrder({ customer: aisha, ambassador: null,    address: addrAisha, delivery: 0,  status: 'CONFIRMED',  createdAt: daysAgo(5),  notes: 'Birthday surprise — call before delivery', items: [{ pName: 'Chocolate Fudge Cake', vName: 'Whole Cake (8")', tier: 'RETAIL', qty: 1 }] })
  const o35 = await makeOrder({ customer: nomsa, ambassador: michael, address: addrNomsa, delivery: 25, status: 'BAKING',     createdAt: daysAgo(3),  notes: 'Regular Friday order', items: [{ pName: 'Choc Chip Biscuits', vName: '24 Pack', tier: 'AMBASSADOR', qty: 1 }, { pName: 'Sourdough Loaf', vName: 'Standard Loaf', tier: 'AMBASSADOR', qty: 1 }] })
  const o36 = await makeOrder({ customer: priya, ambassador: zane,    address: addrPriya, delivery: 25, status: 'OUT_FOR_DELIVERY', createdAt: daysAgo(2), items: [{ pName: 'Classic Vanilla Scones', vName: '12 Pack', tier: 'AMBASSADOR', qty: 1 }, { pName: 'Choc Chip Biscuits', vName: '12 Pack', tier: 'AMBASSADOR', qty: 1 }] })
  const o37 = await makeOrder({ customer: lisa,  ambassador: null,    address: null,       delivery: 0,  status: 'READY',      createdAt: daysAgo(1),  notes: 'Collection order — will pick up before 3pm', items: [{ pName: 'Sourdough Loaf', vName: 'Standard Loaf', tier: 'RETAIL', qty: 3 }] })
  const o38 = await makeOrder({ customer: thabo, ambassador: sibu,    address: addrThabo, delivery: 25, status: 'PENDING',    createdAt: hoursAgo(4), notes: 'New order — awaiting payment confirmation', items: [{ pName: 'Choc Chip Biscuits', vName: '12 Pack', tier: 'AMBASSADOR', qty: 5 }] })

  console.log(`✅  Orders: ${ordersCreated.length} created`)

  // ─── Payout: Mark Zanele's oldest 4 commissions as paid ───────────────────────
  const zaneCommissions = await db.commission.findMany({
    where: { ambassadorId: zane.id },
    orderBy: { createdAt: 'asc' },
    take: 4,
  })
  if (zaneCommissions.length > 0) {
    const payoutAmount = zaneCommissions.reduce((s: number, c: any) => s + Number(c.amount), 0)
    const payout = await db.payout.create({
      data: {
        ambassadorId: zane.id,
        amount:       +payoutAmount.toFixed(2),
        method:       'bank_transfer',
        reference:    'EFT-20250115-ZANELE',
        status:       'COMPLETED',
        notes:        'Q4 2024 commission payout — EFT to Zanele Khumalo FNB ***4421',
        createdAt:    daysAgo(70),
        updatedAt:    daysAgo(70),
      },
    })
    await db.commission.updateMany({
      where: { id: { in: zaneCommissions.map((c: any) => c.id) } },
      data: { status: 'PAID', payoutId: payout.id },
    })
    console.log(`✅  Payout created for Zanele: R${payoutAmount.toFixed(2)} (${zaneCommissions.length} commissions)`)
  }

  // Approve a few more of Zanele's commissions (ready for next payout)
  const zaneApprove = await db.commission.findMany({
    where: { ambassadorId: zane.id, status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    take: 3,
  })
  if (zaneApprove.length) {
    await db.commission.updateMany({
      where: { id: { in: zaneApprove.map((c: any) => c.id) } },
      data: { status: 'APPROVED' },
    })
  }
  console.log('✅  Commissions set up (PAID × 4, APPROVED × 3, PENDING for the rest)')

  // ─── Finance Transactions ─────────────────────────────────────────────────────
  // Income transactions for all DELIVERED orders
  const deliveredOrders = [o1,o2,o3,o4,o5,o6,o7,o9,o10,o11,o12,o13,o14,o15,o16,o17,o19,o20,o21,o22,o23,o24,o25,o26,o27,o28,o29,o30,o31,o32,o33]
  for (const order of deliveredOrders) {
    await db.financeTransaction.create({
      data: {
        date:        order.paidAt || order.createdAt,
        amount:      order.total,
        type:        'INCOME',
        category:    'Product Sales',
        accountId:   CoA['4001'].id,
        description: `Order payment received`,
        reference:   order.paymentRef || `ORD-${order.id.slice(-6).toUpperCase()}`,
        orderId:     order.id,
        createdAt:   order.paidAt || order.createdAt,
        updatedAt:   order.paidAt || order.createdAt,
      },
    })
  }
  console.log(`✅  Income transactions: ${deliveredOrders.length}`)

  // Expense transactions (operating costs over 3 months)
  const expenseSeed = [
    // ── Rent (monthly) ─────────────────────────────────────────────────────────
    { date: daysAgo(90), amount: 3500,   accountId: CoA['5005'].id, category: 'Rent & Premises',      description: 'Monthly kitchen rental — October 2024',            reference: 'RENT-OCT24'  },
    { date: daysAgo(60), amount: 3500,   accountId: CoA['5005'].id, category: 'Rent & Premises',      description: 'Monthly kitchen rental — November 2024',           reference: 'RENT-NOV24'  },
    { date: daysAgo(30), amount: 3500,   accountId: CoA['5005'].id, category: 'Rent & Premises',      description: 'Monthly kitchen rental — December 2024',           reference: 'RENT-DEC24'  },
    { date: daysAgo(5),  amount: 3500,   accountId: CoA['5005'].id, category: 'Rent & Premises',      description: 'Monthly kitchen rental — January 2025',            reference: 'RENT-JAN25'  },
    // ── Utilities (monthly) ────────────────────────────────────────────────────
    { date: daysAgo(85), amount: 920,    accountId: CoA['5007'].id, category: 'Utilities',            description: 'Electricity & water — October 2024',               reference: 'UTIL-OCT24'  },
    { date: daysAgo(55), amount: 870,    accountId: CoA['5007'].id, category: 'Utilities',            description: 'Electricity & water — November 2024',              reference: 'UTIL-NOV24'  },
    { date: daysAgo(25), amount: 1050,   accountId: CoA['5007'].id, category: 'Utilities',            description: 'Electricity & water — December 2024 (summer peak)', reference: 'UTIL-DEC24' },
    { date: daysAgo(3),  amount: 840,    accountId: CoA['5007'].id, category: 'Utilities',            description: 'Electricity & water — January 2025',               reference: 'UTIL-JAN25'  },
    // ── Ingredients (supplier invoices) ───────────────────────────────────────
    { date: daysAgo(90), amount: 1492,   accountId: CoA['5001'].id, category: 'Ingredients',          description: 'SA Flour Mills — flour & sugar restock (Oct)',      reference: 'INV-SAFL-001' },
    { date: daysAgo(60), amount: 1602,   accountId: CoA['5001'].id, category: 'Ingredients',          description: 'Cape Dairy Co — butter, eggs, cream, milk (Nov)',   reference: 'INV-CDAI-001' },
    { date: daysAgo(45), amount: 1545,   accountId: CoA['5001'].id, category: 'Ingredients',          description: 'Choc World Imports — chocolate, cocoa (Nov)',       reference: 'INV-CHOC-001' },
    { date: daysAgo(28), amount: 850,    accountId: CoA['5001'].id, category: 'Ingredients',          description: 'Cape Dairy Co — dairy restock (Dec)',               reference: 'INV-CDAI-002' },
    { date: daysAgo(14), amount: 620,    accountId: CoA['5001'].id, category: 'Ingredients',          description: 'SA Flour Mills — flour top-up (Dec)',               reference: 'INV-SAFL-002' },
    // ── Packaging ─────────────────────────────────────────────────────────────
    { date: daysAgo(45), amount: 1345,   accountId: CoA['5002'].id, category: 'Packaging',            description: 'Bakery Packaging SA — boxes, bags, labels (Nov)',   reference: 'INV-BPAK-001' },
    { date: daysAgo(20), amount: 420,    accountId: CoA['5002'].id, category: 'Packaging',            description: 'Bakery Packaging SA — urgent labels reorder',       reference: 'INV-BPAK-002' },
    // ── Marketing ─────────────────────────────────────────────────────────────
    { date: daysAgo(75), amount: 350,    accountId: CoA['5006'].id, category: 'Marketing',            description: 'Facebook & Instagram ads — October campaign',       reference: 'MKT-OCT-001'  },
    { date: daysAgo(50), amount: 500,    accountId: CoA['5006'].id, category: 'Marketing',            description: 'Facebook & Instagram ads — November campaign',      reference: 'MKT-NOV-001'  },
    { date: daysAgo(35), amount: 220,    accountId: CoA['5006'].id, category: 'Marketing',            description: 'Flyer printing — local market promotion',          reference: 'MKT-DEC-001'  },
    { date: daysAgo(15), amount: 750,    accountId: CoA['5006'].id, category: 'Marketing',            description: 'Facebook & Instagram ads — January campaign',       reference: 'MKT-JAN-001'  },
    // ── Bank Charges ──────────────────────────────────────────────────────────
    { date: daysAgo(88), amount: 125,    accountId: CoA['5009'].id, category: 'Bank Charges',         description: 'FNB monthly account fees — October 2024',          reference: 'BANK-OCT24'   },
    { date: daysAgo(58), amount: 131,    accountId: CoA['5009'].id, category: 'Bank Charges',         description: 'FNB monthly account fees — November 2024',         reference: 'BANK-NOV24'   },
    { date: daysAgo(28), amount: 128,    accountId: CoA['5009'].id, category: 'Bank Charges',         description: 'FNB monthly account fees — December 2024',         reference: 'BANK-DEC24'   },
    { date: daysAgo(3),  amount: 134,    accountId: CoA['5009'].id, category: 'Bank Charges',         description: 'FNB monthly account fees — January 2025',          reference: 'BANK-JAN25'   },
    // ── Equipment ─────────────────────────────────────────────────────────────
    { date: daysAgo(65), amount: 1850,   accountId: CoA['5008'].id, category: 'Equipment & Supplies', description: 'New stand mixer — KitchenAid replacement part',      reference: 'EQUIP-001'    },
    { date: daysAgo(30), amount: 320,    accountId: CoA['5008'].id, category: 'Equipment & Supplies', description: 'Kitchen scales, silicone mats, piping set',         reference: 'EQUIP-002'    },
    // ── Transport ─────────────────────────────────────────────────────────────
    { date: daysAgo(70), amount: 480,    accountId: CoA['5003'].id, category: 'Transport & Delivery', description: 'Fuel reimbursement — October deliveries',           reference: 'FUEL-OCT24'   },
    { date: daysAgo(40), amount: 510,    accountId: CoA['5003'].id, category: 'Transport & Delivery', description: 'Fuel reimbursement — November deliveries',          reference: 'FUEL-NOV24'   },
    { date: daysAgo(12), amount: 390,    accountId: CoA['5003'].id, category: 'Transport & Delivery', description: 'Courier costs — courier for distant deliveries',    reference: 'COURIER-DEC24' },
    // ── Other ─────────────────────────────────────────────────────────────────
    { date: daysAgo(55), amount: 275,    accountId: CoA['5099'].id, category: 'Other Expenses',       description: 'Professional cleaning supplies (bulk)',             reference: 'MISC-001'     },
    { date: daysAgo(20), amount: 180,    accountId: CoA['5099'].id, category: 'Other Expenses',       description: 'Subscription: Canva Pro (annual)',                  reference: 'MISC-002'     },
  ]

  for (const exp of expenseSeed) {
    await db.financeTransaction.create({
      data: {
        date:        exp.date,
        amount:      exp.amount,
        type:        'EXPENSE',
        category:    exp.category,
        accountId:   exp.accountId,
        description: exp.description,
        reference:   exp.reference,
        createdAt:   exp.date,
        updatedAt:   exp.date,
      },
    })
  }
  console.log(`✅  Expense transactions: ${expenseSeed.length}`)

  // ─── Bank Account + Bank Transactions ─────────────────────────────────────────
  const bankAccount = await db.bankAccount.create({
    data: {
      name:          'FNB Business Cheque',
      bankName:      'First National Bank',
      accountNumber: '62XXXXXXX7823',
      balance:       24850.00,
      currency:      'ZAR',
      isActive:      true,
    },
  })

  // We'll match some bank transactions to the finance transactions created above
  // First, collect a handful of finance transaction IDs for the match
  const ftList = await db.financeTransaction.findMany({
    where: { type: 'EXPENSE' },
    orderBy: { date: 'asc' },
    take: 8,
    select: { id: true, amount: true, description: true, date: true, reference: true },
  })

  const bankTxns = [
    // ── Credits (money in) — some from orders paid via EFT ───────────────────
    { date: daysAgo(88), description: 'PAYMENT RECEIVED PAY-8802 NOMSA DLAMINI',  amount:  179,   balance: 18200,  reference: 'PAY-8802', status: 'MATCHED'   },
    { date: daysAgo(85), description: 'PAYMENT RECEIVED PAY-8803 THABO MOKOENA',  amount:  305,   balance: 18505,  reference: 'PAY-8803', status: 'MATCHED'   },
    { date: daysAgo(83), description: 'PAYMENT RECEIVED PAY-8804 PRIYA NAIDOO',   amount:  201,   balance: 18706,  reference: 'PAY-8804', status: 'MATCHED'   },
    { date: daysAgo(82), description: 'PAYMENT RECEIVED PAY-8805 LISA VAN WYK',   amount:  201,   balance: 18907,  reference: 'PAY-8805', status: 'MATCHED'   },
    { date: daysAgo(80), description: 'CASH DEPOSIT NOMSA DLAMINI',               amount:  150,   balance: 19057,  reference: null,       status: 'UNMATCHED' },
    { date: daysAgo(60), description: 'PAYMENT RECEIVED PAY-8820 NOMSA DLAMINI',  amount:  248,   balance: 20100,  reference: 'PAY-8820', status: 'MATCHED'   },
    { date: daysAgo(54), description: 'PAYMENT RECEIVED PAY-8823 THABO MOKOENA',  amount:  252,   balance: 20600,  reference: 'PAY-8823', status: 'MATCHED'   },
    { date: daysAgo(30), description: 'PAYMENT RECEIVED PAY-8840 NOMSA DLAMINI',  amount:  237,   balance: 22800,  reference: 'PAY-8840', status: 'MATCHED'   },
    { date: daysAgo(7),  description: 'PAYMENT RECEIVED PAY-8860 SIPHO NDLOVU',   amount:  237,   balance: 24500,  reference: 'PAY-8860', status: 'MATCHED'   },
    { date: daysAgo(1),  description: 'EFT CREDIT UNKNOWN CUSTOMER REF 77712',    amount:  225,   balance: 24850,  reference: '77712',    status: 'UNMATCHED' }, // unmatched — customer paid but no order ref
    // ── Debits (money out) — matched to expense transactions ────────────────
    { date: daysAgo(90), description: `EFT DEBIT SA FLOUR MILLS ${ftList[0]?.reference ?? 'INV001'}`,  amount: -(ftList[0] ? Number(ftList[0].amount) : 1492), balance: 17500, reference: ftList[0]?.reference ?? null, status: 'MATCHED'   },
    { date: daysAgo(88), description: 'DEBIT ORDER FNB ACCOUNT FEES OCT',         amount:  -125,  balance: 17375,  reference: 'BANK-OCT24',    status: 'MATCHED'   },
    { date: daysAgo(60), description: `EFT DEBIT CAPE DAIRY CO ${ftList[1]?.reference ?? 'INV002'}`,   amount: -(ftList[1] ? Number(ftList[1].amount) : 1602), balance: 18000, reference: ftList[1]?.reference ?? null, status: 'MATCHED'   },
    { date: daysAgo(58), description: 'DEBIT ORDER FNB ACCOUNT FEES NOV',         amount:  -131,  balance: 17869,  reference: 'BANK-NOV24',    status: 'MATCHED'   },
    { date: daysAgo(45), description: `EFT DEBIT CHOC WORLD IMPORTS ${ftList[2]?.reference ?? 'INV003'}`, amount: -(ftList[2] ? Number(ftList[2].amount) : 1545), balance: 18500, reference: ftList[2]?.reference ?? null, status: 'MATCHED'  },
    { date: daysAgo(45), description: `EFT DEBIT BAKERY PACKAGING SA ${ftList[3]?.reference ?? 'INV004'}`, amount: -(ftList[3] ? Number(ftList[3].amount) : 1345), balance: 17500, reference: ftList[3]?.reference ?? null, status: 'MATCHED' },
    { date: daysAgo(35), description: 'DEBIT CARD POS FLYER PRINTING',            amount:  -220,  balance: 19100,  reference: 'MKT-DEC-001',   status: 'MATCHED'   },
    { date: daysAgo(28), description: 'DEBIT ORDER FNB ACCOUNT FEES DEC',         amount:  -128,  balance: 21900,  reference: 'BANK-DEC24',    status: 'MATCHED'   },
    { date: daysAgo(15), description: 'DEBIT CARD META ADS SOCIAL MEDIA',         amount:  -750,  balance: 22850,  reference: 'MKT-JAN-001',   status: 'MATCHED'   },
    { date: daysAgo(3),  description: 'DEBIT ORDER FNB ACCOUNT FEES JAN',         amount:  -134,  balance: 24716,  reference: 'BANK-JAN25',    status: 'MATCHED'   },
    { date: daysAgo(2),  description: 'DEBIT CARD BP FUEL GARFIELD DR',           amount:  -450,  balance: 24266,  reference: null,             status: 'UNMATCHED' }, // petrol not yet recorded as expense
    { date: daysAgo(1),  description: 'CANVA PRO SUBSCRIPTION USD CONVERTED',     amount:  -194,  balance: 24072,  reference: null,             status: 'UNMATCHED' }, // FX conversion — needs manual match
    { date: daysAgo(0),  description: 'DEBIT CARD WOOLWORTHS FOOD SUPPLIES',      amount:  -380,  balance: 23692,  reference: null,             status: 'IGNORED'   }, // owner personal purchase — ignored
  ]

  for (const bt of bankTxns) {
    await db.bankTransaction.create({
      data: {
        bankAccountId: bankAccount.id,
        date:          bt.date,
        description:   bt.description,
        amount:        bt.amount,
        balance:       bt.balance,
        reference:     bt.reference,
        status:        bt.status,
      },
    })
  }
  console.log(`✅  Bank account created + ${bankTxns.length} bank transactions (MATCHED × 14, UNMATCHED × 4, IGNORED × 1)`)

  // ─── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n🎉  Seed complete!\n')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  TLAKA TREATS — TEST DATA SUMMARY')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Users')
  console.log('  ├─ Admin:       admin@tlakatreats.co.za   |  Admin@12345')
  console.log('  ├─ Customers:   6 accounts                |  Customer@123')
  console.log('  ├─ Ambassadors: 3 accounts                |  Ambassador@123')
  console.log('  │     Zanele  TT-ZANE7823  12%  ACTIVE / KYC APPROVED')
  console.log('  │     Michael TT-MICH4419  10%  ACTIVE / KYC SUBMITTED')
  console.log('  │     Sibusiso TT-SIBU0312  10%  ACTIVE / KYC APPROVED')
  console.log('  Products')
  console.log('  ├─ Sellable:    6 products (biscuits, scones, cakes, bread)')
  console.log('  ├─ Ingredients: 16 products  |  Packaging: 7 products')
  console.log('  ├─ Stock items: 23 (2 below min stock, 1 out of stock)')
  console.log('  Suppliers & Ops')
  console.log('  ├─ Suppliers:   4 (SA Flour Mills, Cape Dairy, Bakery Pack, Choc World)')
  console.log('  ├─ Purchase orders: 5 (RECEIVED × 3, ORDERED × 1, DRAFT × 1)')
  console.log('  ├─ Recipes:     5  |  Production runs: 8')
  console.log('  Orders & Commissions')
  console.log('  ├─ Orders:      38 total (DELIVERED × 31, PENDING/CONFIRMED/BAKING/READY/OFD × 5, CANCELLED × 2)')
  console.log('  ├─ Commissions: Ambassador orders over 3 months')
  console.log('  │     Zanele:  PAID × 4, APPROVED × 3, PENDING for remaining')
  console.log('  │     Michael: PENDING for his orders')
  console.log('  │     Sibusiso: PENDING for his orders')
  console.log('  │     1 payout COMPLETED to Zanele')
  console.log('  Finance')
  console.log('  ├─ Chart of Accounts: 21 accounts (full CoA)')
  console.log('  ├─ Income txns:  31 (one per delivered order)')
  console.log('  ├─ Expense txns: 29 (rent, utilities, ingredients, packaging, marketing…)')
  console.log('  ├─ Bank account: FNB Business Cheque 62XXXXXXX7823')
  console.log('  └─ Bank txns:   23 (MATCHED × 14, UNMATCHED × 4, IGNORED × 1)')
  console.log('═══════════════════════════════════════════════════════════\n')
  console.log('  Run migration first:')
  console.log('  npx prisma db push --schema=src/prisma/schema.prisma')
  console.log('  Then: npm run db:seed')
  console.log('═══════════════════════════════════════════════════════════\n')
}

main()
  .catch(e => { console.error('❌  Seed failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
