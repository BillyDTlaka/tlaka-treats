import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { AppError } from '../../shared/errors'

export class AuthService {
  constructor(private prisma: PrismaClient) {}

  async register(data: {
    email: string
    password: string
    firstName: string
    lastName: string
    phone?: string
  }) {
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } })
    if (existing) throw new AppError('Email already in use', 409)

    const passwordHash = await bcrypt.hash(data.password, 12)

    // Get or create customer role
    const customerRole = await this.prisma.role.findUnique({ where: { name: 'CUSTOMER' } })
    if (!customerRole) throw new AppError('Customer role not found. Run db:seed first.', 500)

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        passwordHash,
        roles: { create: { roleId: customerRole.id } },
      },
      include: { roles: { include: { role: true } } },
    })

    return user
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { role: { include: { permissions: true } } } } },
    })

    if (!user) throw new AppError('Invalid email or password', 401)
    if (user.status !== 'ACTIVE') throw new AppError('Account is suspended', 403)

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) throw new AppError('Invalid email or password', 401)

    return user
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, phone: true, firstName: true, lastName: true, status: true, createdAt: true, updatedAt: true,
        roles: { include: { role: true } },
        ambassador: true,
      },
    })
  }
}
