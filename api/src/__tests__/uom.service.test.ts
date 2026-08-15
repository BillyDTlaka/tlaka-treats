import { convertQuantity } from '../shared/services/uom.service'

const kg = { id: 'uom-kg', abbreviation: 'kg', type: 'WEIGHT', toBaseFactor: 1 }
const g  = { id: 'uom-g',  abbreviation: 'g',  type: 'WEIGHT', toBaseFactor: 0.001 }
const mg = { id: 'uom-mg', abbreviation: 'mg', type: 'WEIGHT', toBaseFactor: 0.000001 }
const l  = { id: 'uom-l',  abbreviation: 'l',  type: 'VOLUME', toBaseFactor: 1 }
const ml = { id: 'uom-ml', abbreviation: 'ml', type: 'VOLUME', toBaseFactor: 0.001 }
const pack = { id: 'uom-pack', abbreviation: 'pack', type: 'COUNT', toBaseFactor: 1 }
const box  = { id: 'uom-box',  abbreviation: 'box',  type: 'COUNT', toBaseFactor: 1 }

describe('convertQuantity', () => {
  it('UOM-01 — same unit is a no-op', () => {
    expect(convertQuantity(2, kg, kg)).toBe(2)
  })

  it('UOM-02 — either side missing is a no-op (matches every RecipeIngredient today, uomId is optional)', () => {
    expect(convertQuantity(2, null, kg)).toBe(2)
    expect(convertQuantity(2, kg, undefined)).toBe(2)
    expect(convertQuantity(2, null, null)).toBe(2)
  })

  it('UOM-03 — grams to kilograms', () => {
    expect(convertQuantity(250, g, kg)).toBeCloseTo(0.25, 8)
  })

  it('UOM-04 — kilograms to grams', () => {
    expect(convertQuantity(0.25, kg, g)).toBeCloseTo(250, 8)
  })

  it('UOM-05 — milligrams to grams', () => {
    expect(convertQuantity(1500, mg, g)).toBeCloseTo(1.5, 8)
  })

  it('UOM-06 — millilitres to litres', () => {
    expect(convertQuantity(500, ml, l)).toBeCloseTo(0.5, 8)
  })

  it('UOM-07 — fractional quantities convert correctly', () => {
    expect(convertQuantity(0.5, l, ml)).toBeCloseTo(500, 8)
  })

  it('UOM-08 — incompatible types (weight vs volume) throw rather than silently guessing', () => {
    expect(() => convertQuantity(1, kg, l)).toThrow(/not compatible/)
  })

  it('UOM-09 — different COUNT units throw — a "pack" and a "box" have no fixed universal size', () => {
    expect(() => convertQuantity(1, pack, box)).toThrow(/not compatible/)
  })
})
