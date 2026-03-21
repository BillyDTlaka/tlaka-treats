import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const db = prisma as any

function ago(days: number, hour = 10, minute = 0): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(hour, minute, 0, 0)
  return d
}

async function main() {
  console.log('🌱 Seeding database…')

  // ── Clean slate ─────────────────────────────────────────────────────────────
  await prisma.$executeRawUnsafe(`
    DO $$ DECLARE r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'TRUNCATE TABLE "' || r.tablename || '" CASCADE';
      END LOOP;
    END $$;
  `)
  console.log('🧹  Cleaned')

  // ── UOM ─────────────────────────────────────────────────────────────────────
  const [uomKg, uomG, uomMl, uomL, uomUnit, uomPack, uomM] = await Promise.all([
    db.unitOfMeasure.create({ data: { name: 'Kilogram',  abbreviation: 'kg',   type: 'WEIGHT' } }),
    db.unitOfMeasure.create({ data: { name: 'Gram',      abbreviation: 'g',    type: 'WEIGHT' } }),
    db.unitOfMeasure.create({ data: { name: 'Millilitre',abbreviation: 'ml',   type: 'VOLUME' } }),
    db.unitOfMeasure.create({ data: { name: 'Litre',     abbreviation: 'l',    type: 'VOLUME' } }),
    db.unitOfMeasure.create({ data: { name: 'Unit',      abbreviation: 'unit', type: 'COUNT'  } }),
    db.unitOfMeasure.create({ data: { name: 'Pack',      abbreviation: 'pack', type: 'COUNT'  } }),
    db.unitOfMeasure.create({ data: { name: 'Metre',     abbreviation: 'm',    type: 'LENGTH' } }),
  ])
  console.log('✅  UOM: 7')

  // ── Roles & Permissions ─────────────────────────────────────────────────────
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
        { action: 'manage', subject: 'employee' },
      ]},
    },
  })
  const ambassadorRole = await prisma.role.create({
    data: {
      name: 'AMBASSADOR', description: 'Sources customers, earns commissions',
      permissions: { create: [
        { action: 'read',   subject: 'product' },
        { action: 'read',   subject: 'order' },
        { action: 'read',   subject: 'commission' },
      ]},
    },
  })
  const customerRole = await prisma.role.create({
    data: {
      name: 'CUSTOMER', description: 'Places orders',
      permissions: { create: [
        { action: 'read',   subject: 'product' },
        { action: 'create', subject: 'order' },
        { action: 'read',   subject: 'order' },
      ]},
    },
  })
  console.log('✅  Roles: 3')

  // ── Admin ────────────────────────────────────────────────────────────────────
  const adminPw = await bcrypt.hash('Admin@12345', 12)
  const admin = await prisma.user.create({
    data: {
      email: 'admin@tlakatreats.co.za', firstName: 'Billy', lastName: 'Tlaka',
      passwordHash: adminPw,
      roles: { create: { roleId: adminRole.id } },
    },
  })

  // ── Customers ────────────────────────────────────────────────────────────────
  const custPw = await bcrypt.hash('Customer@123', 12)
  const mkCust = (email: string, fn: string, ln: string, phone: string) =>
    prisma.user.create({ data: { email, firstName: fn, lastName: ln, phone, passwordHash: custPw, roles: { create: { roleId: customerRole.id } } } })

  const [nomsa, thabo, priya, lisa, sipho, aisha, kefilwe, rethabile, lungelo, zodwa] = await Promise.all([
    mkCust('nomsa.dlamini@gmail.com',    'Nomsa',     'Dlamini',   '0821234567'),
    mkCust('thabo.mokoena@gmail.com',    'Thabo',     'Mokoena',   '0839876543'),
    mkCust('priya.naidoo@outlook.com',   'Priya',     'Naidoo',    '0764455667'),
    mkCust('lisa.van.wyk@webmail.co.za', 'Lisa',      'Van Wyk',   '0711223344'),
    mkCust('sipho.ndlovu@gmail.com',     'Sipho',     'Ndlovu',    '0792223344'),
    mkCust('aisha.patel@icloud.com',     'Aisha',     'Patel',     '0861234321'),
    mkCust('kefilwe.sithole@gmail.com',  'Kefilwe',   'Sithole',   '0734443322'),
    mkCust('rethabile.mosia@gmail.com',  'Rethabile', 'Mosia',     '0823334455'),
    mkCust('lungelo.dube@gmail.com',     'Lungelo',   'Dube',      '0815556677'),
    mkCust('zodwa.cele@gmail.com',       'Zodwa',     'Cele',      '0796667788'),
  ])
  console.log('✅  Customers: 10')

  // ── Addresses ────────────────────────────────────────────────────────────────
  await Promise.all([
    prisma.address.create({ data: { userId: nomsa.id,     label: 'Home', street: '14 Jacaranda St', suburb: 'Naturena',   city: 'Johannesburg', province: 'Gauteng', postalCode: '1835', isDefault: true } }),
    prisma.address.create({ data: { userId: thabo.id,     label: 'Home', street: '7 Acacia Ave',    suburb: 'Soweto',     city: 'Johannesburg', province: 'Gauteng', postalCode: '1804', isDefault: true } }),
    prisma.address.create({ data: { userId: priya.id,     label: 'Home', street: '22 Palm Rd',      suburb: 'Lenasia',    city: 'Johannesburg', province: 'Gauteng', postalCode: '1820', isDefault: true } }),
    prisma.address.create({ data: { userId: lisa.id,      label: 'Home', street: '5 Berg St',       suburb: 'Randburg',   city: 'Johannesburg', province: 'Gauteng', postalCode: '2194', isDefault: true } }),
    prisma.address.create({ data: { userId: sipho.id,     label: 'Home', street: '33 Oak Rd',       suburb: 'Tembisa',    city: 'Ekurhuleni',   province: 'Gauteng', postalCode: '1632', isDefault: true } }),
    prisma.address.create({ data: { userId: aisha.id,     label: 'Home', street: '88 Lotus Rd',     suburb: 'Laudium',    city: 'Pretoria',     province: 'Gauteng', postalCode: '0037', isDefault: true } }),
    prisma.address.create({ data: { userId: kefilwe.id,   label: 'Home', street: '3 Khumalo St',    suburb: 'Diepkloof',  city: 'Johannesburg', province: 'Gauteng', postalCode: '1864', isDefault: true } }),
    prisma.address.create({ data: { userId: rethabile.id, label: 'Home', street: '19 Piet Retief',  suburb: 'Vosloorus',  city: 'Ekurhuleni',   province: 'Gauteng', postalCode: '1475', isDefault: true } }),
    prisma.address.create({ data: { userId: lungelo.id,   label: 'Home', street: '8 Ndlovu Cres',   suburb: 'Ivory Park', city: 'Midrand',      province: 'Gauteng', postalCode: '1685', isDefault: true } }),
    prisma.address.create({ data: { userId: zodwa.id,     label: 'Home', street: '45 Bhekani St',   suburb: 'KwaMashu',   city: 'Durban',       province: 'KwaZulu-Natal', postalCode: '4360', isDefault: true } }),
  ])

  // ── Ambassadors ──────────────────────────────────────────────────────────────
  const ambPw = await bcrypt.hash('Ambassador@123', 12)
  const mkAmb = (email: string, fn: string, ln: string, phone: string) =>
    prisma.user.create({ data: { email, firstName: fn, lastName: ln, phone, passwordHash: ambPw, roles: { create: [{ roleId: customerRole.id }, { roleId: ambassadorRole.id }] } } })

  const [ambU1, ambU2, ambU3, ambU4] = await Promise.all([
    mkAmb('zanele.khumalo@gmail.com',   'Zanele',   'Khumalo',  '0835559988'),
    mkAmb('michael.ferreira@gmail.com', 'Michael',  'Ferreira', '0724448899'),
    mkAmb('sibusiso.zulu@gmail.com',    'Sibusiso', 'Zulu',     '0612227788'),
    mkAmb('faith.mthembu@gmail.com',    'Faith',    'Mthembu',  '0731114455'),
  ])
  const [amb1, amb2, amb3, amb4] = await Promise.all([
    db.ambassador.create({ data: { userId: ambU1.id, code: 'TT-ZANE7823', commissionRate: 0.12, status: 'ACTIVE', bio: 'Passionate foodie and mom of 3. Based in Soweto.' } }),
    db.ambassador.create({ data: { userId: ambU2.id, code: 'TT-MICH4419', commissionRate: 0.10, status: 'ACTIVE', bio: 'Gym trainer promoting quality baked goods in Randburg.' } }),
    db.ambassador.create({ data: { userId: ambU3.id, code: 'TT-SIBU0312', commissionRate: 0.10, status: 'ACTIVE', bio: 'Community leader in Soweto.' } }),
    db.ambassador.create({ data: { userId: ambU4.id, code: 'TT-FAIT9901', commissionRate: 0.10, status: 'ACTIVE', bio: 'PTA-based. Strong church community reach.' } }),
  ])
  console.log('✅  Ambassadors: 4')

  // ── Categories ───────────────────────────────────────────────────────────────
  const [catBiscuits, catScones, catCakes, catBread] = await Promise.all([
    prisma.category.create({ data: { name: 'Biscuits & Cookies', description: 'Freshly baked biscuits and cookies' } }),
    prisma.category.create({ data: { name: 'Scones',             description: 'Light and fluffy scones' } }),
    prisma.category.create({ data: { name: 'Cakes',              description: 'Decadent home-style cakes' } }),
    prisma.category.create({ data: { name: 'Breads',             description: 'Artisan breads baked fresh daily' } }),
  ])

  // ── Suppliers ────────────────────────────────────────────────────────────────
  const [flourMills, capeDairy, bakeryPack, chocWorld] = await Promise.all([
    db.supplier.create({ data: { name: 'SA Flour Mills',      contactName: 'Johan Pretorius', phone: '0113456789', email: 'orders@saflour.co.za',  city: 'Johannesburg', notes: 'Main flour and sugar supplier. Min order R500.', status: 'ACTIVE' } }),
    db.supplier.create({ data: { name: 'Cape Dairy Co',       contactName: 'Anele Botha',     phone: '0219876543', email: 'supply@capedairy.co.za', city: 'Cape Town',    notes: 'Fresh dairy. Weekly delivery. Keep refrigerated.',    status: 'ACTIVE' } }),
    db.supplier.create({ data: { name: 'Bakery Packaging SA', contactName: 'Ravi Nair',       phone: '0317654321', email: 'sales@bakpacksa.co.za',  city: 'Durban',       notes: 'All packaging. 3-5 biz day lead time.',               status: 'ACTIVE' } }),
    db.supplier.create({ data: { name: 'Choc World Imports',  contactName: 'Maria Santos',    phone: '0114445566', email: 'orders@chocworld.co.za', city: 'Johannesburg', notes: 'Premium Belgian and local chocolate.',                 status: 'ACTIVE' } }),
  ])
  console.log('✅  Suppliers: 4')

  // ── Sellable Products ─────────────────────────────────────────────────────────
  const [pChocBisc, pScones, pChocCake, pSourdough, pLemonCake, pShortbread] = await Promise.all([
    prisma.product.create({ data: {
      name: 'Choc Chip Biscuits', categoryId: catBiscuits.id, uomId: uomPack.id,
      description: 'Classic chocolate chip biscuits — soft in the middle, golden on the outside.',
      variants: { create: [
        { name: '12 Pack', prices: { create: [{ tier: 'RETAIL', price: 55 }, { tier: 'AMBASSADOR', price: 48 }, { tier: 'WHOLESALE', price: 40 }] } },
        { name: '24 Pack', prices: { create: [{ tier: 'RETAIL', price: 99 }, { tier: 'AMBASSADOR', price: 88 }, { tier: 'WHOLESALE', price: 72 }] } },
      ]},
    }}),
    prisma.product.create({ data: {
      name: 'Classic Vanilla Scones', categoryId: catScones.id, uomId: uomPack.id,
      description: 'Light, fluffy scones made with fresh cream and a hint of vanilla.',
      variants: { create: [
        { name: '6 Pack',  prices: { create: [{ tier: 'RETAIL', price: 65  }, { tier: 'AMBASSADOR', price: 58  }, { tier: 'WHOLESALE', price: 50  }] } },
        { name: '12 Pack', prices: { create: [{ tier: 'RETAIL', price: 120 }, { tier: 'AMBASSADOR', price: 108 }, { tier: 'WHOLESALE', price: 90  }] } },
      ]},
    }}),
    prisma.product.create({ data: {
      name: 'Chocolate Fudge Cake', categoryId: catCakes.id, uomId: uomUnit.id,
      description: 'Rich, moist chocolate fudge cake smothered in a velvety chocolate ganache.',
      variants: { create: [
        { name: 'Whole Cake (8")', prices: { create: [{ tier: 'RETAIL', price: 280 }, { tier: 'AMBASSADOR', price: 252 }, { tier: 'WHOLESALE', price: 220 }] } },
        { name: 'Half Cake',       prices: { create: [{ tier: 'RETAIL', price: 150 }, { tier: 'AMBASSADOR', price: 135 }, { tier: 'WHOLESALE', price: 120 }] } },
      ]},
    }}),
    prisma.product.create({ data: {
      name: 'Sourdough Loaf', categoryId: catBread.id, uomId: uomUnit.id,
      description: 'Slow-fermented sourdough with a crispy crust and chewy crumb.',
      variants: { create: [
        { name: 'Standard Loaf', prices: { create: [{ tier: 'RETAIL', price: 75 }, { tier: 'AMBASSADOR', price: 68 }, { tier: 'WHOLESALE', price: 55 }] } },
      ]},
    }}),
    prisma.product.create({ data: {
      name: 'Lemon Poppy Seed Cake', categoryId: catCakes.id, uomId: uomUnit.id,
      description: 'Zesty lemon drizzle cake dotted with poppy seeds, topped with a lemon glaze.',
      variants: { create: [
        { name: 'Whole Cake (8")', prices: { create: [{ tier: 'RETAIL', price: 260 }, { tier: 'AMBASSADOR', price: 234 }, { tier: 'WHOLESALE', price: 200 }] } },
        { name: 'Half Cake',       prices: { create: [{ tier: 'RETAIL', price: 140 }, { tier: 'AMBASSADOR', price: 126 }, { tier: 'WHOLESALE', price: 110 }] } },
      ]},
    }}),
    prisma.product.create({ data: {
      name: 'Rooibos Shortbread', categoryId: catBiscuits.id, uomId: uomPack.id,
      description: 'Melt-in-your-mouth shortbread infused with South African rooibos tea.',
      variants: { create: [
        { name: '12 Pack', prices: { create: [{ tier: 'RETAIL', price: 60  }, { tier: 'AMBASSADOR', price: 52 }, { tier: 'WHOLESALE', price: 44 }] } },
        { name: '24 Pack', prices: { create: [{ tier: 'RETAIL', price: 110 }, { tier: 'AMBASSADOR', price: 96 }, { tier: 'WHOLESALE', price: 80 }] } },
      ]},
    }}),
  ])
  console.log('✅  Sellable products: 6')

  // ── Ingredient + Packaging Products + Stock Items ─────────────────────────────
  const ingDefs = [
    { name: 'All-Purpose Flour',      sup: flourMills.id, sku: 'ING-FLOUR-AP', uom: uomKg.id,   stock: 25.0, min: 10.0, cost: 14.50 },
    { name: 'Cake Flour',             sup: flourMills.id, sku: 'ING-FLOUR-CK', uom: uomKg.id,   stock: 18.5, min:  8.0, cost: 16.00 },
    { name: 'Caster Sugar',           sup: flourMills.id, sku: 'ING-SUGAR-CS', uom: uomKg.id,   stock: 12.0, min:  5.0, cost: 18.00 },
    { name: 'Brown Sugar',            sup: flourMills.id, sku: 'ING-SUGAR-BR', uom: uomKg.id,   stock:  4.5, min:  5.0, cost: 17.00, notes: 'Below minimum — reorder required' },
    { name: 'Unsalted Butter',        sup: capeDairy.id,  sku: 'ING-BUTT-UN',  uom: uomKg.id,   stock:  8.2, min:  4.0, cost: 95.00 },
    { name: 'Large Eggs',             sup: capeDairy.id,  sku: 'ING-EGGS-LG',  uom: uomUnit.id, stock: 120,  min: 48,   cost:  5.50 },
    { name: 'Fresh Cream',            sup: capeDairy.id,  sku: 'ING-CREM-FR',  uom: uomMl.id,   stock: 3500, min: 2000, cost:  0.048 },
    { name: 'Full Cream Milk',        sup: capeDairy.id,  sku: 'ING-MILK-FC',  uom: uomMl.id,   stock: 5000, min: 2000, cost:  0.018 },
    { name: 'Baking Powder',          sup: null,          sku: 'ING-BAKPOW',   uom: uomG.id,    stock:  800, min:  300, cost:  0.085 },
    { name: 'Bicarbonate of Soda',    sup: null,          sku: 'ING-BICARB',   uom: uomG.id,    stock:  600, min:  200, cost:  0.065 },
    { name: 'Vanilla Essence',        sup: null,          sku: 'ING-VAN-ES',   uom: uomMl.id,   stock:  350, min:  100, cost:  0.52  },
    { name: 'Fine Salt',              sup: null,          sku: 'ING-SALT-FN',  uom: uomG.id,    stock: 2000, min:  500, cost:  0.009 },
    { name: 'Chocolate Chips (dark)', sup: chocWorld.id,  sku: 'ING-CHOC-DK',  uom: uomG.id,    stock: 3200, min: 1000, cost:  0.12  },
    { name: 'Cocoa Powder (Dutch)',   sup: chocWorld.id,  sku: 'ING-COCO-PW',  uom: uomG.id,    stock:    0, min:  500, cost:  0.095, notes: 'OUT OF STOCK — urgent reorder' },
    { name: 'Dark Chocolate (block)', sup: chocWorld.id,  sku: 'ING-CHOC-BK',  uom: uomG.id,    stock: 1500, min:  500, cost:  0.14  },
    { name: 'Loose Leaf Rooibos',     sup: null,          sku: 'ING-ROOI-LL',  uom: uomG.id,    stock:  400, min:  150, cost:  0.18  },
  ]
  const pkgDefs = [
    { name: 'Biscuit Box (12-pack)', sup: bakeryPack.id, sku: 'PKG-BOX-12',  uom: uomUnit.id, stock:  85, min:  30, cost: 5.50 },
    { name: 'Biscuit Box (24-pack)', sup: bakeryPack.id, sku: 'PKG-BOX-24',  uom: uomUnit.id, stock:  40, min:  20, cost: 7.50 },
    { name: 'Scone Box (6-pack)',    sup: bakeryPack.id, sku: 'PKG-BOX-06',  uom: uomUnit.id, stock:  60, min:  24, cost: 4.80 },
    { name: 'Cake Tin Liner',        sup: bakeryPack.id, sku: 'PKG-CAKE-LN', uom: uomUnit.id, stock:  50, min:  20, cost: 1.20 },
    { name: 'Cellophane Bags',       sup: bakeryPack.id, sku: 'PKG-CELLO',   uom: uomUnit.id, stock: 200, min: 100, cost: 0.90 },
    { name: 'Tlaka Treats Labels',   sup: bakeryPack.id, sku: 'PKG-LABEL',   uom: uomUnit.id, stock: 500, min: 150, cost: 0.45, notes: '2-week lead time for custom print.' },
    { name: 'Raffia Twine',          sup: bakeryPack.id, sku: 'PKG-TWINE',   uom: uomM.id,    stock:  80, min:  20, cost: 0.35 },
  ]

  const siMap: Record<string, any> = {}
  for (const d of [...ingDefs, ...pkgDefs]) {
    const classification = d.sku.startsWith('ING') ? 'INGREDIENT' : 'PACKAGING'
    const prod = await db.product.create({ data: { name: d.name, classification, supplierId: d.sup ?? null } })
    const si = await db.stockItem.create({ data: {
      productId: prod.id, name: d.name, sku: d.sku, uomId: d.uom,
      currentStock: d.stock, minStockLevel: d.min, costPerUnit: d.cost,
      notes: (d as any).notes ?? null,
    }})
    siMap[d.sku] = si
  }
  console.log('✅  Stock items: 23')

  // ── Recipes ──────────────────────────────────────────────────────────────────
  const [recChocBisc, recScones, recChocCake, recShortbread, recLemonCake] = await Promise.all([
    db.recipe.create({ data: {
      name: 'Choc Chip Biscuits (Classic)', yieldQty: 24, yieldUnit: 'biscuits', yieldPerBatch: 2,
      notes: 'Makes 24 biscuits (2 x 12-packs). Bake 180°C for 12-14 min.',
      outputProductId: pChocBisc.id,
      ingredients: { create: [
        { stockItemId: siMap['ING-FLOUR-AP'].id, quantity: 0.250, uomId: uomKg.id   },
        { stockItemId: siMap['ING-BUTT-UN'].id,  quantity: 0.150, uomId: uomKg.id   },
        { stockItemId: siMap['ING-SUGAR-CS'].id, quantity: 0.100, uomId: uomKg.id   },
        { stockItemId: siMap['ING-SUGAR-BR'].id, quantity: 0.080, uomId: uomKg.id   },
        { stockItemId: siMap['ING-CHOC-DK'].id,  quantity: 200,   uomId: uomG.id    },
        { stockItemId: siMap['ING-EGGS-LG'].id,  quantity: 2,     uomId: uomUnit.id },
        { stockItemId: siMap['ING-VAN-ES'].id,   quantity: 5,     uomId: uomMl.id   },
        { stockItemId: siMap['ING-BAKPOW'].id,   quantity: 5,     uomId: uomG.id    },
        { stockItemId: siMap['ING-SALT-FN'].id,  quantity: 3,     uomId: uomG.id    },
      ]},
    }}),
    db.recipe.create({ data: {
      name: 'Classic Cream Scones', yieldQty: 8, yieldUnit: 'scones', yieldPerBatch: 1,
      notes: "Don't overwork dough. Bake 220°C for 12-15 min.",
      outputProductId: pScones.id,
      ingredients: { create: [
        { stockItemId: siMap['ING-FLOUR-CK'].id, quantity: 0.500, uomId: uomKg.id   },
        { stockItemId: siMap['ING-BAKPOW'].id,   quantity: 20,    uomId: uomG.id    },
        { stockItemId: siMap['ING-BUTT-UN'].id,  quantity: 0.080, uomId: uomKg.id   },
        { stockItemId: siMap['ING-SUGAR-CS'].id, quantity: 0.050, uomId: uomKg.id   },
        { stockItemId: siMap['ING-CREM-FR'].id,  quantity: 200,   uomId: uomMl.id   },
        { stockItemId: siMap['ING-EGGS-LG'].id,  quantity: 1,     uomId: uomUnit.id },
        { stockItemId: siMap['ING-SALT-FN'].id,  quantity: 3,     uomId: uomG.id    },
      ]},
    }}),
    db.recipe.create({ data: {
      name: 'Chocolate Fudge Cake', yieldQty: 1, yieldUnit: 'cake', yieldPerBatch: 1,
      notes: 'Bake 180°C for 30-35 min. Ganache when fully cooled.',
      outputProductId: pChocCake.id,
      ingredients: { create: [
        { stockItemId: siMap['ING-FLOUR-CK'].id, quantity: 0.300, uomId: uomKg.id   },
        { stockItemId: siMap['ING-COCO-PW'].id,  quantity: 60,    uomId: uomG.id    },
        { stockItemId: siMap['ING-SUGAR-CS'].id, quantity: 0.300, uomId: uomKg.id   },
        { stockItemId: siMap['ING-BUTT-UN'].id,  quantity: 0.200, uomId: uomKg.id   },
        { stockItemId: siMap['ING-EGGS-LG'].id,  quantity: 4,     uomId: uomUnit.id },
        { stockItemId: siMap['ING-MILK-FC'].id,  quantity: 240,   uomId: uomMl.id   },
        { stockItemId: siMap['ING-VAN-ES'].id,   quantity: 10,    uomId: uomMl.id   },
        { stockItemId: siMap['ING-BAKPOW'].id,   quantity: 10,    uomId: uomG.id    },
        { stockItemId: siMap['ING-BICARB'].id,   quantity: 5,     uomId: uomG.id    },
        { stockItemId: siMap['ING-SALT-FN'].id,  quantity: 3,     uomId: uomG.id    },
        { stockItemId: siMap['ING-CHOC-BK'].id,  quantity: 250,   uomId: uomG.id    },
      ]},
    }}),
    db.recipe.create({ data: {
      name: 'Rooibos Shortbread', yieldQty: 20, yieldUnit: 'pieces', yieldPerBatch: 1,
      notes: 'Bake 160°C for 18-20 min. Should be pale gold, not browned.',
      outputProductId: pShortbread.id,
      ingredients: { create: [
        { stockItemId: siMap['ING-FLOUR-AP'].id, quantity: 0.300, uomId: uomKg.id },
        { stockItemId: siMap['ING-BUTT-UN'].id,  quantity: 0.200, uomId: uomKg.id },
        { stockItemId: siMap['ING-SUGAR-BR'].id, quantity: 0.100, uomId: uomKg.id },
        { stockItemId: siMap['ING-ROOI-LL'].id,  quantity: 8,     uomId: uomG.id  },
        { stockItemId: siMap['ING-SALT-FN'].id,  quantity: 2,     uomId: uomG.id  },
      ]},
    }}),
    db.recipe.create({ data: {
      name: 'Lemon Poppy Seed Cake', yieldQty: 1, yieldUnit: 'cake', yieldPerBatch: 1,
      notes: 'Bake 175°C for 40 min. Add lemon glaze while still warm.',
      outputProductId: pLemonCake.id,
      ingredients: { create: [
        { stockItemId: siMap['ING-FLOUR-CK'].id, quantity: 0.280, uomId: uomKg.id   },
        { stockItemId: siMap['ING-SUGAR-CS'].id, quantity: 0.250, uomId: uomKg.id   },
        { stockItemId: siMap['ING-BUTT-UN'].id,  quantity: 0.180, uomId: uomKg.id   },
        { stockItemId: siMap['ING-EGGS-LG'].id,  quantity: 3,     uomId: uomUnit.id },
        { stockItemId: siMap['ING-MILK-FC'].id,  quantity: 180,   uomId: uomMl.id   },
        { stockItemId: siMap['ING-BAKPOW'].id,   quantity: 8,     uomId: uomG.id    },
        { stockItemId: siMap['ING-SALT-FN'].id,  quantity: 2,     uomId: uomG.id    },
      ]},
    }}),
  ])
  console.log('✅  Recipes: 5')

  // ── Chart of Accounts ─────────────────────────────────────────────────────────
  const accounts = await Promise.all([
    db.financeAccount.create({ data: { code: '1001', name: 'Cash on Hand',        type: 'ASSET',     isSystem: true, sortOrder: 10 } }),
    db.financeAccount.create({ data: { code: '1010', name: 'Bank Account',         type: 'ASSET',     isSystem: true, sortOrder: 11 } }),
    db.financeAccount.create({ data: { code: '1100', name: 'Accounts Receivable',  type: 'ASSET',     isSystem: true, sortOrder: 20 } }),
    db.financeAccount.create({ data: { code: '2001', name: 'Accounts Payable',     type: 'LIABILITY', isSystem: true, sortOrder: 10 } }),
    db.financeAccount.create({ data: { code: '2200', name: 'Owner Loan',           type: 'LIABILITY', isSystem: true, sortOrder: 30 } }),
    db.financeAccount.create({ data: { code: '3001', name: "Owner's Equity",       type: 'EQUITY',    isSystem: true, sortOrder: 10 } }),
    db.financeAccount.create({ data: { code: '4001', name: 'Product Sales',        type: 'INCOME',    isSystem: true, sortOrder: 10 } }),
    db.financeAccount.create({ data: { code: '4002', name: 'Delivery Income',      type: 'INCOME',    isSystem: true, sortOrder: 20 } }),
    db.financeAccount.create({ data: { code: '5001', name: 'Ingredients',          type: 'EXPENSE',   isSystem: true, sortOrder: 10 } }),
    db.financeAccount.create({ data: { code: '5002', name: 'Packaging',            type: 'EXPENSE',   isSystem: true, sortOrder: 20 } }),
    db.financeAccount.create({ data: { code: '5003', name: 'Transport & Delivery', type: 'EXPENSE',   isSystem: true, sortOrder: 30 } }),
    db.financeAccount.create({ data: { code: '5004', name: 'Staff Wages',          type: 'EXPENSE',   isSystem: true, sortOrder: 40 } }),
    db.financeAccount.create({ data: { code: '5005', name: 'Rent & Premises',      type: 'EXPENSE',   isSystem: true, sortOrder: 50 } }),
    db.financeAccount.create({ data: { code: '5006', name: 'Marketing',            type: 'EXPENSE',   isSystem: true, sortOrder: 60 } }),
    db.financeAccount.create({ data: { code: '5007', name: 'Utilities',            type: 'EXPENSE',   isSystem: true, sortOrder: 70 } }),
    db.financeAccount.create({ data: { code: '5008', name: 'Equipment & Supplies', type: 'EXPENSE',   isSystem: true, sortOrder: 80 } }),
    db.financeAccount.create({ data: { code: '5009', name: 'Bank Charges',         type: 'EXPENSE',   isSystem: true, sortOrder: 85 } }),
    db.financeAccount.create({ data: { code: '5099', name: 'Other Expenses',       type: 'EXPENSE',   isSystem: true, sortOrder: 99 } }),
  ])
  const acct = (code: string) => accounts.find((a: any) => a.code === code)
  console.log('✅  Chart of accounts: 18')

  // ── Purchase Orders ───────────────────────────────────────────────────────────
  const poSpecs = [
    {
      sup: flourMills.id, daysAgo: 55, status: 'RECEIVED',
      items: [
        { sku: 'ING-FLOUR-AP', qty: 50, cost: 14.50 },
        { sku: 'ING-FLOUR-CK', qty: 30, cost: 16.00 },
        { sku: 'ING-SUGAR-CS', qty: 20, cost: 18.00 },
        { sku: 'ING-SUGAR-BR', qty: 15, cost: 17.00 },
      ],
    },
    {
      sup: capeDairy.id, daysAgo: 45, status: 'RECEIVED',
      items: [
        { sku: 'ING-BUTT-UN', qty: 20, cost: 95.00 },
        { sku: 'ING-EGGS-LG', qty: 240, cost: 5.50 },
        { sku: 'ING-CREM-FR', qty: 5000, cost: 0.048 },
        { sku: 'ING-MILK-FC', qty: 10000, cost: 0.018 },
      ],
    },
    {
      sup: bakeryPack.id, daysAgo: 40, status: 'RECEIVED',
      items: [
        { sku: 'PKG-BOX-12', qty: 200, cost: 5.50 },
        { sku: 'PKG-BOX-24', qty: 100, cost: 7.50 },
        { sku: 'PKG-BOX-06', qty: 150, cost: 4.80 },
        { sku: 'PKG-LABEL',  qty: 1000, cost: 0.45 },
      ],
    },
    {
      sup: chocWorld.id, daysAgo: 30, status: 'RECEIVED',
      items: [
        { sku: 'ING-CHOC-DK', qty: 5000, cost: 0.12 },
        { sku: 'ING-CHOC-BK', qty: 3000, cost: 0.14 },
      ],
    },
    {
      sup: flourMills.id, daysAgo: 5, status: 'ORDERED',
      items: [
        { sku: 'ING-FLOUR-AP', qty: 40, cost: 14.50 },
        { sku: 'ING-FLOUR-CK', qty: 25, cost: 16.00 },
        { sku: 'ING-SUGAR-CS', qty: 15, cost: 18.00 },
      ],
    },
  ]

  for (const po of poSpecs) {
    const total = po.items.reduce((s, i) => s + i.qty * i.cost, 0)
    const created = await db.purchaseOrder.create({
      data: {
        supplierId: po.sup,
        status: po.status,
        orderDate: ago(po.daysAgo),
        expectedDate: ago(po.daysAgo - 3),
        total,
        items: { create: po.items.map(i => ({
          stockItemId: siMap[i.sku].id,
          orderedQty: i.qty, receivedQty: po.status === 'RECEIVED' ? i.qty : 0,
          unitCost: i.cost, total: i.qty * i.cost,
        }))},
      },
    })
    if (po.status === 'RECEIVED') {
      for (const i of po.items) {
        await db.stockMovement.create({ data: {
          stockItemId: siMap[i.sku].id, type: 'PURCHASE',
          quantity: i.qty, unitCost: i.cost,
          reference: created.id, purchaseOrderId: created.id,
          note: 'Received via PO', createdAt: ago(po.daysAgo),
        }})
      }
      await db.financeTransaction.create({ data: {
        type: 'EXPENSE', category: 'Ingredients',
        amount: total, description: `Purchase — PO received`,
        reference: created.id, accountId: acct('5001')?.id,
        createdAt: ago(po.daysAgo),
      }})
    }
  }
  console.log('✅  Purchase orders: 5')

  // ── Production Runs ───────────────────────────────────────────────────────────
  const prodSpecs = [
    { rec: recChocBisc.id, batches: 4, daysAgo: 52, status: 'COMPLETED' },
    { rec: recScones.id,   batches: 3, daysAgo: 51, status: 'COMPLETED' },
    { rec: recChocBisc.id, batches: 5, daysAgo: 48, status: 'COMPLETED' },
    { rec: recShortbread.id, batches: 2, daysAgo: 46, status: 'COMPLETED' },
    { rec: recChocCake.id, batches: 2, daysAgo: 44, status: 'COMPLETED' },
    { rec: recChocBisc.id, batches: 4, daysAgo: 41, status: 'COMPLETED' },
    { rec: recScones.id,   batches: 4, daysAgo: 40, status: 'COMPLETED' },
    { rec: recLemonCake.id, batches: 1, daysAgo: 38, status: 'COMPLETED' },
    { rec: recChocBisc.id, batches: 6, daysAgo: 35, status: 'COMPLETED' },
    { rec: recShortbread.id, batches: 3, daysAgo: 33, status: 'COMPLETED' },
    { rec: recChocBisc.id, batches: 5, daysAgo: 28, status: 'COMPLETED' },
    { rec: recScones.id,   batches: 4, daysAgo: 27, status: 'COMPLETED' },
    { rec: recChocCake.id, batches: 2, daysAgo: 25, status: 'COMPLETED' },
    { rec: recChocBisc.id, batches: 6, daysAgo: 21, status: 'COMPLETED' },
    { rec: recScones.id,   batches: 3, daysAgo: 20, status: 'COMPLETED' },
    { rec: recShortbread.id, batches: 3, daysAgo: 18, status: 'COMPLETED' },
    { rec: recChocBisc.id, batches: 7, daysAgo: 14, status: 'COMPLETED' },
    { rec: recScones.id,   batches: 4, daysAgo: 13, status: 'COMPLETED' },
    { rec: recChocBisc.id, batches: 4, daysAgo: 7,  status: 'COMPLETED' },
    { rec: recShortbread.id, batches: 2, daysAgo: 6, status: 'COMPLETED' },
    { rec: recChocBisc.id, batches: 5, daysAgo: 3,  status: 'IN_PROGRESS' },
    { rec: recScones.id,   batches: 3, daysAgo: 2,  status: 'IN_PROGRESS' },
    { rec: recChocBisc.id, batches: 6, daysAgo: 1,  status: 'PLANNED' },
    { rec: recScones.id,   batches: 4, daysAgo: 0,  status: 'PLANNED' },
  ]

  for (const ps of prodSpecs) {
    const run = await db.productionRun.create({ data: {
      recipeId: ps.rec, batches: ps.batches, status: ps.status,
      plannedDate: ago(ps.daysAgo + 1),
      startedAt:   ps.status !== 'PLANNED'    ? ago(ps.daysAgo, 7) : null,
      completedAt: ps.status === 'COMPLETED'  ? ago(ps.daysAgo, 14) : null,
      createdAt: ago(ps.daysAgo + 1),
    }})
    if (ps.status === 'COMPLETED') {
      await db.packagingRun.create({ data: {
        productionRunId: run.id, status: 'COMPLETED',
        batchCount: ps.batches,
        completedAt: ago(ps.daysAgo, 15),
        createdAt: ago(ps.daysAgo, 14),
      }})
    }
  }
  console.log('✅  Production runs: 24 (20 completed, 2 in-progress, 2 planned)')

  // ── Variants lookup ───────────────────────────────────────────────────────────
  const allVariants = await db.productVariant.findMany({ include: { product: true, prices: true } })
  const V: Record<string, any> = {}
  for (const v of allVariants) V[`${v.product.name}|${v.name}`] = v

  const price = (v: any, tier: string) => Number(v.prices.find((p: any) => p.tier === tier)?.price || 0)

  // Helper: create one order
  let invoiceCounter = 1
  async function createOrder(spec: {
    custId: string; ambId: string | null; ambRecord: any | null; daysAgo: number; hour: number
    status: string; deliveryFee: number
    items: { vKey: string; tier: string; qty: number }[]
  }) {
    const itemRows = spec.items.map(i => {
      const v = V[i.vKey]
      const unitPrice = price(v, i.tier)
      return { variantId: v.id, quantity: i.qty, unitPrice, subtotal: unitPrice * i.qty }
    })
    const subtotal = itemRows.reduce((s, i) => s + i.subtotal, 0)
    const total = subtotal + spec.deliveryFee
    const createdAt = ago(spec.daysAgo, spec.hour)
    const invNum = `INV-${String(invoiceCounter++).padStart(4, '0')}`

    const order = await db.order.create({ data: {
      customerId:   spec.custId,
      ambassadorId: spec.ambRecord?.id ?? null,
      status:       spec.status,
      subtotal, deliveryFee: spec.deliveryFee, total,
      invoiceNumber: invNum, invoicedAt: createdAt,
      createdAt, updatedAt: createdAt,
      items: { create: itemRows },
    }})

    // Commission for ambassador orders
    if (spec.ambRecord && ['CONFIRMED','BAKING','READY','OUT_FOR_DELIVERY','DELIVERED'].includes(spec.status)) {
      await db.commission.create({ data: {
        orderId: order.id, ambassadorId: spec.ambRecord.id,
        amount: +(total * Number(spec.ambRecord.commissionRate)).toFixed(2),
        rate: spec.ambRecord.commissionRate,
        status: spec.status === 'DELIVERED' ? 'APPROVED' : 'PENDING',
        createdAt,
      }})
    }

    // Finance transaction for all confirmed+ orders
    if (['CONFIRMED','BAKING','READY','OUT_FOR_DELIVERY','DELIVERED'].includes(spec.status)) {
      await db.financeTransaction.create({ data: {
        type: 'INCOME', category: 'Product Sales',
        amount: total, description: `Sale — ${invNum}`,
        orderId: order.id, accountId: acct('4001')?.id,
        reference: order.id, createdAt,
      }})
    }

    return order
  }

  // ── Orders ────────────────────────────────────────────────────────────────────
  // Customers shorthand
  const C = { nomsa: nomsa.id, thabo: thabo.id, priya: priya.id, lisa: lisa.id, sipho: sipho.id, aisha: aisha.id, kefilwe: kefilwe.id, rethabile: rethabile.id, lungelo: lungelo.id, zodwa: zodwa.id }
  // Ambassador records (null = direct order)
  const A = { z: amb1, m: amb2, s: amb3, f: amb4, none: null }

  // ── PRIOR PERIOD: days 60–31 (lower volume, ~R14,500) ─────────────────────
  await createOrder({ custId: C.nomsa,     ambRecord: A.z,    ambId: amb1.id, daysAgo: 59, hour: 9,  status: 'DELIVERED', deliveryFee: 30, items: [{ vKey: 'Choc Chip Biscuits|12 Pack', tier: 'AMBASSADOR', qty: 2 }] })
  await createOrder({ custId: C.thabo,     ambRecord: A.none, ambId: null,    daysAgo: 58, hour: 11, status: 'DELIVERED', deliveryFee: 0,  items: [{ vKey: 'Classic Vanilla Scones|6 Pack', tier: 'RETAIL', qty: 1 }, { vKey: 'Rooibos Shortbread|12 Pack', tier: 'RETAIL', qty: 1 }] })
  await createOrder({ custId: C.priya,     ambRecord: A.z,    ambId: amb1.id, daysAgo: 56, hour: 15, status: 'DELIVERED', deliveryFee: 30, items: [{ vKey: 'Classic Vanilla Scones|12 Pack', tier: 'AMBASSADOR', qty: 1 }] })
  await createOrder({ custId: C.lisa,      ambRecord: A.none, ambId: null,    daysAgo: 55, hour: 10, status: 'DELIVERED', deliveryFee: 0,  items: [{ vKey: 'Choc Chip Biscuits|24 Pack', tier: 'RETAIL', qty: 1 }] })
  await createOrder({ custId: C.sipho,     ambRecord: A.m,    ambId: amb2.id, daysAgo: 54, hour: 14, status: 'DELIVERED', deliveryFee: 30, items: [{ vKey: 'Choc Chip Biscuits|12 Pack', tier: 'AMBASSADOR', qty: 3 }] })
  await createOrder({ custId: C.aisha,     ambRecord: A.none, ambId: null,    daysAgo: 53, hour: 9,  status: 'DELIVERED', deliveryFee: 30, items: [{ vKey: 'Sourdough Loaf|Standard Loaf', tier: 'RETAIL', qty: 1 }] })
  await createOrder({ custId: C.kefilwe,   ambRecord: A.z,    ambId: amb1.id, daysAgo: 52, hour: 16, status: 'DELIVERED', deliveryFee: 0,  items: [{ vKey: 'Choc Chip Biscuits|12 Pack', tier: 'AMBASSADOR', qty: 2 }, { vKey: 'Classic Vanilla Scones|6 Pack', tier: 'AMBASSADOR', qty: 1 }] })
  await createOrder({ custId: C.rethabile, ambRecord: A.z,    ambId: amb1.id, daysAgo: 52, hour: 17, status: 'DELIVERED', deliveryFee: 30, items: [{ vKey: 'Rooibos Shortbread|12 Pack', tier: 'AMBASSADOR', qty: 2 }] })
  await createOrder({ custId: C.nomsa,     ambRecord: A.none, ambId: null,    daysAgo: 51, hour: 11, status: 'DELIVERED', deliveryFee: 0,  items: [{ vKey: 'Choc Chip Biscuits|24 Pack', tier: 'RETAIL', qty: 1 }] })
  await createOrder({ custId: C.thabo,     ambRecord: A.s,    ambId: amb3.id, daysAgo: 50, hour: 10, status: 'DELIVERED', deliveryFee: 30, items: [{ vKey: 'Choc Chip Biscuits|12 Pack', tier: 'AMBASSADOR', qty: 2 }] })
  await createOrder({ custId: C.aisha,     ambRecord: A.none, ambId: null,    daysAgo: 49, hour: 14, status: 'DELIVERED', deliveryFee: 0,  items: [{ vKey: 'Lemon Poppy Seed Cake|Whole Cake (8")', tier: 'RETAIL', qty: 1 }] })
  await createOrder({ custId: C.priya,     ambRecord: A.z,    ambId: amb1.id, daysAgo: 48, hour: 15, status: 'DELIVERED', deliveryFee: 0,  items: [{ vKey: 'Classic Vanilla Scones|6 Pack', tier: 'AMBASSADOR', qty: 3 }] })
  await createOrder({ custId: C.lungelo,   ambRecord: A.m,    ambId: amb2.id, daysAgo: 47, hour: 10, status: 'DELIVERED', deliveryFee: 30, items: [{ vKey: 'Choc Chip Biscuits|12 Pack', tier: 'AMBASSADOR', qty: 2 }] })
  await createOrder({ custId: C.lisa,      ambRecord: A.z,    ambId: amb1.id, daysAgo: 45, hour: 16, status: 'DELIVERED', deliveryFee: 0,  items: [{ vKey: 'Choc Chip Biscuits|24 Pack', tier: 'AMBASSADOR', qty: 1 }, { vKey: 'Classic Vanilla Scones|12 Pack', tier: 'AMBASSADOR', qty: 1 }] })
  await createOrder({ custId: C.zodwa,     ambRecord: A.s,    ambId: amb3.id, daysAgo: 45, hour: 17, status: 'DELIVERED', deliveryFee: 30, items: [{ vKey: 'Rooibos Shortbread|12 Pack', tier: 'AMBASSADOR', qty: 2 }] })
  await createOrder({ custId: C.sipho,     ambRecord: A.none, ambId: null,    daysAgo: 44, hour: 11, status: 'DELIVERED', deliveryFee: 0,  items: [{ vKey: 'Choc Chip Biscuits|12 Pack', tier: 'RETAIL', qty: 1 }, { vKey: 'Sourdough Loaf|Standard Loaf', tier: 'RETAIL', qty: 1 }] })
  await createOrder({ custId: C.nomsa,     ambRecord: A.z,    ambId: amb1.id, daysAgo: 42, hour: 9,  status: 'DELIVERED', deliveryFee: 0,  items: [{ vKey: 'Choc Chip Biscuits|12 Pack', tier: 'AMBASSADOR', qty: 3 }, { vKey: 'Classic Vanilla Scones|6 Pack', tier: 'AMBASSADOR', qty: 2 }] })
  await createOrder({ custId: C.thabo,     ambRecord: A.none, ambId: null,    daysAgo: 41, hour: 15, status: 'DELIVERED', deliveryFee: 30, items: [{ vKey: 'Chocolate Fudge Cake|Whole Cake (8")', tier: 'RETAIL', qty: 1 }] })
  await createOrder({ custId: C.kefilwe,   ambRecord: A.m,    ambId: amb2.id, daysAgo: 40, hour: 16, status: 'DELIVERED', deliveryFee: 0,  items: [{ vKey: 'Choc Chip Biscuits|12 Pack', tier: 'AMBASSADOR', qty: 4 }] })
  await createOrder({ custId: C.rethabile, ambRecord: A.z,    ambId: amb1.id, daysAgo: 38, hour: 15, status: 'DELIVERED', deliveryFee: 30, items: [{ vKey: 'Rooibos Shortbread|24 Pack', tier: 'AMBASSADOR', qty: 1 }, { vKey: 'Classic Vanilla Scones|6 Pack', tier: 'AMBASSADOR', qty: 1 }] })
  await createOrder({ custId: C.priya,     ambRecord: A.s,    ambId: amb3.id, daysAgo: 38, hour: 17, status: 'DELIVERED', deliveryFee: 0,  items: [{ vKey: 'Choc Chip Biscuits|12 Pack', tier: 'AMBASSADOR', qty: 2 }] })
  await createOrder({ custId: C.aisha,     ambRecord: A.f,    ambId: amb4.id, daysAgo: 37, hour: 10, status: 'DELIVERED', deliveryFee: 30, items: [{ vKey: 'Classic Vanilla Scones|12 Pack', tier: 'AMBASSADOR', qty: 1 }, { vKey: 'Choc Chip Biscuits|12 Pack', tier: 'AMBASSADOR', qty: 1 }] })
  await createOrder({ custId: C.lungelo,   ambRecord: A.none, ambId: null,    daysAgo: 36, hour: 11, status: 'DELIVERED', deliveryFee: 0,  items: [{ vKey: 'Sourdough Loaf|Standard Loaf', tier: 'RETAIL', qty: 2 }] })
  await createOrder({ custId: C.zodwa,     ambRecord: A.z,    ambId: amb1.id, daysAgo: 35, hour: 14, status: 'DELIVERED', deliveryFee: 30, items: [{ vKey: 'Choc Chip Biscuits|24 Pack', tier: 'AMBASSADOR', qty: 1 }] })
  await createOrder({ custId: C.nomsa,     ambRecord: A.m,    ambId: amb2.id, daysAgo: 33, hour: 9,  status: 'DELIVERED', deliveryFee: 0,  items: [{ vKey: 'Classic Vanilla Scones|6 Pack', tier: 'AMBASSADOR', qty: 3 }] })

  console.log('✅  Prior-period orders: 25')

  // ── CURRENT PERIOD: days 30–1 (higher volume, ~R22,000) ──────────────────
  await createOrder({ custId: C.lisa,      ambRecord: A.z,    ambId: amb1.id, daysAgo: 30, hour: 16, status: 'DELIVERED', deliveryFee: 0,  items: [{ vKey: 'Choc Chip Biscuits|12 Pack', tier: 'AMBASSADOR', qty: 2 }, { vKey: 'Rooibos Shortbread|12 Pack', tier: 'AMBASSADOR', qty: 1 }] })
  await createOrder({ custId: C.sipho,     ambRecord: A.none, ambId: null,    daysAgo: 29, hour: 10, status: 'DELIVERED', deliveryFee: 30, items: [{ vKey: 'Choc Chip Biscuits|12 Pack', tier: 'RETAIL', qty: 1 }, { vKey: 'Classic Vanilla Scones|6 Pack', tier: 'RETAIL', qty: 1 }] })
  await createOrder({ custId: C.kefilwe,   ambRecord: A.z,    ambId: amb1.id, daysAgo: 28, hour: 15, status: 'DELIVERED', deliveryFee: 30, items: [{ vKey: 'Choc Chip Biscuits|24 Pack', tier: 'AMBASSADOR', qty: 1 }, { vKey: 'Classic Vanilla Scones|6 Pack', tier: 'AMBASSADOR', qty: 2 }] })
  await createOrder({ custId: C.rethabile, ambRecord: A.z,    ambId: amb1.id, daysAgo: 28, hour: 16, status: 'DELIVERED', deliveryFee: 0,  items: [{ vKey: 'Choc Chip Biscuits|12 Pack', tier: 'AMBASSADOR', qty: 3 }] })
  await createOrder({ custId: C.thabo,     ambRecord: A.m,    ambId: amb2.id, daysAgo: 27, hour: 14, status: 'DELIVERED', deliveryFee: 30, items: [{ vKey: 'Classic Vanilla Scones|12 Pack', tier: 'AMBASSADOR', qty: 1 }, { vKey: 'Choc Chip Biscuits|12 Pack', tier: 'AMBASSADOR', qty: 1 }] })
  await createOrder({ custId: C.priya,     ambRecord: A.none, ambId: null,    daysAgo: 26, hour: 11, status: 'DELIVERED', deliveryFee: 0,  items: [{ vKey: 'Chocolate Fudge Cake|Whole Cake (8")', tier: 'RETAIL', qty: 1 }] })
  await createOrder({ custId: C.nomsa,     ambRecord: A.z,    ambId: amb1.id, daysAgo: 25, hour: 16, status: 'DELIVERED', deliveryFee: 30, items: [{ vKey: 'Choc Chip Biscuits|12 Pack', tier: 'AMBASSADOR', qty: 4 }, { vKey: 'Rooibos Shortbread|12 Pack', tier: 'AMBASSADOR', qty: 2 }] })
  await createOrder({ custId: C.aisha,     ambRecord: A.z,    ambId: amb1.id, daysAgo: 25, hour: 17, status: 'DELIVERED', deliveryFee: 0,  items: [{ vKey: 'Classic Vanilla Scones|12 Pack', tier: 'AMBASSADOR', qty: 1 }, { vKey: 'Choc Chip Biscuits|12 Pack', tier: 'AMBASSADOR', qty: 1 }] })
  await createOrder({ custId: C.lungelo,   ambRecord: A.s,    ambId: amb3.id, daysAgo: 24, hour: 10, status: 'DELIVERED', deliveryFee: 30, items: [{ vKey: 'Choc Chip Biscuits|12 Pack', tier: 'AMBASSADOR', qty: 2 }] })
  await createOrder({ custId: C.zodwa,     ambRecord: A.f,    ambId: amb4.id, daysAgo: 23, hour: 14, status: 'DELIVERED', deliveryFee: 0,  items: [{ vKey: 'Rooibos Shortbread|12 Pack', tier: 'AMBASSADOR', qty: 2 }, { vKey: 'Classic Vanilla Scones|6 Pack', tier: 'AMBASSADOR', qty: 1 }] })
  await createOrder({ custId: C.sipho,     ambRecord: A.z,    ambId: amb1.id, daysAgo: 21, hour: 15, status: 'DELIVERED', deliveryFee: 30, items: [{ vKey: 'Choc Chip Biscuits|24 Pack', tier: 'AMBASSADOR', qty: 2 }] })
  await createOrder({ custId: C.lisa,      ambRecord: A.z,    ambId: amb1.id, daysAgo: 21, hour: 16, status: 'DELIVERED', deliveryFee: 0,  items: [{ vKey: 'Choc Chip Biscuits|12 Pack', tier: 'AMBASSADOR', qty: 3 }, { vKey: 'Classic Vanilla Scones|6 Pack', tier: 'AMBASSADOR', qty: 2 }] })
  await createOrder({ custId: C.thabo,     ambRecord: A.none, ambId: null,    daysAgo: 20, hour: 11, status: 'DELIVERED', deliveryFee: 0,  items: [{ vKey: 'Sourdough Loaf|Standard Loaf', tier: 'RETAIL', qty: 1 }, { vKey: 'Choc Chip Biscuits|12 Pack', tier: 'RETAIL', qty: 1 }] })
  await createOrder({ custId: C.kefilwe,   ambRecord: A.m,    ambId: amb2.id, daysAgo: 19, hour: 14, status: 'DELIVERED', deliveryFee: 30, items: [{ vKey: 'Choc Chip Biscuits|12 Pack', tier: 'AMBASSADOR', qty: 2 }, { vKey: 'Rooibos Shortbread|12 Pack', tier: 'AMBASSADOR', qty: 1 }] })
  await createOrder({ custId: C.priya,     ambRecord: A.z,    ambId: amb1.id, daysAgo: 18, hour: 16, status: 'DELIVERED', deliveryFee: 0,  items: [{ vKey: 'Choc Chip Biscuits|12 Pack', tier: 'AMBASSADOR', qty: 5 }] })
  await createOrder({ custId: C.rethabile, ambRecord: A.z,    ambId: amb1.id, daysAgo: 18, hour: 17, status: 'DELIVERED', deliveryFee: 30, items: [{ vKey: 'Classic Vanilla Scones|12 Pack', tier: 'AMBASSADOR', qty: 1 }] })
  await createOrder({ custId: C.nomsa,     ambRecord: A.none, ambId: null,    daysAgo: 17, hour: 10, status: 'DELIVERED', deliveryFee: 0,  items: [{ vKey: 'Lemon Poppy Seed Cake|Whole Cake (8")', tier: 'RETAIL', qty: 1 }] })
  await createOrder({ custId: C.aisha,     ambRecord: A.f,    ambId: amb4.id, daysAgo: 16, hour: 14, status: 'DELIVERED', deliveryFee: 30, items: [{ vKey: 'Choc Chip Biscuits|12 Pack', tier: 'AMBASSADOR', qty: 2 }, { vKey: 'Classic Vanilla Scones|6 Pack', tier: 'AMBASSADOR', qty: 2 }] })
  await createOrder({ custId: C.lungelo,   ambRecord: A.z,    ambId: amb1.id, daysAgo: 14, hour: 15, status: 'DELIVERED', deliveryFee: 0,  items: [{ vKey: 'Choc Chip Biscuits|24 Pack', tier: 'AMBASSADOR', qty: 2 }, { vKey: 'Rooibos Shortbread|12 Pack', tier: 'AMBASSADOR', qty: 1 }] })
  await createOrder({ custId: C.zodwa,     ambRecord: A.z,    ambId: amb1.id, daysAgo: 14, hour: 16, status: 'DELIVERED', deliveryFee: 30, items: [{ vKey: 'Choc Chip Biscuits|12 Pack', tier: 'AMBASSADOR', qty: 3 }] })
  await createOrder({ custId: C.sipho,     ambRecord: A.m,    ambId: amb2.id, daysAgo: 13, hour: 10, status: 'DELIVERED', deliveryFee: 0,  items: [{ vKey: 'Classic Vanilla Scones|12 Pack', tier: 'AMBASSADOR', qty: 1 }, { vKey: 'Choc Chip Biscuits|12 Pack', tier: 'AMBASSADOR', qty: 2 }] })
  await createOrder({ custId: C.lisa,      ambRecord: A.none, ambId: null,    daysAgo: 12, hour: 11, status: 'DELIVERED', deliveryFee: 30, items: [{ vKey: 'Chocolate Fudge Cake|Half Cake', tier: 'RETAIL', qty: 1 }, { vKey: 'Choc Chip Biscuits|12 Pack', tier: 'RETAIL', qty: 1 }] })
  await createOrder({ custId: C.thabo,     ambRecord: A.z,    ambId: amb1.id, daysAgo: 11, hour: 14, status: 'DELIVERED', deliveryFee: 0,  items: [{ vKey: 'Choc Chip Biscuits|12 Pack', tier: 'AMBASSADOR', qty: 4 }, { vKey: 'Classic Vanilla Scones|6 Pack', tier: 'AMBASSADOR', qty: 2 }] })
  await createOrder({ custId: C.kefilwe,   ambRecord: A.s,    ambId: amb3.id, daysAgo: 10, hour: 15, status: 'DELIVERED', deliveryFee: 30, items: [{ vKey: 'Rooibos Shortbread|12 Pack', tier: 'AMBASSADOR', qty: 3 }] })
  await createOrder({ custId: C.priya,     ambRecord: A.z,    ambId: amb1.id, daysAgo: 7,  hour: 16, status: 'DELIVERED', deliveryFee: 0,  items: [{ vKey: 'Choc Chip Biscuits|24 Pack', tier: 'AMBASSADOR', qty: 1 }, { vKey: 'Classic Vanilla Scones|12 Pack', tier: 'AMBASSADOR', qty: 1 }] })
  await createOrder({ custId: C.nomsa,     ambRecord: A.z,    ambId: amb1.id, daysAgo: 7,  hour: 17, status: 'DELIVERED', deliveryFee: 30, items: [{ vKey: 'Choc Chip Biscuits|12 Pack', tier: 'AMBASSADOR', qty: 3 }] })
  await createOrder({ custId: C.rethabile, ambRecord: A.m,    ambId: amb2.id, daysAgo: 6,  hour: 10, status: 'DELIVERED', deliveryFee: 0,  items: [{ vKey: 'Choc Chip Biscuits|12 Pack', tier: 'AMBASSADOR', qty: 2 }, { vKey: 'Rooibos Shortbread|12 Pack', tier: 'AMBASSADOR', qty: 1 }] })
  await createOrder({ custId: C.aisha,     ambRecord: A.none, ambId: null,    daysAgo: 5,  hour: 11, status: 'DELIVERED', deliveryFee: 30, items: [{ vKey: 'Classic Vanilla Scones|6 Pack', tier: 'RETAIL', qty: 2 }, { vKey: 'Sourdough Loaf|Standard Loaf', tier: 'RETAIL', qty: 1 }] })
  await createOrder({ custId: C.lungelo,   ambRecord: A.f,    ambId: amb4.id, daysAgo: 4,  hour: 14, status: 'READY',     deliveryFee: 30, items: [{ vKey: 'Choc Chip Biscuits|12 Pack', tier: 'AMBASSADOR', qty: 3 }, { vKey: 'Classic Vanilla Scones|6 Pack', tier: 'AMBASSADOR', qty: 1 }] })
  await createOrder({ custId: C.zodwa,     ambRecord: A.z,    ambId: amb1.id, daysAgo: 3,  hour: 15, status: 'BAKING',    deliveryFee: 0,  items: [{ vKey: 'Choc Chip Biscuits|24 Pack', tier: 'AMBASSADOR', qty: 1 }, { vKey: 'Rooibos Shortbread|24 Pack', tier: 'AMBASSADOR', qty: 1 }] })
  await createOrder({ custId: C.sipho,     ambRecord: A.m,    ambId: amb2.id, daysAgo: 2,  hour: 10, status: 'CONFIRMED', deliveryFee: 30, items: [{ vKey: 'Choc Chip Biscuits|12 Pack', tier: 'AMBASSADOR', qty: 2 }] })
  await createOrder({ custId: C.lisa,      ambRecord: A.none, ambId: null,    daysAgo: 1,  hour: 14, status: 'CONFIRMED', deliveryFee: 0,  items: [{ vKey: 'Classic Vanilla Scones|6 Pack', tier: 'RETAIL', qty: 2 }, { vKey: 'Choc Chip Biscuits|12 Pack', tier: 'RETAIL', qty: 1 }] })
  await createOrder({ custId: C.nomsa,     ambRecord: A.z,    ambId: amb1.id, daysAgo: 0,  hour: 9,  status: 'PENDING',   deliveryFee: 30, items: [{ vKey: 'Choc Chip Biscuits|12 Pack', tier: 'AMBASSADOR', qty: 2 }, { vKey: 'Classic Vanilla Scones|6 Pack', tier: 'AMBASSADOR', qty: 1 }] })

  console.log('✅  Current-period orders: 32')

  // ── Standalone expense transactions ───────────────────────────────────────────
  const expenseDefs = [
    { daysAgo: 58, amount: 3500, cat: 'Staff Wages',          acct: '5004', desc: 'Weekly wages — kitchen assistant (2 weeks)' },
    { daysAgo: 55, amount: 1200, cat: 'Rent & Premises',      acct: '5005', desc: 'Kitchen rental — March first half' },
    { daysAgo: 52, amount:  680, cat: 'Transport & Delivery',  acct: '5003', desc: 'Uber courier — bulk delivery run' },
    { daysAgo: 50, amount:  420, cat: 'Utilities',             acct: '5007', desc: 'Electricity — prepaid top-up' },
    { daysAgo: 48, amount:  350, cat: 'Marketing',             acct: '5006', desc: 'WhatsApp Business API subscription & flyers print' },
    { daysAgo: 45, amount: 3500, cat: 'Staff Wages',           acct: '5004', desc: 'Weekly wages — kitchen assistant (2 weeks)' },
    { daysAgo: 42, amount:  890, cat: 'Transport & Delivery',  acct: '5003', desc: 'Delivery fuel reimbursement — April week 1' },
    { daysAgo: 40, amount:  280, cat: 'Bank Charges',          acct: '5009', desc: 'Capitec Business account fees — March' },
    { daysAgo: 38, amount: 1200, cat: 'Rent & Premises',       acct: '5005', desc: 'Kitchen rental — March second half' },
    { daysAgo: 35, amount:  550, cat: 'Equipment & Supplies',  acct: '5008', desc: 'New baking trays x4, mixing bowls x2' },
    { daysAgo: 32, amount: 3500, cat: 'Staff Wages',           acct: '5004', desc: 'Weekly wages — kitchen assistant (2 weeks)' },
    { daysAgo: 30, amount:  460, cat: 'Utilities',             acct: '5007', desc: 'Water & electricity — March total' },
    { daysAgo: 28, amount:  720, cat: 'Transport & Delivery',  acct: '5003', desc: 'Courier — bulk ambassador delivery' },
    { daysAgo: 25, amount:  180, cat: 'Marketing',             acct: '5006', desc: 'Instagram boosted post — product launch' },
    { daysAgo: 22, amount:  340, cat: 'Packaging',             acct: '5002', desc: 'Gift ribbon, tissue paper, seasonal stickers' },
    { daysAgo: 20, amount: 3500, cat: 'Staff Wages',           acct: '5004', desc: 'Weekly wages — kitchen assistant (2 weeks)' },
    { daysAgo: 18, amount: 1200, cat: 'Rent & Premises',       acct: '5005', desc: 'Kitchen rental — April first half' },
    { daysAgo: 15, amount:  620, cat: 'Transport & Delivery',  acct: '5003', desc: 'Delivery run — east rand area' },
    { daysAgo: 12, amount:  285, cat: 'Bank Charges',          acct: '5009', desc: 'Capitec Business account fees — April' },
    { daysAgo: 10, amount:  430, cat: 'Utilities',             acct: '5007', desc: 'Prepaid electricity top-up' },
    { daysAgo: 8,  amount: 3500, cat: 'Staff Wages',           acct: '5004', desc: 'Weekly wages — kitchen assistant (2 weeks)' },
    { daysAgo: 6,  amount:  260, cat: 'Marketing',             acct: '5006', desc: 'Facebook ad campaign — scones promotion' },
    { daysAgo: 4,  amount: 1200, cat: 'Rent & Premises',       acct: '5005', desc: 'Kitchen rental — April second half' },
    { daysAgo: 2,  amount:  390, cat: 'Equipment & Supplies',  acct: '5008', desc: 'Piping bags, spatulas, baking paper rolls' },
    { daysAgo: 1,  amount:  510, cat: 'Transport & Delivery',  acct: '5003', desc: 'Fuel + toll — weekend delivery run' },
  ]
  for (const e of expenseDefs) {
    await db.financeTransaction.create({ data: {
      type: 'EXPENSE', category: e.cat, amount: e.amount,
      description: e.desc, accountId: acct(e.acct)?.id, createdAt: ago(e.daysAgo),
    }})
  }
  console.log('✅  Expense transactions: 25')

  // ── Bank Account + Transactions ───────────────────────────────────────────────
  const bankAcc = await db.bankAccount.create({ data: {
    name: 'Capitec Business Cheque', bankName: 'Capitec',
    accountNumber: '1234567890', balance: 12450.00, currency: 'ZAR',
  }})
  const bankTxns = [
    { daysAgo: 58, desc: 'Payment received — Nomsa Dlamini',      amount:  126.00 },
    { daysAgo: 57, desc: 'DEBIT — Capitec fee',                   amount:  -28.50 },
    { daysAgo: 56, desc: 'Payment received — Thabo Mokoena',       amount:  125.00 },
    { daysAgo: 54, desc: 'EFT received — Priya Naidoo',            amount:  138.00 },
    { daysAgo: 53, desc: 'Payment received — Lisa Van Wyk',        amount:   99.00 },
    { daysAgo: 52, desc: 'DEBIT — SA Flour Mills PO',              amount: -780.00 },
    { daysAgo: 51, desc: 'EFT received — Sipho Ndlovu',            amount:  174.00 },
    { daysAgo: 50, desc: 'EFT received — Aisha Patel',             amount:  105.00 },
    { daysAgo: 48, desc: 'Payment received — Kefilwe Sithole',     amount:  212.00 },
    { daysAgo: 47, desc: 'DEBIT — Wages payment',                  amount: -3500.00 },
    { daysAgo: 45, desc: 'DEBIT — Cape Dairy PO',                  amount: -2186.00 },
    { daysAgo: 44, desc: 'EFT received — Rethabile Mosia',         amount:  134.00 },
    { daysAgo: 42, desc: 'Payment received — Nomsa Dlamini',       amount:  254.00 },
    { daysAgo: 40, desc: 'DEBIT — Bakery Packaging SA PO',         amount: -1870.00 },
    { daysAgo: 38, desc: 'EFT received — bulk ambassador orders',   amount:  652.00 },
    { daysAgo: 35, desc: 'DEBIT — Wages payment',                  amount: -3500.00 },
    { daysAgo: 33, desc: 'Payment received — Nomsa / Thabo',        amount:  348.00 },
    { daysAgo: 30, desc: 'DEBIT — Choc World PO',                  amount:  -980.00 },
    { daysAgo: 28, desc: 'EFT received — multiple customers',       amount:  884.00 },
    { daysAgo: 25, desc: 'EFT received — Zanele ambassador batch',  amount: 1096.00 },
    { daysAgo: 22, desc: 'DEBIT — Wages payment',                  amount: -3500.00 },
    { daysAgo: 20, desc: 'EFT received — multiple customers',       amount:  680.00 },
    { daysAgo: 18, desc: 'DEBIT — Capitec fee',                    amount:  -28.50 },
    { daysAgo: 15, desc: 'EFT received — ambassador batch',         amount:  934.00 },
    { daysAgo: 14, desc: 'EFT received — Friday peak orders',       amount: 1244.00 },
    { daysAgo: 12, desc: 'Payment received — direct orders',        amount:  355.00 },
    { daysAgo: 10, desc: 'DEBIT — Wages payment',                  amount: -3500.00 },
    { daysAgo: 8,  desc: 'EFT received — ambassador batch',         amount:  748.00 },
    { daysAgo: 7,  desc: 'EFT received — Friday peak',              amount: 1092.00 },
    { daysAgo: 5,  desc: 'EFT received — customer payments',        amount:  520.00 },
    { daysAgo: 3,  desc: 'DEBIT — Kitchen rental',                 amount: -1200.00 },
    { daysAgo: 2,  desc: 'EFT received — pending orders deposit',   amount:  384.00 },
    { daysAgo: 1,  desc: 'DEBIT — Wages payment',                  amount: -3500.00 },
  ]
  for (const t of bankTxns) {
    await db.bankTransaction.create({ data: {
      bankAccountId: bankAcc.id, date: ago(t.daysAgo),
      description: t.desc, amount: t.amount, status: 'MATCHED',
      createdAt: ago(t.daysAgo),
    }})
  }
  console.log('✅  Bank account + 33 transactions')

  // ── Payout for top ambassador ─────────────────────────────────────────────────
  const zaneleCommissions = await db.commission.findMany({
    where: { ambassadorId: amb1.id, status: 'APPROVED' },
  })
  if (zaneleCommissions.length > 0) {
    const payoutTotal = zaneleCommissions.reduce((s: number, c: any) => s + Number(c.amount), 0)
    const payout = await db.payout.create({ data: {
      ambassadorId: amb1.id,
      amount: +payoutTotal.toFixed(2),
      method: 'bank_transfer',
      reference: 'PAY-ZANE-001',
      status: 'COMPLETED',
      notes: 'March commission payout — Zanele Khumalo',
      createdAt: ago(15),
    }})
    await db.commission.updateMany({
      where: { ambassadorId: amb1.id, status: 'APPROVED' },
      data: { payoutId: payout.id, status: 'PAID' },
    })
    console.log(`✅  Payout: R${payoutTotal.toFixed(2)} to Zanele`)
  }

  // ── Discount Rules ────────────────────────────────────────────────────────────
  await Promise.all([
    db.discountRule.create({ data: { name: 'Easter Special',        code: 'EASTER10', type: 'PERCENTAGE', value: 10, minOrder: 200, isActive: true,  description: '10% off orders over R200 — Easter promo' } }),
    db.discountRule.create({ data: { name: 'Bulk Order Discount',   code: 'BULK15',   type: 'PERCENTAGE', value: 15, minOrder: 500, isActive: true,  description: '15% off bulk orders over R500' } }),
    db.discountRule.create({ data: { name: 'New Customer Welcome',  code: 'WELCOME',  type: 'FLAT',       value: 30, minOrder: 100, isActive: true,  description: 'R30 off your first order over R100' } }),
    db.discountRule.create({ data: { name: 'Winter Warmer',         code: 'WINTER',   type: 'PERCENTAGE', value: 8,  minOrder: 150, isActive: false, description: 'Off-season promo — currently inactive' } }),
  ])
  console.log('✅  Discount rules: 4')

  // ── Quotes ────────────────────────────────────────────────────────────────────
  const chocBisc12 = V['Choc Chip Biscuits|12 Pack']
  const scones6    = V['Classic Vanilla Scones|6 Pack']
  const shortb12   = V['Rooibos Shortbread|12 Pack']

  await Promise.all([
    db.quote.create({ data: {
      number: 'QT-0001', customerId: thabo.id, createdById: admin.id,
      status: 'ACCEPTED', subtotal: 480, deliveryFee: 0, total: 480,
      notes: 'Bulk order for school event — 10 x Choc Chip 12-pack',
      validUntil: ago(-14), createdAt: ago(25),
      items: { create: [{ variantId: chocBisc12.id, quantity: 10, unitPrice: 48, subtotal: 480 }] },
    }}),
    db.quote.create({ data: {
      number: 'QT-0002', customerId: priya.id, ambassadorId: amb1.id, createdById: admin.id,
      status: 'SENT', subtotal: 696, deliveryFee: 50, total: 746,
      notes: 'Corporate office order — monthly standing quote',
      validUntil: ago(-7), createdAt: ago(18),
      items: { create: [
        { variantId: chocBisc12.id, quantity: 8,  unitPrice: 48, subtotal: 384 },
        { variantId: scones6.id,    quantity: 4,  unitPrice: 58, subtotal: 232 },
        { variantId: shortb12.id,   quantity: 1,  unitPrice: 52, subtotal: 52  },
      ]},
    }}),
    db.quote.create({ data: {
      number: 'QT-0003', customerId: aisha.id, createdById: admin.id,
      status: 'DRAFT', subtotal: 520, deliveryFee: 30, total: 550,
      notes: 'Wedding favour boxes — awaiting final guest count from client',
      validUntil: ago(-1), createdAt: ago(5),
      items: { create: [
        { variantId: chocBisc12.id, quantity: 6,  unitPrice: 48, subtotal: 288 },
        { variantId: shortb12.id,   quantity: 4,  unitPrice: 52, subtotal: 208 },
      ]},
    }}),
    db.quote.create({ data: {
      number: 'QT-0004', customerId: zodwa.id, ambassadorId: amb3.id, createdById: admin.id,
      status: 'DECLINED', subtotal: 234, deliveryFee: 60, total: 294,
      notes: 'Client said shipping cost too high for KZN',
      validUntil: ago(5), createdAt: ago(22),
      items: { create: [{ variantId: chocBisc12.id, quantity: 5, unitPrice: 48, subtotal: 240 }] },
    }}),
    db.quote.create({ data: {
      number: 'QT-0005', customerId: kefilwe.id, ambassadorId: amb1.id, createdById: admin.id,
      status: 'ACCEPTED', subtotal: 880, deliveryFee: 0, total: 880,
      notes: 'Year-end gift hampers for church group of 20 people',
      validUntil: ago(-10), createdAt: ago(35),
      items: { create: [
        { variantId: chocBisc12.id, quantity: 10, unitPrice: 48, subtotal: 480 },
        { variantId: scones6.id,    quantity: 5,  unitPrice: 58, subtotal: 290 },
        { variantId: shortb12.id,   quantity: 2,  unitPrice: 52, subtotal: 104 },
        { variantId: shortb12.id,   quantity: 1,  unitPrice: 52, subtotal: 52  },
      ]},
    }}),
  ])
  console.log('✅  Quotes: 5')

  // ── Summary ───────────────────────────────────────────────────────────────────
  const orderCount  = await db.order.count()
  const revenue     = await db.financeTransaction.aggregate({ where: { type: 'INCOME' }, _sum: { amount: true } })
  const expenses    = await db.financeTransaction.aggregate({ where: { type: 'EXPENSE' }, _sum: { amount: true } })
  const inc = Number(revenue._sum.amount || 0)
  const exp = Number(expenses._sum.amount || 0)

  console.log('\n🎉  Seed complete!')
  console.log('────────────────────────────────────────────────────')
  console.log(`Orders:    ${orderCount}`)
  console.log(`Revenue:   R${inc.toFixed(2)}`)
  console.log(`Expenses:  R${exp.toFixed(2)}`)
  console.log(`Net:       R${(inc - exp).toFixed(2)}  (${((inc-exp)/inc*100).toFixed(1)}% margin)`)
  console.log('────────────────────────────────────────────────────')
  console.log('Admin:       admin@tlakatreats.co.za  /  Admin@12345')
  console.log('Customer:    nomsa.dlamini@gmail.com  /  Customer@123')
  console.log('Ambassador:  zanele.khumalo@gmail.com /  Ambassador@123')
  console.log('────────────────────────────────────────────────────')
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
