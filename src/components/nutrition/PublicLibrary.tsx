import { useState } from 'react'
import { Alert, Avatar, Box, Button, Chip, InputAdornment, Link, Paper, Stack, TextField, Typography } from '@mui/material'
import { Add as AddIcon, Inventory2Outlined as PackageIcon, Search as SearchIcon } from '@mui/icons-material'
import { isFromLibrary, searchPublicFoods, type PublicFood, type PublicSearch } from '../../services/foodLibrary'
import { NUTRIENTS, formatNutrient } from '../../lib/nutrition'
import { formatNumber } from '../../lib/workoutStats'
import type { FoodRow } from '../../types/entityTypes'
import { t, useT } from '../../i18n'

// "68 kcal · P 9 g · C 3.6 g · F 2 g · Fib –", a dash where the label gives nothing
function describeLabel(food: PublicFood) {
    return NUTRIENTS.map(({ key, short }) => {
        const value = food.nutrients[key]
        const shown = value === null ? '–' : formatNutrient(value, key)
        return key === 'kcal' ? `${shown} ${t().units.kcal}` : `${short} ${shown}${value === null ? '' : ` ${t().units.g}`}`
    }).join(' · ')
}

function describeExtras(food: PublicFood) {
    const { saturatedFat, sugars, salt } = food.extras
    return [
        saturatedFat !== null && t().nutrition.library.saturatedFat(formatNutrient(saturatedFat, 'fat')),
        sugars !== null && t().nutrition.library.sugars(formatNutrient(sugars, 'carbs')),
        salt !== null && t().nutrition.library.salt(formatNutrient(salt, 'fat')),
    ].filter(Boolean).join(' · ')
}

// Searches the Open Food Facts library; a product picked opens the add food form, filled in
export default function PublicLibrary({ myFoods, onAdd }: { myFoods: FoodRow[]; onAdd: (food: PublicFood) => void }) {
    const m = useT()
    const [query, setQuery] = useState('')
    // The search shown, with the pages loaded so far
    const [result, setResult] = useState<{ query: string; search: PublicSearch } | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function search(e: React.FormEvent) {
        e.preventDefault()
        const q = query.trim()
        if (!q) return
        setLoading(true)
        setError(null)
        try {
            setResult({ query: q, search: await searchPublicFoods(q) })
        } catch {
            setError(m.nutrition.library.unreachable)
        }
        setLoading(false)
    }

    async function showMore() {
        if (!result) return
        setLoading(true)
        setError(null)
        try {
            const next = await searchPublicFoods(result.query, result.search.page + 1)
            setResult({ query: result.query, search: { ...next, foods: [...result.search.foods, ...next.foods] } })
        } catch {
            setError(m.nutrition.library.moreFailed)
        }
        setLoading(false)
    }

    const inMyFoods = (food: PublicFood) => myFoods.some((f) => isFromLibrary(f, food))

    return (
        <>
            <Alert severity="warning" sx={{ mb: 2 }}>
                {m.nutrition.library.warningBefore}
                <Link href="https://world.openfoodfacts.org" target="_blank" rel="noopener noreferrer" color="inherit">
                    Open Food Facts
                </Link>
                {m.nutrition.library.warningAfter}
            </Alert>

            <Box component="form" onSubmit={search} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <TextField
                    size="small"
                    placeholder={m.nutrition.library.placeholder}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    sx={{ flex: '1 1 240px' }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon fontSize="small" />
                            </InputAdornment>
                        ),
                    }}
                />
                <Button type="submit" variant="contained" disabled={loading || !query.trim()}>
                    {loading && !result?.search.foods.length ? m.common.searching : m.common.search}
                </Button>
            </Box>
            {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}

            {!result ? (
                <Typography color="text.secondary" sx={{ mt: 2 }}>
                    {m.nutrition.library.intro}
                </Typography>
            ) : (
                <>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                        {result.search.total === 0
                            ? m.nutrition.library.nothingFound(result.query)
                            : m.nutrition.library.found(formatNumber(result.search.total, 0), result.query)}
                    </Typography>
                    <Stack spacing={1} sx={{ mt: 1 }}>
                        {result.search.foods.map((food) => {
                            const added = inMyFoods(food)
                            const extras = describeExtras(food)
                            return (
                                <Paper key={food.code} variant="outlined" sx={{ px: 1.5, py: 1, display: 'flex', gap: 1.5, alignItems: 'center' }}>
                                    <Avatar
                                        variant="rounded"
                                        src={food.imageUrl ?? undefined}
                                        alt=""
                                        sx={{ width: 48, height: 48, bgcolor: 'action.hover', '& img': { objectFit: 'contain' } }}
                                    >
                                        <PackageIcon color="action" />
                                    </Avatar>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography noWrap>{food.name}</Typography>
                                        {(food.brand || food.quantity) && (
                                            <Typography variant="caption" color="text.secondary" component="div" noWrap>
                                                {[food.brand, food.quantity].filter(Boolean).join(' · ')}
                                            </Typography>
                                        )}
                                        <Typography variant="body2" color="text.secondary">
                                            {food.nutrients.kcal === null ? m.nutrition.library.noValues : describeLabel(food)}
                                        </Typography>
                                        {extras && (
                                            <Typography variant="caption" color="text.secondary" component="div">
                                                {m.nutrition.library.also(extras)}
                                            </Typography>
                                        )}
                                    </Box>
                                    {added ? (
                                        <Chip size="small" label={m.nutrition.library.inYourFoods} />
                                    ) : (
                                        <Button size="small" startIcon={<AddIcon />} onClick={() => onAdd(food)} sx={{ flexShrink: 0 }}>
                                            {m.common.add}
                                        </Button>
                                    )}
                                </Paper>
                            )
                        })}
                    </Stack>
                    {result.search.page < result.search.pageCount && (
                        <Box sx={{ textAlign: 'center', mt: 2 }}>
                            <Button onClick={showMore} disabled={loading}>{loading ? m.common.loadingShort : m.common.showMore}</Button>
                        </Box>
                    )}
                </>
            )}
        </>
    )
}
