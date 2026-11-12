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
import { locale, useT } from '../../i18n'

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
    return date.toLocaleDateString(locale(), { day: 'numeric', month: 'short' })
}

function formatDate(key: string) {
    return parseDateKey(key).toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function signed(n: number, digits = 1) {
    return `${n > 0 ? '+' : ''}${formatNumber(n, digits)}`
}

export default function NutritionProgress({ goals, weights, onGoalsChange, onWeightsChange }: Props) {
    const m = useT()
    const p = m.nutrition.progress
    const kg = m.units.kg
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
                <Typography variant="h6" sx={{ flexGrow: 1 }}>{p.dailyGoals}</Typography>
                <Button startIcon={<EditIcon />} onClick={() => setGoalsOpen(true)}>{p.editGoals}</Button>
            </Box>
            <Box sx={{ ...tileGrid, mt: 1 }}>
                {NUTRIENTS.map(({ key, label }) => {
                    const goal = goals?.[key] ?? null
                    return (
                        <StatTile
                            key={key}
                            label={label}
                            value={goal !== null ? formatNutrientWithUnit(goal, key) : '–'}
                            detail={goal !== null ? p.perDay : p.noGoal}
                        />
                    )
                })}
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, mt: 4 }}>
                <Typography variant="h6" sx={{ flexGrow: 1 }}>{p.intake}</Typography>
                <ToggleButtonGroup size="small" exclusive value={range} onChange={(_, value: Range | null) => value && setRange(value)}>
                    {RANGES.map((r) => (
                        <ToggleButton key={r} value={r} sx={{ textTransform: 'none' }}>{p.days(r)}</ToggleButton>
                    ))}
                </ToggleButtonGroup>
            </Box>

            {log === undefined ? (
                <Typography sx={{ mt: 1 }}>{m.common.loading}</Typography>
            ) : log === null ? (
                <Typography color="error" sx={{ mt: 1 }}>{p.failedToLoadLog}</Typography>
            ) : days.length === 0 ? (
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                    {p.nothingLogged(range)}
                </Typography>
            ) : (
                <>
                    <Box sx={{ ...tileGrid, mt: 1.5 }}>
                        <StatTile label={p.daysLogged} value={`${days.length} / ${range}`} />
                        <StatTile
                            label={p.avgCalories}
                            value={`${formatNutrient(average!.kcal, 'kcal')} ${m.units.kcal}`}
                            detail={kcalGoal ? p.vsGoal(signed(average!.kcal - kcalGoal, 0)) : undefined}
                        />
                        <StatTile
                            label={p.avgProtein}
                            value={`${formatNutrient(average!.protein, 'protein')} ${m.units.g}`}
                            detail={proteinGoal ? p.vsGoal(`${signed(average!.protein - proteinGoal, 0)} ${m.units.g}`) : undefined}
                        />
                        {kcalOnTarget !== null && (
                            <StatTile
                                label={p.caloriesOnTarget}
                                value={`${kcalOnTarget} / ${days.length}`}
                                detail={p.daysWithin(KCAL_TOLERANCE * 100)}
                            />
                        )}
                        {proteinReached !== null && (
                            <StatTile label={p.proteinReached} value={`${proteinReached} / ${days.length}`} detail={p.daysWord} />
                        )}
                        <StatTile label={p.avgFiber} value={`${formatNutrient(average!.fiber, 'fiber')} ${m.units.g}`} />
                    </Box>

                    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 500, flexGrow: 1 }}>
                                {p.perDayChart(metricInfo.label)}
                            </Typography>
                            <ToggleButtonGroup size="small" exclusive value={metric} onChange={(_, value: NutrientKey | null) => value && setMetric(value)}>
                                {NUTRIENTS.map((n) => (
                                    <ToggleButton key={n.key} value={n.key} sx={{ textTransform: 'none' }}>{n.label}</ToggleButton>
                                ))}
                            </ToggleButtonGroup>
                        </Box>
                        {intakePoints.length < 2 ? (
                            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                                {p.needTwoDays}
                            </Typography>
                        ) : (
                            <TrendChart
                                points={intakePoints}
                                formatValue={(y) => formatNutrientWithUnit(y, metric)}
                                formatTick={(p) => formatShortDate(new Date(p.x))}
                                ariaLabel={p.perDayChart(metricInfo.label)}
                                reference={metricGoal != null ? { value: metricGoal, label: p.goal } : undefined}
                            />
                        )}
                    </Paper>
                </>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 4 }}>
                <Typography variant="h6" sx={{ flexGrow: 1 }}>{p.bodyWeight}</Typography>
                <Button startIcon={<AddIcon />} onClick={() => setWeighIn('new')}>{p.addWeighIn}</Button>
            </Box>
            <Typography variant="body2" color="text.secondary">
                {p.weighedWeekly}
            </Typography>

            {weights.length === 0 ? (
                <Typography color="text.secondary" sx={{ mt: 1 }}>{p.noWeighIns}</Typography>
            ) : (
                <>
                    <Box sx={{ ...tileGrid, mt: 1.5 }}>
                        <StatTile label={p.current} value={`${formatNumber(latest.kg, 1)} ${kg}`} detail={formatDate(latest.date)} />
                        {weights.length > 1 && (
                            <StatTile label={p.sinceFirstWeighIn} value={`${signed(latest.kg - first.kg)} ${kg}`} detail={formatDate(first.date)} />
                        )}
                        {monthAgo && (
                            <StatTile label={p.last4Weeks} value={`${signed(latest.kg - monthAgo.kg)} ${kg}`} detail={p.fromWeight(`${formatNumber(monthAgo.kg, 1)} ${kg}`)} />
                        )}
                    </Box>

                    {weightPoints.length >= 2 && (
                        <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 1 }}>{p.weightPerWeek}</Typography>
                            <TrendChart
                                points={weightPoints}
                                formatValue={(y) => `${formatNumber(y, 1)} ${kg}`}
                                formatTick={(p) => formatShortDate(new Date(p.x))}
                                ariaLabel={p.weightChartAria}
                            />
                        </Paper>
                    )}

                    <Paper variant="outlined" sx={{ mt: 2, overflowX: 'auto' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>{p.weekOf}</TableCell>
                                    <TableCell align="right">{m.common.weight}</TableCell>
                                    <TableCell align="right">{p.change}</TableCell>
                                    <TableCell>{m.common.notes}</TableCell>
                                    <TableCell />
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {weights.map((w, i) => ({ w, prev: weights[i - 1] })).reverse().map(({ w, prev }) => (
                                    <TableRow key={w.id}>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(w.date)}</TableCell>
                                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{formatNumber(w.kg, 1)} {kg}</TableCell>
                                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{prev ? `${signed(w.kg - prev.kg)} ${kg}` : '–'}</TableCell>
                                        <TableCell>{w.notes}</TableCell>
                                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                            <IconButton size="small" aria-label={p.editWeighIn} onClick={() => setWeighIn(w)}>
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
    const m = useT()
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
            if (value !== null && !(value >= 0)) return setError(m.nutrition.foods.mustBeZeroOrMore(label))
            parsed[key] = value
        }
        setSaving(true)
        setError(null)
        const res = await saveGoals(parsed)
        setSaving(false)
        if (!res) return setError(m.nutrition.progress.failedToSaveGoals)
        onSaved()
        onClose()
    }

    return (
        <Dialog open onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>{m.nutrition.progress.dailyGoals}</DialogTitle>
            <form onSubmit={handleSubmit}>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{m.nutrition.progress.leaveEmptyForNoGoal}</Typography>
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
                    <Button onClick={onClose} disabled={saving}>{m.common.cancel}</Button>
                    <Button type="submit" variant="contained" disabled={saving}>{saving ? m.common.saving : m.common.save}</Button>
                </DialogActions>
            </form>
        </Dialog>
    )
}

function WeighInDialog({ existing, onClose, onSaved }: { existing: BodyWeightRow | null; onClose: () => void; onSaved: () => void }) {
    const m = useT()
    // A new weigh-in is for this week's Monday
    const [date, setDate] = useState(existing?.date ?? dayKey(startOfWeek(new Date())))
    const [kg, setKg] = useState(existing ? String(existing.kg) : '')
    const [notes, setNotes] = useState(existing?.notes ?? '')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        const value = Number(kg)
        if (!date) return setError(m.nutrition.progress.chooseDate)
        if (!(value > 0)) return setError(m.nutrition.progress.enterWeight)
        setSaving(true)
        setError(null)
        // Moving a weigh-in to another date replaces whatever is on that date
        const ok = await saveBodyWeight(date, value, notes.trim() || null)
            && (!existing || existing.date === date || await deleteBodyWeight(existing.id))
        setSaving(false)
        if (!ok) return setError(m.common.failedToSave)
        onSaved()
        onClose()
    }

    async function handleDelete() {
        if (!existing || !window.confirm(m.nutrition.progress.deleteWeighInConfirm)) return
        setSaving(true)
        const ok = await deleteBodyWeight(existing.id)
        setSaving(false)
        if (!ok) return setError(m.common.failedToDelete)
        onSaved()
        onClose()
    }

    return (
        <Dialog open onClose={onClose} fullWidth maxWidth="xs">
            <DialogTitle>{existing ? m.nutrition.progress.editWeighIn : m.nutrition.progress.addWeighIn}</DialogTitle>
            <form onSubmit={handleSubmit}>
                <DialogContent>
                    <TextField
                        label={m.common.date}
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        fullWidth
                        required
                        InputLabelProps={{ shrink: true }}
                        helperText={date && parseDateKey(date).getDay() !== 1 ? m.nutrition.progress.notMonday : undefined}
                        sx={{ mt: 1, mb: 2 }}
                    />
                    <TextField
                        label={m.common.weight}
                        type="number"
                        value={kg}
                        onChange={(e) => setKg(e.target.value)}
                        fullWidth
                        required
                        inputProps={{ min: 0, step: 0.1, inputMode: 'decimal' }}
                        InputProps={{ endAdornment: <InputAdornment position="end">{m.units.kg}</InputAdornment> }}
                        sx={{ mb: 2 }}
                    />
                    <TextField label={m.common.notes} value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth />
                    {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}
                </DialogContent>
                <DialogActions>
                    {existing && (
                        <IconButton aria-label={m.nutrition.progress.deleteWeighIn} color="error" onClick={handleDelete} disabled={saving} sx={{ mr: 'auto' }}>
                            <DeleteIcon />
                        </IconButton>
                    )}
                    <Button onClick={onClose} disabled={saving}>{m.common.cancel}</Button>
                    <Button type="submit" variant="contained" disabled={saving}>{saving ? m.common.saving : m.common.save}</Button>
                </DialogActions>
            </form>
        </Dialog>
    )
}
