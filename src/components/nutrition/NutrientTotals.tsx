import { useState } from 'react'
import { Box, Collapse, Divider, IconButton, LinearProgress, Paper, Tooltip, Typography } from '@mui/material'
import { ExpandLess as ExpandLessIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material'
import { NUTRIENTS, formatNutrient, sumNutrients, type Nutrients } from '../../lib/nutrition'
import type { NutritionGoalsRow } from '../../types/entityTypes'

// One food of the day, with what it brings. Several with the same key (the same food in two
// meals) are added up into one line.
export type NutrientSource = {
    key: string
    name: string
    nutrients: Nutrients
}

type Props = {
    totals: Nutrients
    goals: NutritionGoalsRow | null
    // When given, each tile lists the foods behind its total, biggest first
    sources?: NutrientSource[]
}

function mergeSources(sources: NutrientSource[]) {
    const byKey = new Map<string, NutrientSource>()
    for (const s of sources) {
        const prev = byKey.get(s.key)
        byKey.set(s.key, prev ? { ...prev, nutrients: sumNutrients([prev.nutrients, s.nutrients]) } : s)
    }
    return [...byKey.values()]
}

// Whether the food lists are open is remembered across visits and shared by Today and Plan
const OPEN_KEY = 'nutrientTotals.showFoods'

function readOpen() {
    try {
        return localStorage.getItem(OPEN_KEY) !== 'false'
    } catch {
        return true
    }
}

// A day's totals against the goals, one tile per nutrient
export default function NutrientTotals({ totals, goals, sources }: Props) {
    const merged = sources ? mergeSources(sources) : []
    const [open, setOpen] = useState(readOpen)
    const hasFoods = merged.length > 0

    function toggle() {
        const next = !open
        setOpen(next)
        try {
            localStorage.setItem(OPEN_KEY, String(next))
        } catch {
            // Not remembered then; it still toggles
        }
    }

    return (
        <>
        {hasFoods && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5 }}>
                <Tooltip title={open ? 'Hide foods' : 'Show foods'}>
                    <IconButton
                        size="small"
                        onClick={toggle}
                        aria-label={open ? 'Hide foods' : 'Show foods'}
                        aria-expanded={open}
                    >
                        {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                </Tooltip>
            </Box>
        )}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 1.5 }}>
            {NUTRIENTS.map(({ key, label, unit }) => {
                const value = totals[key]
                const goal = goals?.[key] ?? null
                const diff = goal !== null ? goal - value : null
                // Foods that bring none of this nutrient are left out
                const ranked = merged
                    .filter((s) => s.nutrients[key] > 0)
                    .sort((a, b) => b.nutrients[key] - a.nutrients[key])

                return (
                    <Paper key={key} variant="outlined" sx={{ p: 1.5 }}>
                        <Typography variant="body2" color="text.secondary">{label}</Typography>
                        <Typography variant="h6" component="div">
                            {formatNutrient(value, key)}
                            <Typography component="span" variant="body2" color="text.secondary">
                                {goal !== null ? ` / ${formatNutrient(goal, key)} ${unit}` : ` ${unit}`}
                            </Typography>
                        </Typography>
                        {goal !== null && goal > 0 && (
                            <LinearProgress
                                variant="determinate"
                                value={Math.min(100, (value / goal) * 100)}
                                aria-label={`${label} against goal`}
                                sx={{ my: 0.75, height: 6, borderRadius: 3 }}
                            />
                        )}
                        <Typography variant="caption" color="text.secondary">
                            {diff === null
                                ? 'No goal'
                                : diff >= 0
                                    ? `${formatNutrient(diff, key)} ${unit} left`
                                    : `${formatNutrient(-diff, key)} ${unit} over`}
                        </Typography>

                        {ranked.length > 0 && (
                            <Collapse in={open}>
                                <Divider sx={{ my: 1 }} />
                                <Box component="ol" aria-label={`${label} by food`} sx={{ m: 0, p: 0, listStyle: 'none' }}>
                                    {ranked.map((s) => (
                                        <Box
                                            component="li"
                                            key={s.key}
                                            sx={{ display: 'flex', alignItems: 'baseline', gap: 1, py: 0.25 }}
                                        >
                                            <Typography variant="caption" noWrap title={s.name} sx={{ flex: 1, minWidth: 0 }}>
                                                {s.name}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                                                {formatNutrient(s.nutrients[key], key)} {unit}
                                            </Typography>
                                        </Box>
                                    ))}
                                </Box>
                            </Collapse>
                        )}
                    </Paper>
                )
            })}
        </Box>
        </>
    )
}
