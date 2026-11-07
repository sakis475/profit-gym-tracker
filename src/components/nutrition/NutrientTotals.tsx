import { Box, LinearProgress, Paper, Typography } from '@mui/material'
import { NUTRIENTS, formatNutrient, type Nutrients } from '../../lib/nutrition'
import type { NutritionGoalsRow } from '../../types/entityTypes'

type Props = {
    totals: Nutrients
    goals: NutritionGoalsRow | null
}

// A day's totals against the goals, one tile per nutrient
export default function NutrientTotals({ totals, goals }: Props) {
    return (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 1.5 }}>
            {NUTRIENTS.map(({ key, label, unit }) => {
                const value = totals[key]
                const goal = goals?.[key] ?? null
                const diff = goal !== null ? goal - value : null

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
                    </Paper>
                )
            })}
        </Box>
    )
}
