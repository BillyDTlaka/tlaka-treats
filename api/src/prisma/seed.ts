import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const db = prisma as any

async function main() {
  console.log('🌱 Seeding database…')

  // ─── Clean slate (FK-safe order) ────────────────────────────────────────────
  await db.recipeIngredient.deleteMany({})
  await db.productionRun.deleteMany({})
  await db.recipe.deleteMany({})
  await db.stockMovement.deleteMany({})
  await db.purchaseOrderItem.deleteMany({})
  await db.purchaseOrder.deleteMany({})
  await db.stockItem.deleteMany({})
  await prisma.variantPrice.deleteMany({})
  await prisma.productVariant.deleteMany({})
  await db.product.deleteMany({})
  await db.supplier.deleteMany({})
  await prisma.category.deleteMany({})
  await db.ambassador.deleteMany({})
  await prisma.address.deleteMany({})
  await prisma.userRole.deleteMany({})
  await prisma.user.deleteMany({})
  await prisma.permission.deleteMany({})
  await prisma.role.deleteMany({})
  await db.financeAccount.deleteMany({})
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
    prisma.user.create({ data: { email: 'nomsa.dlamini@gmail.com',    firstName: 'Nomsa',   lastName: 'Dlamini',  phone: '0821234567', passwordHash: custPw, roles: { create: { roleId: customerRole.id } } } }),
    prisma.user.create({ data: { email: 'thabo.mokoena@gmail.com',    firstName: 'Thabo',   lastName: 'Mokoena',  phone: '0839876543', passwordHash: custPw, roles: { create: { roleId: customerRole.id } } } }),
    prisma.user.create({ data: { email: 'priya.naidoo@outlook.com',   firstName: 'Priya',   lastName: 'Naidoo',   phone: '0764455667', passwordHash: custPw, roles: { create: { roleId: customerRole.id } } } }),
    prisma.user.create({ data: { email: 'lisa.van.wyk@webmail.co.za', firstName: 'Lisa',    lastName: 'Van Wyk',  phone: '0711223344', passwordHash: custPw, roles: { create: { roleId: customerRole.id } } } }),
    prisma.user.create({ data: { email: 'sipho.ndlovu@gmail.com',     firstName: 'Sipho',   lastName: 'Ndlovu',   phone: '0792223344', passwordHash: custPw, roles: { create: { roleId: customerRole.id } } } }),
    prisma.user.create({ data: { email: 'aisha.patel@icloud.com',     firstName: 'Aisha',   lastName: 'Patel',    phone: '0861234321', passwordHash: custPw, roles: { create: { roleId: customerRole.id } } } }),
  ])
  console.log('✅  Customers: 6')

  // ─── Addresses ───────────────────────────────────────────────────────────────
  await Promise.all([
    prisma.address.create({ data: { userId: nomsa.id, label: 'Home', street: '14 Jacaranda St', suburb: 'Naturena',     city: 'Johannesburg', province: 'Gauteng', postalCode: '1835', isDefault: true } }),
    prisma.address.create({ data: { userId: thabo.id, label: 'Home', street: '7 Acacia Ave',    suburb: 'Soweto',       city: 'Johannesburg', province: 'Gauteng', postalCode: '1804', isDefault: true } }),
    prisma.address.create({ data: { userId: priya.id, label: 'Home', street: '22 Palm Rd',      suburb: 'Lenasia',      city: 'Johannesburg', province: 'Gauteng', postalCode: '1820', isDefault: true } }),
    prisma.address.create({ data: { userId: lisa.id,  label: 'Home', street: '5 Berg St',       suburb: 'Randburg',     city: 'Johannesburg', province: 'Gauteng', postalCode: '2194', isDefault: true } }),
    prisma.address.create({ data: { userId: sipho.id, label: 'Home', street: '33 Oak Rd',       suburb: 'Tembisa',      city: 'Ekurhuleni',   province: 'Gauteng', postalCode: '1632', isDefault: true } }),
    prisma.address.create({ data: { userId: aisha.id, label: 'Home', street: '88 Lotus Rd',     suburb: 'Laudium',      city: 'Pretoria',     province: 'Gauteng', postalCode: '0037', isDefault: true } }),
  ])
  console.log('✅  Addresses: 6')

  // ─── Ambassadors ─────────────────────────────────────────────────────────────
  const ambPw = await bcrypt.hash('Ambassador@123', 12)
  const [ambUser1, ambUser2, ambUser3] = await Promise.all([
    prisma.user.create({ data: { email: 'zanele.khumalo@gmail.com',   firstName: 'Zanele',   lastName: 'Khumalo',  phone: '0835559988', passwordHash: ambPw, roles: { create: [{ roleId: customerRole.id }, { roleId: ambassadorRole.id }] } } }),
    prisma.user.create({ data: { email: 'michael.ferreira@gmail.com', firstName: 'Michael',  lastName: 'Ferreira', phone: '0724448899', passwordHash: ambPw, roles: { create: [{ roleId: customerRole.id }, { roleId: ambassadorRole.id }] } } }),
    prisma.user.create({ data: { email: 'sibusiso.zulu@gmail.com',    firstName: 'Sibusiso', lastName: 'Zulu',     phone: '0612227788', passwordHash: ambPw, roles: { create: [{ roleId: customerRole.id }, { roleId: ambassadorRole.id }] } } }),
  ])
  await Promise.all([
    db.ambassador.create({ data: { userId: ambUser1.id, code: 'TT-ZANE7823', commissionRate: 0.12, status: 'ACTIVE', bio: 'Passionate foodie and mom of 3.', kycStatus: 'APPROVED', kycData: { phone: '0835559988', idType: 'ID_BOOK', idNumber: '8504150XXXX084' } } }),
    db.ambassador.create({ data: { userId: ambUser2.id, code: 'TT-MICH4419', commissionRate: 0.10, status: 'ACTIVE', bio: 'Gym trainer promoting quality baked goods.', kycStatus: 'SUBMITTED', kycData: { phone: '0724448899', idType: 'PASSPORT', idNumber: 'M234567XX' } } }),
    db.ambassador.create({ data: { userId: ambUser3.id, code: 'TT-SIBU0312', commissionRate: 0.10, status: 'ACTIVE', bio: 'Community leader in Soweto.', kycStatus: 'APPROVED', kycData: { phone: '0612227788', idType: 'ID_BOOK', idNumber: '9011235XXXX088' } } }),
  ])
  console.log('✅  Ambassadors: 3')

  // ─── Categories ──────────────────────────────────────────────────────────────
  const [catBiscuits, catScones, catCakes, catBread] = await Promise.all([
    prisma.category.create({ data: { name: 'Biscuits', description: 'Freshly baked biscuits and cookies' } }),
    prisma.category.create({ data: { name: 'Scones',   description: 'Light and fluffy scones' } }),
    prisma.category.create({ data: { name: 'Cakes',    description: 'Decadent home-style cakes' } }),
    prisma.category.create({ data: { name: 'Bread',    description: 'Artisan breads baked fresh daily' } }),
  ])
  console.log('✅  Categories: 4')

  // ─── Sellable Products ───────────────────────────────────────────────────────
  await Promise.all([
    prisma.product.create({ data: {
      name: 'Choc Chip Biscuits', categoryId: catBiscuits.id,
      description: 'Classic chocolate chip biscuits — soft in the middle, golden on the outside.',
      variants: { create: [
        { name: '12 Pack', prices: { create: [{ tier: 'RETAIL', price: 55 }, { tier: 'AMBASSADOR', price: 48 }, { tier: 'WHOLESALE', price: 40 }] } },
        { name: '24 Pack', prices: { create: [{ tier: 'RETAIL', price: 99 }, { tier: 'AMBASSADOR', price: 88 }, { tier: 'WHOLESALE', price: 72 }] } },
      ]},
    }}),
    prisma.product.create({ data: {
      name: 'Classic Vanilla Scones', categoryId: catScones.id,
      description: 'Light, fluffy scones made with fresh cream and a hint of vanilla.',
      variants: { create: [
        { name: '6 Pack',  prices: { create: [{ tier: 'RETAIL', price: 65 },  { tier: 'AMBASSADOR', price: 58  }, { tier: 'WHOLESALE', price: 50  }] } },
        { name: '12 Pack', prices: { create: [{ tier: 'RETAIL', price: 120 }, { tier: 'AMBASSADOR', price: 108 }, { tier: 'WHOLESALE', price: 90  }] } },
      ]},
    }}),
    prisma.product.create({ data: {
      name: 'Chocolate Fudge Cake', categoryId: catCakes.id,
      description: 'Rich, moist chocolate fudge cake smothered in a velvety chocolate ganache.',
      variants: { create: [
        { name: 'Whole Cake (8")', prices: { create: [{ tier: 'RETAIL', price: 280 }, { tier: 'AMBASSADOR', price: 252 }, { tier: 'WHOLESALE', price: 220 }] } },
        { name: 'Half Cake',       prices: { create: [{ tier: 'RETAIL', price: 150 }, { tier: 'AMBASSADOR', price: 135 }, { tier: 'WHOLESALE', price: 120 }] } },
      ]},
    }}),
    prisma.product.create({ data: {
      name: 'Sourdough Loaf', categoryId: catBread.id,
      description: 'Slow-fermented sourdough with a crispy crust and chewy crumb.',
      variants: { create: [
        { name: 'Standard Loaf', prices: { create: [{ tier: 'RETAIL', price: 75 }, { tier: 'AMBASSADOR', price: 68 }, { tier: 'WHOLESALE', price: 55 }] } },
      ]},
    }}),
    prisma.product.create({ data: {
      name: 'Lemon Poppy Seed Cake', categoryId: catCakes.id,
      description: 'Zesty lemon drizzle cake dotted with poppy seeds, topped with a lemon glaze.',
      variants: { create: [
        { name: 'Whole Cake (8")', prices: { create: [{ tier: 'RETAIL', price: 260 }, { tier: 'AMBASSADOR', price: 234 }, { tier: 'WHOLESALE', price: 200 }] } },
        { name: 'Half Cake',       prices: { create: [{ tier: 'RETAIL', price: 140 }, { tier: 'AMBASSADOR', price: 126 }, { tier: 'WHOLESALE', price: 110 }] } },
      ]},
    }}),
    prisma.product.create({ data: {
      name: 'Rooibos Shortbread', categoryId: catBiscuits.id,
      description: 'Melt-in-your-mouth shortbread infused with South African rooibos tea.',
      variants: { create: [
        { name: '12 Pack', prices: { create: [{ tier: 'RETAIL', price: 60 },  { tier: 'AMBASSADOR', price: 52 }, { tier: 'WHOLESALE', price: 44 }] } },
        { name: '24 Pack', prices: { create: [{ tier: 'RETAIL', price: 110 }, { tier: 'AMBASSADOR', price: 96 }, { tier: 'WHOLESALE', price: 80 }] } },
      ]},
    }}),
  ])
  console.log('✅  Products: 6')

  // ─── Suppliers ────────────────────────────────────────────────────────────────
  const [flourMills, capedairy, bakeryPack, chocWorld] = await Promise.all([
    db.supplier.create({ data: { name: 'SA Flour Mills',      contactName: 'Johan Pretorius', phone: '0113456789', email: 'orders@saflour.co.za',  city: 'Johannesburg', notes: 'Main flour and sugar supplier. Min order R500.', status: 'ACTIVE' } }),
    db.supplier.create({ data: { name: 'Cape Dairy Co',       contactName: 'Anele Botha',     phone: '0219876543', email: 'supply@capedairy.co.za', city: 'Cape Town',    notes: 'Fresh dairy. Weekly delivery. Keep refrigerated.', status: 'ACTIVE' } }),
    db.supplier.create({ data: { name: 'Bakery Packaging SA', contactName: 'Ravi Nair',       phone: '0317654321', email: 'sales@bakpacksa.co.za',  city: 'Durban',       notes: 'All packaging. Lead time 3-5 biz days.', status: 'ACTIVE' } }),
    db.supplier.create({ data: { name: 'Choc World Imports',  contactName: 'Maria Santos',    phone: '0114445566', email: 'orders@chocworld.co.za', city: 'Johannesburg', notes: 'Premium Belgian and local chocolate.', status: 'ACTIVE' } }),
  ])
  console.log('✅  Suppliers: 4')

  // ─── Ingredient & Packaging Products + Stock Items ────────────────────────────
  const ingredientData = [
    { name: 'All-Purpose Flour',      supplierId: flourMills.id, sku: 'ING-FLOUR-AP', unit: 'kg',    stock: 25.0,  min: 10.0, cost: 14.50 },
    { name: 'Cake Flour',             supplierId: flourMills.id, sku: 'ING-FLOUR-CK', unit: 'kg',    stock: 18.5,  min:  8.0, cost: 16.00 },
    { name: 'Caster Sugar',           supplierId: flourMills.id, sku: 'ING-SUGAR-CS', unit: 'kg',    stock: 12.0,  min:  5.0, cost: 18.00 },
    { name: 'Brown Sugar',            supplierId: flourMills.id, sku: 'ING-SUGAR-BR', unit: 'kg',    stock:  4.5,  min:  5.0, cost: 17.00, notes: 'BELOW MIN — reorder required' },
    { name: 'Unsalted Butter',        supplierId: capedairy.id,  sku: 'ING-BUTT-UN',  unit: 'kg',    stock:  8.2,  min:  4.0, cost: 95.00, notes: 'Keep refrigerated.' },
    { name: 'Large Eggs',             supplierId: capedairy.id,  sku: 'ING-EGGS-LG',  unit: 'units', stock: 120,   min: 48,   cost:  5.50 },
    { name: 'Fresh Cream',            supplierId: capedairy.id,  sku: 'ING-CREM-FR',  unit: 'ml',    stock: 3500,  min: 2000, cost:  0.048 },
    { name: 'Full Cream Milk',        supplierId: capedairy.id,  sku: 'ING-MILK-FC',  unit: 'ml',    stock: 5000,  min: 2000, cost:  0.018 },
    { name: 'Baking Powder',          supplierId: null,          sku: 'ING-BAKPOW',   unit: 'g',     stock:  800,  min:  300, cost:  0.085 },
    { name: 'Bicarbonate of Soda',    supplierId: null,          sku: 'ING-BICARB',   unit: 'g',     stock:  600,  min:  200, cost:  0.065 },
    { name: 'Vanilla Essence',        supplierId: null,          sku: 'ING-VAN-ES',   unit: 'ml',    stock:  350,  min:  100, cost:  0.52  },
    { name: 'Fine Salt',              supplierId: null,          sku: 'ING-SALT-FN',  unit: 'g',     stock: 2000,  min:  500, cost:  0.009 },
    { name: 'Chocolate Chips (dark)', supplierId: chocWorld.id,  sku: 'ING-CHOC-DK',  unit: 'g',     stock: 3200,  min: 1000, cost:  0.12  },
    { name: 'Cocoa Powder (Dutch)',   supplierId: chocWorld.id,  sku: 'ING-COCO-PW',  unit: 'g',     stock:    0,  min:  500, cost:  0.095, notes: 'OUT OF STOCK — urgent reorder' },
    { name: 'Dark Chocolate (block)', supplierId: chocWorld.id,  sku: 'ING-CHOC-BK',  unit: 'g',     stock: 1500,  min:  500, cost:  0.14  },
    { name: 'Loose Leaf Rooibos',     supplierId: null,          sku: 'ING-ROOI-LL',  unit: 'g',     stock:  400,  min:  150, cost:  0.18  },
  ]

  const packagingData = [
    { name: 'Biscuit Box (12-pack)', supplierId: bakeryPack.id, sku: 'PKG-BOX-12',  unit: 'units', stock:  85, min:  30, cost: 5.50 },
    { name: 'Biscuit Box (24-pack)', supplierId: bakeryPack.id, sku: 'PKG-BOX-24',  unit: 'units', stock:  40, min:  20, cost: 7.50 },
    { name: 'Scone Box (6-pack)',    supplierId: bakeryPack.id, sku: 'PKG-BOX-06',  unit: 'units', stock:  60, min:  24, cost: 4.80 },
    { name: 'Cake Tin Liner',        supplierId: bakeryPack.id, sku: 'PKG-CAKE-LN', unit: 'units', stock:  50, min:  20, cost: 1.20 },
    { name: 'Cellophane Bags',       supplierId: bakeryPack.id, sku: 'PKG-CELLO',   unit: 'units', stock: 200, min: 100, cost: 0.90 },
    { name: 'Tlaka Treats Labels',   supplierId: bakeryPack.id, sku: 'PKG-LABEL',   unit: 'units', stock: 500, min: 150, cost: 0.45, notes: 'Custom printed. 2-week lead time.' },
    { name: 'Raffia Twine',          supplierId: bakeryPack.id, sku: 'PKG-TWINE',   unit: 'm',     stock:  80, min:  20, cost: 0.35 },
  ]

  for (const item of [...ingredientData, ...packagingData]) {
    const classification = item.sku.startsWith('ING') ? 'INGREDIENT' : 'PACKAGING'
    const prod = await db.product.create({ data: {
      name: item.name, classification,
      supplierId: item.supplierId ?? null,
    }})
    await db.stockItem.create({ data: {
      productId: prod.id, name: item.name, sku: item.sku, unit: item.unit,
      currentStock: item.stock, minStockLevel: item.min, costPerUnit: item.cost,
      notes: (item as any).notes ?? null,
    }})
  }
  console.log('✅  Ingredients & packaging stock: 23 items')

  // ─── Recipes ──────────────────────────────────────────────────────────────────
  // Look up stock items by SKU for recipe ingredients
  const stockItems = await db.stockItem.findMany({})
  const S: Record<string, any> = {}
  for (const s of stockItems) S[s.sku] = s

  await Promise.all([
    db.recipe.create({ data: {
      name: 'Choc Chip Biscuits (Classic)', yieldQty: 24, yieldUnit: 'biscuits',
      notes: 'Makes 24 biscuits. Bake 180°C for 12-14 min.',
      ingredients: { create: [
        { stockItemId: S['ING-FLOUR-AP'].id, quantity: 0.250, unit: 'kg'    },
        { stockItemId: S['ING-BUTT-UN'].id,  quantity: 0.150, unit: 'kg'    },
        { stockItemId: S['ING-SUGAR-CS'].id, quantity: 0.100, unit: 'kg'    },
        { stockItemId: S['ING-SUGAR-BR'].id, quantity: 0.080, unit: 'kg'    },
        { stockItemId: S['ING-CHOC-DK'].id,  quantity: 200,   unit: 'g'     },
        { stockItemId: S['ING-EGGS-LG'].id,  quantity: 2,     unit: 'units' },
        { stockItemId: S['ING-VAN-ES'].id,   quantity: 5,     unit: 'ml'    },
        { stockItemId: S['ING-BAKPOW'].id,   quantity: 5,     unit: 'g'     },
        { stockItemId: S['ING-SALT-FN'].id,  quantity: 3,     unit: 'g'     },
      ]},
    }}),
    db.recipe.create({ data: {
      name: 'Classic Cream Scones', yieldQty: 8, yieldUnit: 'scones',
      notes: "Don't overwork dough. Bake 220°C for 12-15 min.",
      ingredients: { create: [
        { stockItemId: S['ING-FLOUR-CK'].id, quantity: 0.500, unit: 'kg'    },
        { stockItemId: S['ING-BAKPOW'].id,   quantity: 20,    unit: 'g'     },
        { stockItemId: S['ING-BUTT-UN'].id,  quantity: 0.080, unit: 'kg'    },
        { stockItemId: S['ING-SUGAR-CS'].id, quantity: 0.050, unit: 'kg'    },
        { stockItemId: S['ING-CREM-FR'].id,  quantity: 200,   unit: 'ml'    },
        { stockItemId: S['ING-EGGS-LG'].id,  quantity: 1,     unit: 'units' },
        { stockItemId: S['ING-SALT-FN'].id,  quantity: 3,     unit: 'g'     },
      ]},
    }}),
    db.recipe.create({ data: {
      name: 'Chocolate Fudge Cake', yieldQty: 1, yieldUnit: 'cake (8 inch)',
      notes: 'Bake 180°C for 30-35 min. Ganache when fully cooled.',
      ingredients: { create: [
        { stockItemId: S['ING-FLOUR-CK'].id, quantity: 0.300, unit: 'kg'    },
        { stockItemId: S['ING-COCO-PW'].id,  quantity: 60,    unit: 'g'     },
        { stockItemId: S['ING-SUGAR-CS'].id, quantity: 0.300, unit: 'kg'    },
        { stockItemId: S['ING-BUTT-UN'].id,  quantity: 0.200, unit: 'kg'    },
        { stockItemId: S['ING-EGGS-LG'].id,  quantity: 4,     unit: 'units' },
        { stockItemId: S['ING-MILK-FC'].id,  quantity: 240,   unit: 'ml'    },
        { stockItemId: S['ING-VAN-ES'].id,   quantity: 10,    unit: 'ml'    },
        { stockItemId: S['ING-BAKPOW'].id,   quantity: 10,    unit: 'g'     },
        { stockItemId: S['ING-BICARB'].id,   quantity: 5,     unit: 'g'     },
        { stockItemId: S['ING-SALT-FN'].id,  quantity: 3,     unit: 'g'     },
        { stockItemId: S['ING-CHOC-BK'].id,  quantity: 250,   unit: 'g'     },
      ]},
    }}),
    db.recipe.create({ data: {
      name: 'Rooibos Shortbread', yieldQty: 20, yieldUnit: 'shortbread pieces',
      notes: 'Bake 160°C for 18-20 min. Should be pale, not browned.',
      ingredients: { create: [
        { stockItemId: S['ING-FLOUR-AP'].id, quantity: 0.300, unit: 'kg' },
        { stockItemId: S['ING-BUTT-UN'].id,  quantity: 0.200, unit: 'kg' },
        { stockItemId: S['ING-SUGAR-BR'].id, quantity: 0.100, unit: 'kg' },
        { stockItemId: S['ING-ROOI-LL'].id,  quantity: 8,     unit: 'g'  },
        { stockItemId: S['ING-SALT-FN'].id,  quantity: 2,     unit: 'g'  },
      ]},
    }}),
    db.recipe.create({ data: {
      name: 'Lemon Poppy Seed Cake', yieldQty: 1, yieldUnit: 'cake (8 inch)',
      notes: 'Bake 175°C for 40 min. Add lemon glaze while still warm.',
      ingredients: { create: [
        { stockItemId: S['ING-FLOUR-CK'].id, quantity: 0.280, unit: 'kg'    },
        { stockItemId: S['ING-SUGAR-CS'].id, quantity: 0.250, unit: 'kg'    },
        { stockItemId: S['ING-BUTT-UN'].id,  quantity: 0.180, unit: 'kg'    },
        { stockItemId: S['ING-EGGS-LG'].id,  quantity: 3,     unit: 'units' },
        { stockItemId: S['ING-MILK-FC'].id,  quantity: 180,   unit: 'ml'    },
        { stockItemId: S['ING-BAKPOW'].id,   quantity: 8,     unit: 'g'     },
        { stockItemId: S['ING-SALT-FN'].id,  quantity: 2,     unit: 'g'     },
      ]},
    }}),
  ])
  console.log('✅  Recipes: 5')

  // ─── Chart of Accounts ────────────────────────────────────────────────────────
  await Promise.all([
    db.financeAccount.create({ data: { code: '1001', name: 'Cash on Hand',        type: 'ASSET',     description: 'Physical cash in the business',             isSystem: true, sortOrder: 10 } }),
    db.financeAccount.create({ data: { code: '1010', name: 'Bank Account',         type: 'ASSET',     description: 'Business bank account balance',             isSystem: true, sortOrder: 11 } }),
    db.financeAccount.create({ data: { code: '1100', name: 'Accounts Receivable',  type: 'ASSET',     description: 'Money owed to the business by customers',   isSystem: true, sortOrder: 20 } }),
    db.financeAccount.create({ data: { code: '2001', name: 'Accounts Payable',     type: 'LIABILITY', description: 'Money owed to suppliers',                   isSystem: true, sortOrder: 10 } }),
    db.financeAccount.create({ data: { code: '2100', name: 'VAT Payable',          type: 'LIABILITY', description: 'VAT collected but not yet paid to SARS',    isSystem: true, sortOrder: 20 } }),
    db.financeAccount.create({ data: { code: '2200', name: 'Owner Loan',           type: 'LIABILITY', description: 'Funds loaned into the business by owner',   isSystem: true, sortOrder: 30 } }),
    db.financeAccount.create({ data: { code: '3001', name: "Owner's Equity",       type: 'EQUITY',    description: "Owner's investment in the business",        isSystem: true, sortOrder: 10 } }),
    db.financeAccount.create({ data: { code: '3100', name: 'Retained Earnings',    type: 'EQUITY',    description: 'Accumulated profits left in the business',  isSystem: true, sortOrder: 20 } }),
    db.financeAccount.create({ data: { code: '4001', name: 'Product Sales',        type: 'INCOME',    description: 'Revenue from selling baked goods',          isSystem: true, sortOrder: 10 } }),
    db.financeAccount.create({ data: { code: '4002', name: 'Delivery Income',      type: 'INCOME',    description: 'Income earned from delivery fees',          isSystem: true, sortOrder: 20 } }),
    db.financeAccount.create({ data: { code: '4099', name: 'Other Income',         type: 'INCOME',    description: 'Any other miscellaneous income',            isSystem: true, sortOrder: 99 } }),
    db.financeAccount.create({ data: { code: '5001', name: 'Ingredients',          type: 'EXPENSE',   description: 'Raw ingredients used in production',        isSystem: true, sortOrder: 10 } }),
    db.financeAccount.create({ data: { code: '5002', name: 'Packaging',            type: 'EXPENSE',   description: 'Boxes, bags, ribbons, and other packaging', isSystem: true, sortOrder: 20 } }),
    db.financeAccount.create({ data: { code: '5003', name: 'Transport & Delivery', type: 'EXPENSE',   description: 'Fuel, courier, and delivery costs',         isSystem: true, sortOrder: 30 } }),
    db.financeAccount.create({ data: { code: '5004', name: 'Staff Wages',          type: 'EXPENSE',   description: 'Salaries and wages paid to staff',          isSystem: true, sortOrder: 40 } }),
    db.financeAccount.create({ data: { code: '5005', name: 'Rent & Premises',      type: 'EXPENSE',   description: 'Rent, rates, and premises costs',           isSystem: true, sortOrder: 50 } }),
    db.financeAccount.create({ data: { code: '5006', name: 'Marketing',            type: 'EXPENSE',   description: 'Advertising, social media, promotions',     isSystem: true, sortOrder: 60 } }),
    db.financeAccount.create({ data: { code: '5007', name: 'Utilities',            type: 'EXPENSE',   description: 'Electricity, water, internet, phone',       isSystem: true, sortOrder: 70 } }),
    db.financeAccount.create({ data: { code: '5008', name: 'Equipment & Supplies', type: 'EXPENSE',   description: 'Kitchen equipment, tools, small items',     isSystem: true, sortOrder: 80 } }),
    db.financeAccount.create({ data: { code: '5009', name: 'Bank Charges',         type: 'EXPENSE',   description: 'Bank fees and transaction charges',         isSystem: true, sortOrder: 85 } }),
    db.financeAccount.create({ data: { code: '5099', name: 'Other Expenses',       type: 'EXPENSE',   description: 'Miscellaneous expenses',                    isSystem: true, sortOrder: 99 } }),
  ])
  console.log('✅  Chart of Accounts: 21 accounts')

  console.log('\n🎉  Seed complete!')
  console.log('─────────────────────────────────────────')
  console.log('Admin:       admin@tlakatreats.co.za  /  Admin@12345')
  console.log('Customer:    nomsa.dlamini@gmail.com  /  Customer@123')
  console.log('Ambassador:  zanele.khumalo@gmail.com /  Ambassador@123')
  console.log('─────────────────────────────────────────')
}

main()
  .catch((e) => { console.error('❌  Seed failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
