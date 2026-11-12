import type { Nutrients } from '../lib/nutrition'

// Searching the public food library of Open Food Facts (openfoodfacts.org), whose data is open
// under the Open Database License. The search goes through this site's /api/food-search, which
// passes it on to search.openfoodfacts.org (see vite.config.ts and vercel.json), as that does not
// let browsers call it from other sites.

const PAGE_SIZE = 20
const FIELDS = [
    'code',
    'product_name',
    'product_name_el',
    'generic_name',
    'generic_name_el',
    'brands',
    'quantity',
    'countries_tags',
    'image_front_small_url',
    'nutriments',
].join(',')

// A product as the library gives it
type Hit = {
    code: string
    product_name?: string
    product_name_el?: string
    generic_name?: string
    generic_name_el?: string
    brands?: string[] | string
    quantity?: string
    countries_tags?: string[]
    image_front_small_url?: string
    nutriments?: Record<string, number | string | undefined>
}

// A product made ready for the food list: values per 100 g or 100 ml, null where the label has
// none. The extras are shown, not saved: foods have no place for them.
export type PublicFood = {
    code: string
    name: string
    brand: string | null
    quantity: string | null
    imageUrl: string | null
    unit: 'g' | 'ml'
    nutrients: Record<keyof Nutrients, number | null>
    extras: { saturatedFat: number | null; sugars: number | null; salt: number | null }
    soldInGreece: boolean
}

export type PublicSearch = { foods: PublicFood[]; total: number; page: number; pageCount: number }

function num(value: number | string | undefined) {
    const n = typeof value === 'string' ? Number(value) : value
    return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null
}

function text(value: string | undefined) {
    const t = value?.trim()
    return t ? t : null
}

// Liquids are labelled per 100 ml: told apart by how the pack is measured, e.g. "1 l" or "330 ml"
function unitOf(quantity: string | null): 'g' | 'ml' {
    return quantity && /\d\s*(ml|cl|dl|l|λ|λίτρ)/i.test(quantity) ? 'ml' : 'g'
}

function toFood(hit: Hit): PublicFood | null {
    // The Greek name first, when the product has one
    const name = text(hit.product_name_el) ?? text(hit.product_name) ?? text(hit.generic_name_el) ?? text(hit.generic_name)
    if (!name) return null
    const n = hit.nutriments ?? {}
    // Some labels give only kilojoules
    const kj = num(n['energy-kj_100g']) ?? num(n['energy_100g'])
    const kcal = num(n['energy-kcal_100g']) ?? (kj !== null ? kj / 4.184 : null)
    const brands = Array.isArray(hit.brands) ? hit.brands : hit.brands?.split(',') ?? []
    const quantity = text(hit.quantity)
    return {
        code: hit.code,
        name,
        brand: text(brands[0]),
        quantity,
        imageUrl: text(hit.image_front_small_url),
        unit: unitOf(quantity),
        nutrients: {
            kcal,
            protein: num(n['proteins_100g']),
            carbs: num(n['carbohydrates_100g']),
            fat: num(n['fat_100g']),
            fiber: num(n['fiber_100g']),
        },
        extras: {
            saturatedFat: num(n['saturated-fat_100g']),
            sugars: num(n['sugars_100g']),
            salt: num(n['salt_100g']),
        },
        soldInGreece: (hit.countries_tags ?? []).includes('en:greece'),
    }
}

// What an added food's notes say about where it came from. The barcode in it is how the library
// tells the food is already in the list.
export function libraryNote(food: PublicFood) {
    return [food.brand, food.quantity, `Open Food Facts ${food.code}`].filter(Boolean).join(' · ')
}

export function isFromLibrary(mine: { notes: string | null }, food: PublicFood) {
    return !!mine.notes?.includes(`Open Food Facts ${food.code}`)
}

// One page of products matching `query`, in Greek or English. In the page, products with values
// come before those without, and products sold in Greece first among them. Throws when the
// library can't be reached.
export async function searchPublicFoods(query: string, page = 1): Promise<PublicSearch> {
    const params = new URLSearchParams({
        q: query,
        langs: 'el,en',
        page: String(page),
        page_size: String(PAGE_SIZE),
        fields: FIELDS,
    })
    const res = await fetch(`/api/food-search?${params}`)
    if (!res.ok) throw new Error(`The food library answered ${res.status}`)
    const data = (await res.json()) as { hits?: Hit[]; count?: number; page?: number; page_count?: number }

    const foods = (data.hits ?? []).flatMap((hit) => toFood(hit) ?? [])
    // Stable, so within each group the library's own order stays
    const rank = (f: PublicFood) => (f.nutrients.kcal !== null ? 2 : 0) + (f.soldInGreece ? 1 : 0)
    foods.sort((a, b) => rank(b) - rank(a))
    return { foods, total: data.count ?? foods.length, page: data.page ?? page, pageCount: data.page_count ?? page }
}
