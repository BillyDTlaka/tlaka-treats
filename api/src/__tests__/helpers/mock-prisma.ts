/**
 * Creates a fully stubbed PrismaClient mock.
 * Each model method is a jest.fn() returning undefined by default.
 * Override per-test with: mockPrisma.user.findUnique.mockResolvedValueOnce(...)
 */
export function createMockPrisma() {
  // eslint-disable-next-line prefer-const
  let mock: any
  mock = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    role: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    userRole: {
      upsert: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    permission: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    ambassador: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    productVariant: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    variantPrice: {
      createMany: jest.fn(),
      upsert: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    orderItem: {
      deleteMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
    },
    orderStatusLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    commission: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    payout: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    company: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    address: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    financeTransaction: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    financeAccount: {
      findFirst: jest.fn(),
    },
    stockMovement: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    stockItem: {
      update: jest.fn(),
    },
    // Prisma transaction support — handles both array and callback forms
    $transaction: jest.fn((arg: any) =>
      Array.isArray(arg) ? Promise.all(arg) : arg(mock)
    ),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  }
  return mock
}

export type MockPrisma = ReturnType<typeof createMockPrisma>

// ── Re-usable test fixtures ───────────────────────────────────────────────────

export const CUSTOMER_ROLE = { id: 'role-customer', name: 'CUSTOMER' }
export const ADMIN_ROLE    = { id: 'role-admin',    name: 'ADMIN'    }
export const AMB_ROLE      = { id: 'role-amb',      name: 'AMBASSADOR' }

export const ADMIN_PERMISSION = { action: 'manage', subject: 'order' }

export function makeUser(overrides: Record<string, any> = {}) {
  return {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    phone: null,
    passwordHash: '$2a$12$hashedpassword',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    roles: [{ role: CUSTOMER_ROLE }],
    ...overrides,
  }
}

export function makeProduct(overrides: Record<string, any> = {}) {
  return {
    id: 'product-1',
    name: 'Choc Chip Cookies',
    description: 'Delicious cookies',
    isActive: true,
    category: 'Biscuits & Cookies',
    imageUrl: null,
    createdAt: new Date(),
    variants: [
      {
        id: 'variant-1',
        name: '12 Pack',
        isActive: true,
        prices: [{ tier: 'RETAIL', price: 85 }],
      },
    ],
    ...overrides,
  }
}

export function makeOrder(overrides: Record<string, any> = {}) {
  return {
    id: 'order-1',
    customerId: 'user-1',
    ambassadorId: null,
    addressId: null,
    status: 'PENDING',
    subtotal: 170,
    deliveryFee: 0,
    discountAmount: 0,
    total: 170,
    notes: null,
    invoiceNumber: null,
    orderSeq: 1,
    orderNumber: null,
    odooInvoiceId: null,
    odooInvoiceNumber: null,
    odooInvoiceStatus: 'NOT_READY',
    odooInvoiceSyncError: null,
    odooInvoiceSyncedAt: null,
    createdAt: new Date(),
    items: [
      {
        id: 'item-1',
        variantId: 'variant-1',
        quantity: 2,
        unitPrice: 85,
        subtotal: 170,
        variant: { id: 'variant-1', name: '12 Pack', odooProductId: null, odooProductReference: null, product: { name: 'Choc Chip Cookies' } },
      },
    ],
    ambassador: null,
    customer: { id: 'user-1', email: 'test@example.com', phone: null, firstName: 'Test', lastName: 'User', odooPartnerId: null },
    statusLogs: [],
    ...overrides,
  }
}

export function makeAmbassador(overrides: Record<string, any> = {}) {
  return {
    id: 'amb-1',
    userId: 'user-1',
    code: 'TT-TEST1234',
    commissionRate: 0.1,
    status: 'PENDING',
    bio: null,
    kycStatus: 'NOT_SUBMITTED',
    kycData: null,
    kycNote: null,
    createdAt: new Date(),
    ...overrides,
  }
}

export function makeCommission(overrides: Record<string, any> = {}) {
  return {
    id: 'commission-1',
    orderId: 'order-1',
    ambassadorId: 'amb-1',
    amount: 17,
    rate: 0.1,
    status: 'PENDING',
    payoutId: null,
    odooBillId: null,
    odooBillNumber: null,
    odooBillStatus: 'NOT_READY',
    odooBillSyncError: null,
    odooBillSyncedAt: null,
    odooBillPaymentSyncStatus: 'NOT_SYNCED',
    odooBillPaymentSyncError: null,
    odooBillPaymentSyncedAt: null,
    createdAt: new Date(),
    ambassador: {
      id: 'amb-1',
      user: { id: 'amb-user-1', email: 'amb@test.com', phone: null, firstName: 'Amb', lastName: 'One', odooPartnerId: '99' },
    },
    order: { id: 'order-1', status: 'DELIVERED', orderNumber: 'TT-ORD-000001', orderSeq: 1 },
    ...overrides,
  }
}
