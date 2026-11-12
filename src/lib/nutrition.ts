import type { FoodContentRow, FoodRow } from '../types/entityTypes'
import { formatNumber } from './workoutStats'

export const NUTRIENTS = [
    { key: 'kcal', label: 'Calories', short: 'kcal', unit: 'kcal' },
    { key: 'protein', label: 'Protein', short: 'P', unit: 'g' },
    { key: 'carbs', label: 'Carbs', short: 'C', unit: 'g' },
    { key: 'fat', label: 'Fat', short: 'F', unit: 'g' },
    { key: 'fiber', label: 'Fiber', short: 'Fib', unit: 'g' },
] as const

export type NutrientKey = (typeof NUTRIENTS)[number]['key']
export type Nutrients = Record<NutrientKey, number>

export const NO_NUTRIENTS: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }

// A food's values are per 100 of a weight or volume unit, per 1 of a counted one
export const FOOD_UNITS = [
    { value: 'g', label: 'Grams', per: '100 g' },
    { value: 'ml', label: 'Millilitres', per: '100 ml' },
    { value: 'piece', label: 'Pieces', per: 'piece' },
    { value: 'scoop', label: 'Scoops', per: 'scoop' },
] as const

export type FoodUnit = (typeof FOOD_UNITS)[number]['value']

function isPer100(unit: string) {
    return unit === 'g' || unit === 'ml'
}

export function foodNutrients(food: Pick<FoodRow, NutrientKey | 'unit'>, quantity: number): Nutrients {
    const factor = isPer100(food.unit) ? quantity / 100 : quantity
    return {
        kcal: food.kcal * factor,
        protein: food.protein * factor,
        carbs: food.carbs * factor,
        fat: food.fat * factor,
        fiber: food.fiber * factor,
    }
}

// Nutrition values are linear in the quantity, so a logged amount can be rescaled without the food
export function scaleNutrients(n: Nutrients, factor: number): Nutrients {
    return { kcal: n.kcal * factor, protein: n.protein * factor, carbs: n.carbs * factor, fat: n.fat * factor, fiber: n.fiber * factor }
}

// The amount a dropped food starts with, to be changed right after
export function defaultQuantity(unit: string) {
    return unit === 'g' || unit === 'ml' ? 100 : 1
}

export function sumNutrients(list: Nutrients[]): Nutrients {
    const total = { ...NO_NUTRIENTS }
    for (const n of list) for (const { key } of NUTRIENTS) total[key] += n[key]
    return total
}

// A food that goes in another, and how much of it
export type FoodContent = { id: string; food: FoodRow; quantity: number }

// What goes in each food, by the food's id, in order. Deleted foods are left out on both sides.
export function contentsByFood(rows: FoodContentRow[], foods: FoodRow[]): Map<string, FoodContent[]> {
    const foodsById = new Map(foods.map((f) => [f.id, f]))
    const byFood = new Map<string, FoodContent[]>()
    for (const row of rows) {
        const food = foodsById.get(row.contentId)
        if (!food || !foodsById.has(row.foodId)) continue
        byFood.set(row.foodId, [...(byFood.get(row.foodId) ?? []), { id: row.id, food, quantity: row.quantity }])
    }
    return byFood
}

export function contentsNutrients(contents: FoodContent[]): Nutrients {
    return sumNutrients(contents.map((c) => foodNutrients(c.food, c.quantity)))
}

// "125 kcal · P 13 g · C 1 g · F 9 g · Fib 0 g"
export function describeNutrients(n: Nutrients) {
    return NUTRIENTS.map(({ key, short, unit }) =>
        key === 'kcal' ? `${formatNutrient(n.kcal, key)} kcal` : `${short} ${formatNutrient(n[key], key)} ${unit}`
    ).join(' · ')
}

export function describeFood(food: FoodRow) {
    return `per ${unitPer(food.unit)} · ${describeNutrients(food)}`
}

export function formatNutrient(value: number, key: NutrientKey) {
    // Small gram amounts keep a decimal, so 0.4 g of carbs is not shown as 0
    return key === 'kcal' || Math.abs(value) >= 10 ? formatNumber(value, 0) : formatNumber(value, 1)
}

export function formatNutrientWithUnit(value: number, key: NutrientKey) {
    return key === 'kcal' ? `${formatNutrient(value, key)} kcal` : `${formatNutrient(value, key)} g`
}

export function unitPer(unit: string) {
    return FOOD_UNITS.find((u) => u.value === unit)?.per ?? unit
}

export function formatQuantity(quantity: number, unit: string) {
    const amount = formatNumber(quantity, 2)
    switch (unit) {
        case 'g':
        case 'ml':
            return `${amount} ${unit}`
        case 'piece':
            return `${amount} ${quantity === 1 ? 'piece' : 'pcs'}`
        case 'scoop':
            return `${amount} ${quantity === 1 ? 'scoop' : 'scoops'}`
        default:
            return `${amount} ${unit}`
    }
}

// The short label used beside a quantity input
export function quantityUnitLabel(unit: string) {
    return unit === 'piece' ? 'pcs' : unit === 'scoop' ? 'scoops' : unit
}

// A YYYY-MM-DD date column as a local date (new Date('YYYY-MM-DD') would be UTC midnight)
export function parseDateKey(key: string) {
    const [y, m, d] = key.split('-').map(Number)
    return new Date(y, m - 1, d)
}

export function addDays(key: string, days: number) {
    const d = parseDateKey(key)
    d.setDate(d.getDate() + days)
    return d
}
