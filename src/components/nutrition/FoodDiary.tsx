import { useEffect, useState } from 'react'
import {
    Box,
    Button,
    Checkbox,
    IconButton,
    InputAdornment,
    Paper,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material'
import {
    Add as AddIcon,
    ChevronLeft as PrevIcon,
    ChevronRight as NextIcon,
    Close as CloseIcon,
    DoneAll as DoneAllIcon,
    Edit as EditIcon,
    MonitorWeight as WeightIcon,
} from '@mui/icons-material'
import {
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from '@dnd-kit/core'
import { createFoodLogs, deleteFoodLog, getFoodLog, saveBodyWeight, updateFoodLog } from '../../services/nutrition'
import {
    addDays,
    defaultQuantity,
    describeNutrients,
    foodNutrients,
    formatNutrient,
    formatQuantity,
    parseDateKey,
    scaleNutrients,
    sumNutrients,
    type Nutrients,
} from '../../lib/nutrition'
import { dayKey, formatNumber } from '../../lib/workoutStats'
import type {
    BodyWeightRow,
    FoodLogWithFood,
    FoodRow,
    MealPlanWithFood,
    MealRow,
    NutritionGoalsRow,
} from '../../types/entityTypes'
import NutrientTotals from './NutrientTotals'
import FoodEntryDialog, { type FoodEntry } from './FoodEntryDialog'
import { MealDropZone, QuantityInput, WithFoodSidebar, type FoodDragData } from './FoodDnd'
import { DragPreview } from '../DragSidebar'

type Props = {
    plan: MealPlanWithFood[]
    meals: MealRow[]
    foods: FoodRow[]
    goals: NutritionGoalsRow | null
    weights: BodyWeightRow[]
    onWeightsChange: () => void
}

// What the entry dialog does: add a food to a meal, or change something already logged
type EntryDialog =
    | { kind: 'add'; mealId?: string }
    | { kind: 'edit'; log: FoodLogWithFood; planned: boolean }

const MONDAY = 1

function logNutrients(l: FoodLogWithFood): Nutrients {
    return { kcal: l.kcal, protein: l.protein, carbs: l.carbs, fat: l.fat, fiber: l.fiber }
}

function formatDay(key: string) {
    return parseDateKey(key).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function FoodDiary({ plan, meals, foods, goals, weights, onWeightsChange }: Props) {
    const today = dayKey(new Date())
    const [date, setDate] = useState(today)
    const [log, setLog] = useState<{ date: string; rows: FoodLogWithFood[] | null } | null>(null)
    const [reload, setReload] = useState(0)
    const [entry, setEntry] = useState<EntryDialog | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [dragging, setDragging] = useState<FoodDragData | null>(null)
    // The food just dropped in, whose amount field takes the focus once it shows up
    const [focusId, setFocusId] = useState<string | null>(null)
    const sensors = useSensors(
        // A few pixels of movement before a drag starts, so clicks still work
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor)
    )

    useEffect(() => {
        let cancelled = false
        getFoodLog(date, date).then((rows) => {
            if (!cancelled) setLog({ date, rows })
        })
        return () => {
            cancelled = true
        }
    }, [date, reload])

    const loading = log?.date !== date
    const rows = (!loading && log.rows) || []
    const weekday = parseDateKey(date).getDay()
    const dayPlan = plan.filter((p) => p.day === weekday)
    const planIds = new Set(dayPlan.map((p) => p.id))
    const logByPlan = new Map(rows.filter((l) => l.planId && planIds.has(l.planId)).map((l) => [l.planId, l]))
    // Logged foods that are not one of this day's planned ones
    const extras = rows.filter((l) => !l.planId || !planIds.has(l.planId))
    const mealIds = new Set(meals.map((m) => m.id))
    const orphanExtras = extras.filter((l) => !mealIds.has(l.mealId))

    const totals = sumNutrients(rows.map(logNutrients))
    const planTotals = sumNutrients(dayPlan.map((p) => foodNutrients(p.foods, p.quantity)))
    const unlogged = dayPlan.filter((p) => !logByPlan.has(p.id))

    async function run(action: () => Promise<boolean>, message: string) {
        setBusy(true)
        setError(null)
        const ok = await action()
        setBusy(false)
        if (!ok) setError(message)
        setReload((n) => n + 1)
        return ok
    }

    function logPlanned(items: MealPlanWithFood[], quantity?: number) {
        return run(
            async () => !!(await createFoodLogs(items.map((p) => ({
                date,
                mealId: p.mealId,
                foodId: p.foodId,
                planId: p.id,
                quantity: quantity ?? p.quantity,
                ...foodNutrients(p.foods, quantity ?? p.quantity),
            })))),
            'Failed to log'
        )
    }

    function togglePlanned(item: MealPlanWithFood) {
        const logged = logByPlan.get(item.id)
        if (logged) run(() => deleteFoodLog(logged.id), 'Failed to remove')
        else logPlanned([item])
    }

    // A new amount for something logged. The values are rescaled from what was logged, so they
    // keep the food's values from when it was logged.
    function changeLogged(l: FoodLogWithFood, quantity: number) {
        return run(
            () => updateFoodLog(l.id, { quantity, ...scaleNutrients(logNutrients(l), quantity / l.quantity) }),
            'Failed to save'
        )
    }

    async function saveEntry({ mealId, foodId, quantity }: FoodEntry, food: FoodRow) {
        if (!entry) return null
        const values = { mealId, foodId, quantity, ...foodNutrients(food, quantity) }
        const ok = await run(
            async () => entry.kind === 'edit'
                ? updateFoodLog(entry.log.id, values)
                : !!(await createFoodLogs([{ ...values, date, planId: null }])),
            'Failed to save'
        )
        if (!ok) return 'Failed to save'
        setEntry(null)
        return null
    }

    async function handleDragEnd({ active, over }: DragEndEvent) {
        setDragging(null)
        const mealId = over?.data.current?.mealId as string | undefined
        const data = active.data.current as FoodDragData | undefined
        if (!mealId || data?.kind !== 'food') return

        const quantity = defaultQuantity(data.food.unit)
        setBusy(true)
        setError(null)
        const ids = await createFoodLogs([
            { date, mealId, foodId: data.food.id, planId: null, quantity, ...foodNutrients(data.food, quantity) },
        ])
        setBusy(false)
        if (!ids) setError(`Failed to log ${data.food.name}`)
        else setFocusId(ids[0])
        setReload((n) => n + 1)
    }

    function renderExtra(l: FoodLogWithFood) {
        return (
            <DiaryRow
                key={`${l.id}:${l.quantity}`}
                name={l.foods?.name ?? 'Deleted food'}
                unit={l.foods?.unit ?? ''}
                quantity={l.quantity}
                nutrients={logNutrients(l)}
                logged
                note="not planned"
                busy={busy}
                autoFocus={l.id === focusId}
                onBlurred={() => setFocusId(null)}
                onToggle={() => run(() => deleteFoodLog(l.id), 'Failed to remove')}
                onCommit={(q) => changeLogged(l, q)}
                onEdit={() => setEntry({ kind: 'edit', log: l, planned: false })}
            />
        )
    }

    return (
        <DndContext
            sensors={sensors}
            onDragStart={({ active }: DragStartEvent) => setDragging((active.data.current as FoodDragData | undefined) ?? null)}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setDragging(null)}
        >
            <WithFoodSidebar foods={foods}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <IconButton aria-label="Previous day" onClick={() => setDate(dayKey(addDays(date, -1)))}>
                        <PrevIcon />
                    </IconButton>
                    <TextField
                        size="small"
                        type="date"
                        value={date}
                        onChange={(e) => e.target.value && setDate(e.target.value)}
                        inputProps={{ 'aria-label': 'Date' }}
                    />
                    <IconButton aria-label="Next day" onClick={() => setDate(dayKey(addDays(date, 1)))}>
                        <NextIcon />
                    </IconButton>
                    {date !== today && <Button onClick={() => setDate(today)}>Today</Button>}
                    <Typography variant="h6" sx={{ flexGrow: 1, textAlign: 'right' }}>{formatDay(date)}</Typography>
                </Box>

                {weekday === MONDAY && (
                    <WeighIn key={date} date={date} existing={weights.find((w) => w.date === date) ?? null} onSaved={onWeightsChange} />
                )}

                {loading ? (
                    <Typography sx={{ mt: 2 }}>Loading...</Typography>
                ) : log.rows === null ? (
                    <Typography color="error" sx={{ mt: 2 }}>Failed to load this day.</Typography>
                ) : (
                    <>
                        <Box sx={{ mt: 2 }}>
                            <NutrientTotals totals={totals} goals={goals} />
                        </Box>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mt: 1.5 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                                {dayPlan.length > 0
                                    ? `Planned for this day: ${formatNutrient(planTotals.kcal, 'kcal')} kcal · ${formatNutrient(planTotals.protein, 'protein')} g protein`
                                    : 'Nothing planned for this day.'}
                            </Typography>
                            {unlogged.length > 0 && (
                                <Button startIcon={<DoneAllIcon />} onClick={() => logPlanned(unlogged)} disabled={busy}>
                                    Tick all remaining
                                </Button>
                            )}
                            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEntry({ kind: 'add' })}>
                                Add food
                            </Button>
                        </Box>
                        {error && <Typography color="error" sx={{ mt: 1 }}>{error}</Typography>}

                        <Stack spacing={2} sx={{ mt: 2 }}>
                            {meals.map((meal) => {
                                const planned = dayPlan.filter((p) => p.mealId === meal.id)
                                const mealExtras = extras.filter((l) => l.mealId === meal.id)
                                const eaten = sumNutrients([
                                    ...planned.flatMap((p) => { const l = logByPlan.get(p.id); return l ? [logNutrients(l)] : [] }),
                                    ...mealExtras.map(logNutrients),
                                ])

                                return (
                                    <MealDropZone key={meal.id} mealId={meal.id} dragging={!!dragging}>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 2 }}>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 500, flexGrow: 1 }}>{meal.name}</Typography>
                                            {(planned.length > 0 || mealExtras.length > 0) && (
                                                <Typography variant="body2" color="text.secondary">
                                                    {formatNutrient(eaten.kcal, 'kcal')} kcal · P {formatNutrient(eaten.protein, 'protein')} g
                                                </Typography>
                                            )}
                                        </Box>
                                        {planned.map((p) => {
                                            const l = logByPlan.get(p.id)
                                            return l ? (
                                                <DiaryRow
                                                    key={`${p.id}:${l.id}:${l.quantity}`}
                                                    name={p.foods.name}
                                                    unit={p.foods.unit}
                                                    quantity={l.quantity}
                                                    nutrients={logNutrients(l)}
                                                    logged
                                                    note={l.quantity !== p.quantity ? `planned ${formatQuantity(p.quantity, p.foods.unit)}` : undefined}
                                                    busy={busy}
                                                    onToggle={() => togglePlanned(p)}
                                                    onCommit={(q) => changeLogged(l, q)}
                                                    onEdit={() => setEntry({ kind: 'edit', log: l, planned: true })}
                                                />
                                            ) : (
                                                <DiaryRow
                                                    key={p.id}
                                                    name={p.foods.name}
                                                    unit={p.foods.unit}
                                                    quantity={p.quantity}
                                                    nutrients={foodNutrients(p.foods, p.quantity)}
                                                    logged={false}
                                                    busy={busy}
                                                    onToggle={() => togglePlanned(p)}
                                                    // Typing another amount for a planned food logs it with that amount
                                                    onCommit={(q) => logPlanned([p], q)}
                                                />
                                            )
                                        })}
                                        {mealExtras.map(renderExtra)}
                                        {planned.length === 0 && mealExtras.length === 0 && (
                                            <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                                                Nothing planned.
                                                {/* Only where the food list is shown */}
                                                <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}> Drag foods here.</Box>
                                            </Typography>
                                        )}
                                        <Button size="small" startIcon={<AddIcon />} onClick={() => setEntry({ kind: 'add', mealId: meal.id })} sx={{ mt: 0.5 }}>
                                            Add to {meal.name}
                                        </Button>
                                    </MealDropZone>
                                )
                            })}
                            {orphanExtras.length > 0 && (
                                <Paper variant="outlined" sx={{ p: 2 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>Other</Typography>
                                    {orphanExtras.map(renderExtra)}
                                </Paper>
                            )}
                        </Stack>
                    </>
                )}
            </WithFoodSidebar>

            <DragOverlay dropAnimation={null}>
                {dragging && <DragPreview name={dragging.food.name} />}
            </DragOverlay>

            {entry && (
                <FoodEntryDialog
                    title={entry.kind === 'add' ? 'Add food' : 'Edit logged food'}
                    submitLabel={entry.kind === 'edit' ? 'Save' : 'Log'}
                    meals={meals}
                    foods={foods}
                    lockFood={entry.kind === 'edit' && entry.planned}
                    initial={
                        entry.kind === 'edit'
                            ? { mealId: entry.log.mealId, foodId: entry.log.foodId, quantity: entry.log.quantity }
                            : { mealId: entry.mealId }
                    }
                    onClose={() => setEntry(null)}
                    onSubmit={saveEntry}
                />
            )}
        </DndContext>
    )
}

// One food of the day: ticked when logged, its amount editable in place. The values shown
// follow what is typed, scaled from `nutrients` at `quantity`.
function DiaryRow({
    name,
    unit,
    quantity,
    nutrients,
    logged,
    note,
    busy,
    autoFocus,
    onBlurred,
    onToggle,
    onCommit,
    onEdit,
}: {
    name: string
    unit: string
    quantity: number
    nutrients: Nutrients
    logged: boolean
    note?: string
    busy: boolean
    autoFocus?: boolean
    onBlurred?: () => void
    onToggle: () => void
    onCommit: (quantity: number) => Promise<boolean>
    onEdit?: () => void
}) {
    const [draft, setDraft] = useState(String(quantity))
    const amount = Number(draft)
    const shown = amount > 0 ? scaleNutrients(nutrients, amount / quantity) : nutrients

    async function commit() {
        onBlurred?.()
        if (!(amount > 0)) return setDraft(String(quantity))
        if (amount === quantity) return
        if (!(await onCommit(amount))) setDraft(String(quantity))
    }

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Checkbox
                checked={logged}
                disabled={busy}
                onChange={onToggle}
                inputProps={{ 'aria-label': `${logged ? 'Unlog' : 'Log'} ${name}` }}
            />
            <Box sx={{ flex: 1, minWidth: 0, opacity: logged ? 1 : 0.7 }}>
                <Typography noWrap>
                    {name}
                    {note && <Typography component="span" variant="caption" color="text.secondary"> · {note}</Typography>}
                </Typography>
                <Typography variant="body2" color="text.secondary">{describeNutrients(shown)}</Typography>
            </Box>
            <QuantityInput
                value={draft}
                unit={unit}
                label={`Amount of ${name}`}
                autoFocus={autoFocus}
                disabled={busy}
                faded={!logged}
                onChange={setDraft}
                onCommit={commit}
                onCancel={() => setDraft(String(quantity))}
            />
            {onEdit ? (
                <Tooltip title="Change meal or food">
                    <IconButton size="small" aria-label={`Edit ${name}`} onClick={onEdit}>
                        <EditIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            ) : (
                // Keeps the amounts lined up with the rows that have an edit button
                <Box sx={{ width: 34, flexShrink: 0 }} />
            )}
        </Box>
    )
}

// The weekly weigh-in, shown on Mondays only
function WeighIn({ date, existing, onSaved }: { date: string; existing: BodyWeightRow | null; onSaved: () => void }) {
    const [editing, setEditing] = useState(!existing)
    const [kg, setKg] = useState(existing ? String(existing.kg) : '')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        const value = Number(kg)
        if (!(value > 0)) return setError('Enter your weight in kg')
        setSaving(true)
        setError(null)
        const ok = await saveBodyWeight(date, value, existing?.notes ?? null)
        setSaving(false)
        if (!ok) return setError('Failed to save')
        setEditing(false)
        onSaved()
    }

    return (
        <Paper variant="outlined" sx={{ p: 2, mt: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <WeightIcon color="action" />
            {existing && !editing ? (
                <>
                    <Typography sx={{ flexGrow: 1 }}>
                        Weekly weigh-in: <strong>{formatNumber(existing.kg, 1)} kg</strong>
                    </Typography>
                    <Button size="small" startIcon={<EditIcon />} onClick={() => setEditing(true)}>Edit</Button>
                </>
            ) : (
                <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', flexGrow: 1 }}>
                    <Typography sx={{ flexGrow: 1 }}>It's Monday: time for your weekly weigh-in.</Typography>
                    <TextField
                        size="small"
                        type="number"
                        label="Weight"
                        value={kg}
                        onChange={(e) => setKg(e.target.value)}
                        inputProps={{ min: 0, step: 0.1, inputMode: 'decimal' }}
                        InputProps={{ endAdornment: <InputAdornment position="end">kg</InputAdornment> }}
                        sx={{ width: 140 }}
                    />
                    <Button type="submit" variant="contained" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
                    {existing && (
                        <IconButton size="small" aria-label="Cancel" onClick={() => setEditing(false)} disabled={saving}>
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    )}
                </Box>
            )}
            {error && <Typography color="error" sx={{ width: '100%' }}>{error}</Typography>}
        </Paper>
    )
}
