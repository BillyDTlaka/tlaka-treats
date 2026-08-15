export interface UomLite {
  id: string
  abbreviation: string
  type: string
  toBaseFactor: unknown
}

// Converts a quantity from one unit to another. Same unit (or either side unset,
// which is the case for every RecipeIngredient today since the UI has always
// implicitly matched the ingredient's unit to its stock item's) passes through
// unchanged. Cross-unit conversion is only allowed within WEIGHT or VOLUME — the
// two dimensions with a fixed, unambiguous physical ratio (1000g = 1kg) — via each
// unit's toBaseFactor. COUNT/LENGTH/OTHER units are never auto-converted since e.g.
// a "bag" or "box" has no universal size, so a mismatch there is a data error, not
// something safe to guess at.
export function convertQuantity(qty: number, fromUom: UomLite | null | undefined, toUom: UomLite | null | undefined): number {
  if (!fromUom || !toUom || fromUom.id === toUom.id) return qty
  if (fromUom.type !== toUom.type || !['WEIGHT', 'VOLUME'].includes(fromUom.type)) {
    throw new Error(
      `Cannot convert ${fromUom.abbreviation} to ${toUom.abbreviation} — units are not compatible for automatic conversion`,
    )
  }
  return qty * (Number(fromUom.toBaseFactor) / Number(toUom.toBaseFactor))
}
