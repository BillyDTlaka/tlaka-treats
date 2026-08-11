import { PrismaClient } from '@prisma/client'

export interface OrderCostResult {
  total: number
  // Product names that couldn't be costed — no active Recipe has that product set as its
  // outputProductId, so there's nothing to compute an ingredient cost from.
  uncostedItems: string[]
}

// Cost per single unit of a recipe's output: sum(ingredient qty × its stock item's current
// costPerUnit) ÷ the recipe's yield. Same formula the recipe detail page has shown live
// since earlier this session — this is the first place it gets persisted anywhere.
function unitCostFromRecipe(recipe: { yieldQty: unknown; ingredients: Array<{ quantity: unknown; stockItem: { costPerUnit: unknown } | null }> }): number {
  const yieldQty = Number(recipe.yieldQty) || 1
  const costPerBatch = recipe.ingredients.reduce(
    (sum, ing) => sum + Number(ing.quantity) * Number(ing.stockItem?.costPerUnit ?? 0),
    0,
  )
  return costPerBatch / yieldQty
}

// Computes and persists a point-in-time cost snapshot for an order: per-item unitCost and
// the order's total cogsAmount. Safe to call multiple times before the order is DELIVERED —
// each call recomputes from current ingredient prices. Once odooCogsMoveId is set (the Odoo
// entry exists), callers should stop calling this and reuse the frozen Order.cogsAmount —
// see odoo-cogs.service.ts.
export async function computeOrderCost(prisma: PrismaClient, orderId: string): Promise<OrderCostResult> {
  const db = prisma as any

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          variant: { include: { product: true } },
        },
      },
    },
  })
  if (!order) return { total: 0, uncostedItems: [] }

  const productIds: string[] = [...new Set(order.items.map((i: any) => i.variant.product.id) as string[])]
  const recipes = await db.recipe.findMany({
    where: { outputProductId: { in: productIds }, isActive: true },
    include: { ingredients: { include: { stockItem: true } } },
  })
  // First active recipe found per output product — a product with more than one active
  // recipe pointing to it is a data setup issue outside this function's scope to resolve.
  const recipeByProductId = new Map<string, any>()
  for (const recipe of recipes) {
    if (!recipeByProductId.has(recipe.outputProductId)) recipeByProductId.set(recipe.outputProductId, recipe)
  }

  let total = 0
  const uncostedItems: string[] = []

  for (const item of order.items) {
    const recipe = recipeByProductId.get(item.variant.product.id)
    const unitCost = recipe ? unitCostFromRecipe(recipe) : 0
    if (!recipe) uncostedItems.push(item.variant.product.name)

    await db.orderItem.update({ where: { id: item.id }, data: { unitCost } })
    total += unitCost * Number(item.quantity)
  }

  await db.order.update({ where: { id: orderId }, data: { cogsAmount: total, cogsComputedAt: new Date() } })

  return { total, uncostedItems }
}
