import { PrismaClient } from '@prisma/client'
import { NotFoundError } from '../../shared/errors'

export class DiscountRuleService {
  constructor(private prisma: PrismaClient) {}

  async getAll() {
    return this.prisma.discountRule.findMany({ orderBy: { createdAt: 'desc' } })
  }

  async getActive() {
    return this.prisma.discountRule.findMany({ where: { isActive: true }, orderBy: { value: 'desc' } })
  }

  async create(data: {
    name: string
    type: string
    value: number
    code?: string
    minOrder?: number
    description?: string
  }) {
    return this.prisma.discountRule.create({ data })
  }

  async update(
    id: string,
    data: Partial<{
      name: string
      type: string
      value: number
      code: string | null
      minOrder: number | null
      description: string | null
      isActive: boolean
    }>,
  ) {
    const rule = await this.prisma.discountRule.findUnique({ where: { id } })
    if (!rule) throw new NotFoundError('Discount rule')
    return this.prisma.discountRule.update({ where: { id }, data })
  }

  async remove(id: string) {
    const rule = await this.prisma.discountRule.findUnique({ where: { id } })
    if (!rule) throw new NotFoundError('Discount rule')
    await this.prisma.discountRule.delete({ where: { id } })
  }
}
