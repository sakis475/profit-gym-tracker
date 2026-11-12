import { useState } from 'react'
import { Alert, Avatar, Box, Button, Chip, InputAdornment, Link, Paper, Stack, TextField, Typography } from '@mui/material'
import { Add as AddIcon, Inventory2Outlined as PackageIcon, Search as SearchIcon } from '@mui/icons-material'
import { isFromLibrary, searchPublicFoods, type PublicFood, type PublicSearch } from '../../services/foodLibrary'
import { NUTRIENTS, formatNutrient } from '../../lib/nutrition'
import type { FoodRow } from '../../types/entityTypes'

// "68 kcal · P 9 g · C 3.6 g · F 2 g · Fib –", a dash where the label gives nothing
function describeLabel(food: PublicFood) {
    return NUTRIENTS.map(({ key, short }) => {
        const value = food.nutrients[key]
        const shown = value === null ? '–' : formatNutrient(value, key)
        return key === 'kcal' ? `${shown} kcal` : `${short} ${shown}${value === null ? '' : ' g'}`
    }).join(' · ')
}

function describeExtras(food: PublicFood) {
    const { saturatedFat, sugars, salt } = food.extras
    return [
        saturatedFat !== null && `saturated fat ${formatNutrient(saturatedFat, 'fat')} g`,
        sugars !== null && `sugars ${formatNutrient(sugars, 'carbs')} g`,
        salt !== null && `salt ${formatNutrient(salt, 'fat')} g`,
    ].filter(Boolean).join(' · ')
}

// Searches the Open Food Facts library; a product picked opens the add food form, filled in
export default function PublicLibrary({ myFoods, onAdd }: { myFoods: FoodRow[]; onAdd: (food: PublicFood) => void }) {
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
            setError("The food library couldn't be reached. Try again in a moment.")
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
            setError("More results couldn't be loaded. Try again in a moment.")
        }
        setLoading(false)
    }

    const inMyFoods = (food: PublicFood) => myFoods.some((f) => isFromLibrary(f, food))

    return (
        <>
            <Alert severity="warning" sx={{ mb: 2 }}>
                These foods come from{' '}
                <Link href="https://world.openfoodfacts.org" target="_blank" rel="noopener noreferrer" color="inherit">
                    Open Food Facts
                </Link>
                , a public database filled in by volunteers and open under the Open Database License. It is not part of
                this app, and its values can be missing or wrong: check them against the pack before you add a food.
            </Alert>

            <Box component="form" onSubmit={search} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <TextField
                    size="small"
                    placeholder="Search, e.g. γιαούρτι στραγγιστό or oats"
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
                    {loading && !result?.search.foods.length ? 'Searching…' : 'Search'}
                </Button>
            </Box>
            {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}

            {!result ? (
                <Typography color="text.secondary" sx={{ mt: 2 }}>
                    Search millions of packaged foods, Greek ones first. Pick one to add it to your foods; you can check
                    and change its values before it is saved.
                </Typography>
            ) : (
                <>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                        {result.search.total === 0
                            ? `Nothing found for "${result.query}".`
                            : `${result.search.total.toLocaleString()} found for "${result.query}". Values are per 100 g or 100 ml.`}
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
                                            {food.nutrients.kcal === null ? 'No nutrition values on record' : describeLabel(food)}
                                        </Typography>
                                        {extras && (
                                            <Typography variant="caption" color="text.secondary" component="div">
                                                Also: {extras}
                                            </Typography>
                                        )}
                                    </Box>
                                    {added ? (
                                        <Chip size="small" label="In your foods" />
                                    ) : (
                                        <Button size="small" startIcon={<AddIcon />} onClick={() => onAdd(food)} sx={{ flexShrink: 0 }}>
                                            Add
                                        </Button>
                                    )}
                                </Paper>
                            )
                        })}
                    </Stack>
                    {result.search.page < result.search.pageCount && (
                        <Box sx={{ textAlign: 'center', mt: 2 }}>
                            <Button onClick={showMore} disabled={loading}>{loading ? 'Loading…' : 'Show more'}</Button>
                        </Box>
                    )}
                </>
            )}
        </>
    )
}
