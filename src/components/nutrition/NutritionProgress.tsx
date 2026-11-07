import { useEffect, useMemo, useState } from 'react'
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    InputAdornment,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material'
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material'
import TrendChart, { type TrendPoint } from '../TrendChart'
import { deleteBodyWeight, getFoodLog, saveBodyWeight, saveGoals } from '../../services/nutrition'
import {
    NUTRIENTS,
    addDays,
    formatNutrient,
    formatNutrientWithUnit,
    parseDateKey,
    sumNutrients,
    type NutrientKey,
    type Nutrients,
} from '../../lib/nutrition'
import { dayKey, formatNumber, startOfWeek } from '../../lib/workoutStats'
import type { BodyWeightRow, FoodLogRow, NutritionGoalsRow } from '../../types/entityTypes'

type Props = {
    goals: NutritionGoalsRow | null
    weights: BodyWeightRow[]
    onGoalsChange: () => void
    onWeightsChange: () => void
}

const RANGES = [7, 30, 90] as const
type Range = (typeof RANGES)[number]

// Within this share of the calorie goal counts as on target
const KCAL_TOLERANCE = 0.1

function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
    return (
        <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Typography variant="body2" color="text.secondary">{label}</Typography>
            <Typography variant="h5" sx={{ mt: 0.5 }}>{value}</Typography>
            {detail && <Typography variant="caption" color="text.secondary">{detail}</Typography>}
        </Paper>
    )
}

const tileGrid = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: 1.5,
}

function formatShortDate(date: Date) {
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function formatDate(key: string) {
    return parseDateKey(key).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function signed(n: number, digits = 1) {
    return `${n > 0 ? '+' : ''}${formatNumber(n, digits)}`
}

export default function NutritionProgress({ goals, weights, onGoalsChange, onWeightsChange }: Props) {
    const today = dayKey(new Date())
    const [range, setRange] = useState<Range>(30)
    const [metric, setMetric] = useState<NutrientKey>('kcal')
    // The log of the longest range, fetched once; the shorter ranges are cut from it
    const [log, setLog] = useState<FoodLogRow[] | null | undefined>(undefined)
    const [goalsOpen, setGoalsOpen] = useState(false)
    const [weighIn, setWeighIn] = useState<BodyWeightRow | 'new' | null>(null)

    useEffect(() => {
        let cancelled = false
        const from = dayKey(addDays(today, -(RANGES[RANGES.length - 1] - 1)))
        getFoodLog(from, today).then((rows) => {
            if (!cancelled) setLog(rows)
        })
        return () => {
            cancelled = true
        }
    }, [today])

    // Totals of every logged day in the range, oldest first. Days without anything logged are
    // left out rather than counted as zero, since that is a day not tracked, not a day not eaten.
    const days = useMemo(() => {
        const from = dayKey(addDays(today, -(range - 1)))
        const byDay = new Map<string, Nutrients[]>()
        for (const row of log ?? []) {
            if (row.date < from) continue
            const list = byDay.get(row.date) ?? []
            list.push(row)
            byDay.set(row.date, list)
        }
        return [...byDay.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, list]) => ({ date, totals: sumNutrients(list) }))
    }, [log, range, today])

    const average = days.length > 0 ? sumNutrients(days.map((d) => d.totals)) : null
    if (average) for (const { key } of NUTRIENTS) average[key] /= days.length

    const kcalGoal = goals?.kcal ?? null
    const proteinGoal = goals?.protein ?? null
    const kcalOnTarget = kcalGoal
        ? days.filter((d) => Math.abs(d.totals.kcal - kcalGoal) <= kcalGoal * KCAL_TOLERANCE).length
        : null
    const proteinReached = proteinGoal ? days.filter((d) => d.totals.protein >= proteinGoal).length : null

    const metricInfo = NUTRIENTS.find((n) => n.key === metric)!
    const metricGoal = goals?.[metric] ?? null
    const intakePoints: TrendPoint[] = days.map((d) => ({
        x: parseDateKey(d.date).getTime(),
        y: d.totals[metric],
        label: formatDate(d.date),
    }))

    const weightPoints: TrendPoint[] = weights.map((w) => ({ x: parseDateKey(w.date).getTime(), y: w.kg, label: formatDate(w.date) }))
    const latest = weights[weights.length - 1]
    const first = weights[0]
    // The weigh-in closest to four weeks before the latest one, at most that far back
    const fourWeeksBefore = latest ? dayKey(addDays(latest.date, -28)) : null
    const monthAgo = fourWeeksBefore ? weights.findLast((w) => w.date <= fourWeeksBefore) : undefined

    return (
        <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="h6" sx={{ flexGrow: 1 }}>Daily goals</Typography>
                <Button startIcon={<EditIcon />} onClick={() => setGoalsOpen(true)}>Edit goals</Button>
            </Box>
            <Box sx={{ ...tileGrid, mt: 1 }}>
                {NUTRIENTS.map(({ key, label }) => {
                    const goal = goals?.[key] ?? null
                    return (
                        <StatTile
                            key={key}
                            label={label}
                            value={goal !== null ? formatNutrientWithUnit(goal, key) : '–'}
                            detail={goal !== null ? 'per day' : 'no goal'}
                        />
                    )
                })}
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, mt: 4 }}>
                <Typography variant="h6" sx={{ flexGrow: 1 }}>Intake</Typography>
                <ToggleButtonGroup size="small" exclusive value={range} onChange={(_, value: Range | null) => value && setRange(value)}>
                    {RANGES.map((r) => (
                        <ToggleButton key={r} value={r} sx={{ textTransform: 'none' }}>{r} days</ToggleButton>
                    ))}
                </ToggleButtonGroup>
            </Box>

            {log === undefined ? (
                <Typography sx={{ mt: 1 }}>Loading...</Typography>
            ) : log === null ? (
                <Typography color="error" sx={{ mt: 1 }}>Failed to load your food log.</Typography>
            ) : days.length === 0 ? (
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                    Nothing logged in the last {range} days. Log what you eat in the Today tab.
                </Typography>
            ) : (
                <>
                    <Box sx={{ ...tileGrid, mt: 1.5 }}>
                        <StatTile label="Days logged" value={`${days.length} / ${range}`} />
                        <StatTile
                            label="Average calories"
                            value={`${formatNutrient(average!.kcal, 'kcal')} kcal`}
                            detail={kcalGoal ? `${signed(average!.kcal - kcalGoal, 0)} vs goal` : undefined}
                        />
                        <StatTile
                            label="Average protein"
                            value={`${formatNutrient(average!.protein, 'protein')} g`}
                            detail={proteinGoal ? `${signed(average!.protein - proteinGoal, 0)} g vs goal` : undefined}
                        />
                        {kcalOnTarget !== null && (
                            <StatTile
                                label="Calories on target"
                                value={`${kcalOnTarget} / ${days.length}`}
                                detail={`days within ±${KCAL_TOLERANCE * 100}%`}
                            />
                        )}
                        {proteinReached !== null && (
                            <StatTile label="Protein goal reached" value={`${proteinReached} / ${days.length}`} detail="days" />
                        )}
                        <StatTile label="Average fiber" value={`${formatNutrient(average!.fiber, 'fiber')} g`} />
                    </Box>

                    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 500, flexGrow: 1 }}>
                                {metricInfo.label} per day
                            </Typography>
                            <ToggleButtonGroup size="small" exclusive value={metric} onChange={(_, value: NutrientKey | null) => value && setMetric(value)}>
                                {NUTRIENTS.map((n) => (
                                    <ToggleButton key={n.key} value={n.key} sx={{ textTransform: 'none' }}>{n.label}</ToggleButton>
                                ))}
                            </ToggleButtonGroup>
                        </Box>
                        {intakePoints.length < 2 ? (
                            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                                Log at least two days to see a trend.
                            </Typography>
                        ) : (
                            <TrendChart
                                points={intakePoints}
                                formatValue={(y) => formatNutrientWithUnit(y, metric)}
                                formatTick={(p) => formatShortDate(new Date(p.x))}
                                ariaLabel={`${metricInfo.label} per day`}
                                reference={metricGoal != null ? { value: metricGoal, label: 'Goal' } : undefined}
                            />
                        )}
                    </Paper>
                </>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 4 }}>
                <Typography variant="h6" sx={{ flexGrow: 1 }}>Body weight</Typography>
                <Button startIcon={<AddIcon />} onClick={() => setWeighIn('new')}>Add weigh-in</Button>
            </Box>
            <Typography variant="body2" color="text.secondary">
                Weighed once a week, on Monday. The Today tab asks for it on Mondays.
            </Typography>

            {weights.length === 0 ? (
                <Typography color="text.secondary" sx={{ mt: 1 }}>No weigh-ins yet.</Typography>
            ) : (
                <>
                    <Box sx={{ ...tileGrid, mt: 1.5 }}>
                        <StatTile label="Current" value={`${formatNumber(latest.kg, 1)} kg`} detail={formatDate(latest.date)} />
                        {weights.length > 1 && (
                            <StatTile label="Since first weigh-in" value={`${signed(latest.kg - first.kg)} kg`} detail={formatDate(first.date)} />
                        )}
                        {monthAgo && (
                            <StatTile label="Last 4 weeks" value={`${signed(latest.kg - monthAgo.kg)} kg`} detail={`from ${formatNumber(monthAgo.kg, 1)} kg`} />
                        )}
                    </Box>

                    {weightPoints.length >= 2 && (
                        <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 1 }}>Weight per week</Typography>
                            <TrendChart
                                points={weightPoints}
                                formatValue={(y) => `${formatNumber(y, 1)} kg`}
                                formatTick={(p) => formatShortDate(new Date(p.x))}
                                ariaLabel="Body weight per week"
                            />
                        </Paper>
                    )}

                    <Paper variant="outlined" sx={{ mt: 2, overflowX: 'auto' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Week of</TableCell>
                                    <TableCell align="right">Weight</TableCell>
                                    <TableCell align="right">Change</TableCell>
                                    <TableCell>Notes</TableCell>
                                    <TableCell />
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {weights.map((w, i) => ({ w, prev: weights[i - 1] })).reverse().map(({ w, prev }) => (
                                    <TableRow key={w.id}>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(w.date)}</TableCell>
                                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{formatNumber(w.kg, 1)} kg</TableCell>
                                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{prev ? `${signed(w.kg - prev.kg)} kg` : '–'}</TableCell>
                                        <TableCell>{w.notes}</TableCell>
                                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                            <IconButton size="small" aria-label="Edit weigh-in" onClick={() => setWeighIn(w)}>
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Paper>
                </>
            )}

            {goalsOpen && <GoalsDialog goals={goals} onClose={() => setGoalsOpen(false)} onSaved={onGoalsChange} />}
            {weighIn && (
                <WeighInDialog
                    existing={weighIn === 'new' ? null : weighIn}
                    onClose={() => setWeighIn(null)}
                    onSaved={onWeightsChange}
                />
            )}
        </>
    )
}

function GoalsDialog({ goals, onClose, onSaved }: { goals: NutritionGoalsRow | null; onClose: () => void; onSaved: () => void }) {
    const [values, setValues] = useState<Record<NutrientKey, string>>(() =>
        Object.fromEntries(NUTRIENTS.map(({ key }) => [key, String(goals?.[key] ?? '')])) as Record<NutrientKey, string>
    )
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        const parsed = {} as Record<NutrientKey, number | null>
        for (const { key, label } of NUTRIENTS) {
            // Empty means no goal
            const value = values[key] === '' ? null : Number(values[key])
            if (value !== null && !(value >= 0)) return setError(`${label} must be 0 or more`)
            parsed[key] = value
        }
        setSaving(true)
        setError(null)
        const res = await saveGoals(parsed)
        setSaving(false)
        if (!res) return setError('Failed to save goals')
        onSaved()
        onClose()
    }

    return (
        <Dialog open onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Daily goals</DialogTitle>
            <form onSubmit={handleSubmit}>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Leave a value empty for no goal.</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 1.5 }}>
                        {NUTRIENTS.map(({ key, label, unit }) => (
                            <TextField
                                key={key}
                                label={label}
                                type="number"
                                value={values[key]}
                                onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
                                inputProps={{ min: 0, step: 'any', inputMode: 'decimal' }}
                                InputProps={{ endAdornment: <InputAdornment position="end">{unit}</InputAdornment> }}
                            />
                        ))}
                    </Box>
                    {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button type="submit" variant="contained" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
                </DialogActions>
            </form>
        </Dialog>
    )
}

function WeighInDialog({ existing, onClose, onSaved }: { existing: BodyWeightRow | null; onClose: () => void; onSaved: () => void }) {
    // A new weigh-in is for this week's Monday
    const [date, setDate] = useState(existing?.date ?? dayKey(startOfWeek(new Date())))
    const [kg, setKg] = useState(existing ? String(existing.kg) : '')
    const [notes, setNotes] = useState(existing?.notes ?? '')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        const value = Number(kg)
        if (!date) return setError('Choose a date')
        if (!(value > 0)) return setError('Enter your weight in kg')
        setSaving(true)
        setError(null)
        // Moving a weigh-in to another date replaces whatever is on that date
        const ok = await saveBodyWeight(date, value, notes.trim() || null)
            && (!existing || existing.date === date || await deleteBodyWeight(existing.id))
        setSaving(false)
        if (!ok) return setError('Failed to save')
        onSaved()
        onClose()
    }

    async function handleDelete() {
        if (!existing || !window.confirm('Delete this weigh-in?')) return
        setSaving(true)
        const ok = await deleteBodyWeight(existing.id)
        setSaving(false)
        if (!ok) return setError('Failed to delete')
        onSaved()
        onClose()
    }

    return (
        <Dialog open onClose={onClose} fullWidth maxWidth="xs">
            <DialogTitle>{existing ? 'Edit weigh-in' : 'Add weigh-in'}</DialogTitle>
            <form onSubmit={handleSubmit}>
                <DialogContent>
                    <TextField
                        label="Date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        fullWidth
                        required
                        InputLabelProps={{ shrink: true }}
                        helperText={date && parseDateKey(date).getDay() !== 1 ? 'Not a Monday' : undefined}
                        sx={{ mt: 1, mb: 2 }}
                    />
                    <TextField
                        label="Weight"
                        type="number"
                        value={kg}
                        onChange={(e) => setKg(e.target.value)}
                        fullWidth
                        required
                        inputProps={{ min: 0, step: 0.1, inputMode: 'decimal' }}
                        InputProps={{ endAdornment: <InputAdornment position="end">kg</InputAdornment> }}
                        sx={{ mb: 2 }}
                    />
                    <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth />
                    {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}
                </DialogContent>
                <DialogActions>
                    {existing && (
                        <IconButton aria-label="Delete weigh-in" color="error" onClick={handleDelete} disabled={saving} sx={{ mr: 'auto' }}>
                            <DeleteIcon />
                        </IconButton>
                    )}
                    <Button onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button type="submit" variant="contained" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
                </DialogActions>
            </form>
        </Dialog>
    )
}
