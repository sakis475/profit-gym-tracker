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
    PlaylistAdd as AddIntoIcon,
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
import {
    createFoodLogs,
    deleteFoodLog,
    getFoodLog,
    saveBodyWeight,
    updateFoodLog,
    updateFoodLogContents,
} from '../../services/nutrition'
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
    type FoodContent,
    type Nutrients,
} from '../../lib/nutrition'
import { dayKey, formatNumber } from '../../lib/workoutStats'
import type {
    BodyWeightRow,
    FoodLogInsert,
    FoodLogWithFood,
    FoodRow,
    MealPlanWithFood,
    MealRow,
    NutritionGoalsRow,
} from '../../types/entityTypes'
import NutrientTotals from './NutrientTotals'
import FoodEntryDialog, { type FoodEntry } from './FoodEntryDialog'
import {
    ContentsList,
    IntoDropZone,
    MadeOfNames,
    MadeOfToggle,
    MealDropZone,
    QuantityInput,
    WithFoodSidebar,
    type DropTarget,
    type FoodDragData,
    type MadeOf,
} from './FoodDnd'
import { dropCollision } from './dropCollision'
import { useOpenContents } from './useOpenContents'
import { DragPreview } from '../DragSidebar'
import { locale, t, useT } from '../../i18n'

type Props = {
    plan: MealPlanWithFood[]
    meals: MealRow[]
    foods: FoodRow[]
    // What goes in each food, by its id
    contents: Map<string, FoodContent[]>
    goals: NutritionGoalsRow | null
    weights: BodyWeightRow[]
    onWeightsChange: () => void
}

// A food of the day that others can be put in: a planned one, logged or not yet, or one logged off plan
type Into = { kind: 'plan'; item: MealPlanWithFood } | { kind: 'log'; row: FoodLogWithFood }

// What the entry dialog does: add a food to a meal or put it in another, or change something logged
type EntryDialog =
    | { kind: 'add'; mealId?: string; into?: Into }
    | { kind: 'edit'; log: FoodLogWithFood; planned: boolean }

// What a row shows on top of its own: what was put in it, and a button to put more in. `dense` is
// for a food inside another.
type RowExtras = { madeOf?: MadeOf; onAddInto?: () => void; dense?: boolean }

// The key of a food that others can be put in, as a drop target and for its open list
function intoKeyOf(into: Into) {
    return into.kind === 'plan' ? `plan:${into.item.id}` : `log:${into.row.id}`
}

const MONDAY = 1

function logNutrients(l: FoodLogWithFood): Nutrients {
    return { kcal: l.kcal, protein: l.protein, carbs: l.carbs, fat: l.fat, fiber: l.fiber }
}

function formatDay(key: string) {
    return parseDateKey(key).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })
}

function intoName(into: Into) {
    return into.kind === 'plan' ? into.item.foods.name : into.row.foods?.name ?? t().nutrition.deletedFood
}

function intoMeal(into: Into) {
    return into.kind === 'plan' ? into.item.mealId : into.row.mealId
}

export default function FoodDiary({ plan, meals, foods, contents, goals, weights, onWeightsChange }: Props) {
    const m = useT()
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
    // Foods made of foods whose list of what is in them is open, by their into key
    const openContents = useOpenContents()
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
    const planById = new Map(dayPlan.map((p) => [p.id, p]))
    const logByPlan = new Map(rows.filter((l) => l.planId && planById.has(l.planId)).map((l) => [l.planId, l]))
    // Logged foods that are not one of this day's planned ones
    const extras = rows.filter((l) => !l.planId || !planById.has(l.planId))
    const rowIds = new Set(rows.map((l) => l.id))
    const mealIds = new Set(meals.map((m) => m.id))

    // Planned foods on their own, and what is planned in them
    const isTopPlanned = (p: MealPlanWithFood) => !p.parentId || !planById.has(p.parentId)
    const plannedContents = (id: string) => dayPlan.filter((p) => p.parentId === id)
    // Off-plan foods on their own, and what was put in a logged food off plan
    const isTopExtra = (l: FoodLogWithFood) => !l.parentId || !rowIds.has(l.parentId)
    const extraContents = (logId: string | undefined) => (logId ? extras.filter((l) => l.parentId === logId) : [])
    const orphanExtras = extras.filter((l) => isTopExtra(l) && !mealIds.has(l.mealId))

    // A food with foods in it comes to what is in it, so only the foods without any count
    const countsLog = (l: FoodLogWithFood) => !rows.some((c) => c.parentId === l.id)
    const countedRows = rows.filter(countsLog)
    const totals = sumNutrients(countedRows.map(logNutrients))
    const planTotals = sumNutrients(dayPlan
        .filter((p) => !dayPlan.some((c) => c.parentId === p.id))
        .map((p) => foodNutrients(p.foods, p.quantity)))
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

    function plannedLog(p: MealPlanWithFood, parentId: string | null, quantity = p.quantity): FoodLogInsert {
        return { date, mealId: p.mealId, foodId: p.foodId, planId: p.id, parentId, quantity, ...foodNutrients(p.foods, quantity) }
    }

    // Logs planned foods. A food planned in another needs that one logged, so it is logged along
    // when it is not yet. `amount` is a typed amount for one of them.
    async function logPlannedItems(items: MealPlanWithFood[], amount?: { id: string; quantity: number }) {
        const wanted = new Map<string, MealPlanWithFood>()
        for (const p of items) {
            if (logByPlan.has(p.id)) continue
            wanted.set(p.id, p)
            const parent = p.parentId ? planById.get(p.parentId) : undefined
            if (parent && !logByPlan.has(parent.id)) wanted.set(parent.id, parent)
        }
        const quantity = (p: MealPlanWithFood) => (amount?.id === p.id ? amount.quantity : p.quantity)
        const list = [...wanted.values()]
        const parents = list.filter(isTopPlanned)
        const children = list.filter((p) => !isTopPlanned(p))

        const ids = await createFoodLogs(parents.map((p) => plannedLog(p, null, quantity(p))))
        if (!ids) return false
        if (children.length === 0) return true
        const parentLogIds = new Map(parents.map((p, i) => [p.id, ids[i]]))
        return !!(await createFoodLogs(children.map((p) => plannedLog(
            p,
            parentLogIds.get(p.parentId!) ?? logByPlan.get(p.parentId!)!.id,
            quantity(p)
        ))))
    }

    function logPlanned(items: MealPlanWithFood[], amount?: { id: string; quantity: number }) {
        return run(() => logPlannedItems(items, amount), m.common.failedToLog)
    }

    // Ticking a planned food logs what is planned in it too; unticking takes it all out of the log
    function togglePlanned(item: MealPlanWithFood) {
        const logged = logByPlan.get(item.id)
        if (logged) run(() => deleteFoodLog(logged.id), m.common.failedToRemove)
        else logPlanned([item, ...plannedContents(item.id)])
    }

    // A new amount for something logged. The values are rescaled from what was logged, so they
    // keep the food's values from when it was logged.
    function changeLogged(l: FoodLogWithFood, quantity: number) {
        return run(
            () => updateFoodLog(l.id, { quantity, ...scaleNutrients(logNutrients(l), quantity / l.quantity) }),
            m.common.failedToSave
        )
    }

    // Logs a food off plan in a meal, or puts it in another food (logging that one first if it is
    // only planned). A food on its own starts with a copy of what goes in it (set in Foods), which
    // can then be changed for this day alone. Returns the new row's id.
    async function addFood(food: FoodRow, quantity: number, mealId: string, into: Into | null) {
        let parentId: string | null = null
        if (into?.kind === 'log') parentId = into.row.id
        if (into?.kind === 'plan') {
            parentId = logByPlan.get(into.item.id)?.id ?? (await createFoodLogs([plannedLog(into.item, null)]))?.[0] ?? null
            if (!parentId) return null
        }
        const ids = await createFoodLogs([
            { date, mealId, foodId: food.id, planId: null, parentId, quantity, ...foodNutrients(food, quantity) },
        ])
        if (!ids) return null

        // One level only, so a food put in another comes without its contents
        const kept = into ? [] : contents.get(food.id) ?? []
        if (kept.length > 0) {
            const ok = await createFoodLogs(kept.map((c) => ({
                date,
                mealId,
                foodId: c.food.id,
                planId: null,
                parentId: ids[0],
                quantity: c.quantity,
                ...foodNutrients(c.food, c.quantity),
            })))
            if (!ok) setError(m.nutrition.diary.loggedNotContents(food.name))
        }
        return ids[0]
    }

    async function saveEntry({ mealId, foodId, quantity }: FoodEntry, food: FoodRow) {
        if (!entry) return null
        const ok = await run(async () => {
            if (entry.kind === 'add') {
                const into = entry.into ?? null
                // What was put in shows
                if (into) openContents.show(intoKeyOf(into))
                return !!(await addFood(food, quantity, into ? intoMeal(into) : mealId, into))
            }
            const moved = mealId !== entry.log.mealId
            // Moved to another meal, it comes out of the food it was in, and what is in it goes along
            return await updateFoodLog(entry.log.id, {
                mealId,
                foodId,
                quantity,
                ...foodNutrients(food, quantity),
                ...(moved && { parentId: null }),
            }) && (!moved || await updateFoodLogContents(entry.log.id, { mealId }))
        }, m.common.failedToSave)
        if (!ok) return m.common.failedToSave
        setEntry(null)
        return null
    }

    function intoFor(key: string): Into | null {
        const [kind, id] = key.split(':')
        if (kind === 'plan') {
            const item = planById.get(id)
            return item ? { kind, item } : null
        }
        const row = rows.find((l) => l.id === id)
        return row ? { kind: 'log', row } : null
    }

    async function handleDragEnd({ active, over }: DragEndEvent) {
        setDragging(null)
        const target = over?.data.current as DropTarget | undefined
        const data = active.data.current as FoodDragData | undefined
        if (!target || data?.kind !== 'food') return

        const into = target.intoKey ? intoFor(target.intoKey) : null
        // One level only
        if (into && contents.has(data.food.id)) {
            return setError(m.nutrition.cantGoIn(data.food.name))
        }
        // What is put in shows
        if (into) openContents.show(intoKeyOf(into))
        setBusy(true)
        setError(null)
        const id = await addFood(data.food, defaultQuantity(data.food.unit), into ? intoMeal(into) : target.mealId, into)
        setBusy(false)
        if (!id) setError(m.nutrition.diary.failedToLogFood(data.food.name))
        else setFocusId(id)
        setReload((n) => n + 1)
    }

    // What a planned food comes to: logged, its logged values; not yet, its planned ones
    function plannedNutrients(p: MealPlanWithFood) {
        const l = logByPlan.get(p.id)
        return l ? logNutrients(l) : foodNutrients(p.foods, p.quantity)
    }

    function renderPlanned(p: MealPlanWithFood, extra: RowExtras = {}) {
        const l = logByPlan.get(p.id)
        return l ? (
            <DiaryRow
                key={`${p.id}:${l.id}:${l.quantity}`}
                name={p.foods.name}
                unit={p.foods.unit}
                quantity={l.quantity}
                nutrients={logNutrients(l)}
                {...extra}
                logged
                note={l.quantity !== p.quantity ? m.nutrition.diary.planned(formatQuantity(p.quantity, p.foods.unit)) : undefined}
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
                {...extra}
                logged={false}
                busy={busy}
                onToggle={() => togglePlanned(p)}
                // Typing another amount for a planned food logs it with that amount
                onCommit={(q) => logPlanned([p, ...plannedContents(p.id)], { id: p.id, quantity: q })}
            />
        )
    }

    function renderExtra(l: FoodLogWithFood, extra: RowExtras = {}) {
        return (
            <DiaryRow
                key={`${l.id}:${l.quantity}`}
                name={l.foods?.name ?? m.nutrition.deletedFood}
                unit={l.foods?.unit ?? ''}
                quantity={l.quantity}
                nutrients={logNutrients(l)}
                {...extra}
                logged
                note={m.nutrition.diary.notPlanned}
                busy={busy}
                autoFocus={l.id === focusId}
                onBlurred={() => setFocusId(null)}
                onToggle={() => run(() => deleteFoodLog(l.id), m.common.failedToRemove)}
                onCommit={(q) => changeLogged(l, q)}
                onEdit={() => setEntry({ kind: 'edit', log: l, planned: false })}
            />
        )
    }

    // A planned food on its own, with what is planned in it and what was put in it on this day
    function renderPlannedGroup(p: MealPlanWithFood, mealId: string) {
        const inPlan = plannedContents(p.id)
        const logged = logByPlan.get(p.id)
        const added = extraContents(logged?.id)
        const hasContents = inPlan.length > 0 || added.length > 0
        // Logged, it comes to what of it is ticked; not yet, to all that is planned in it
        const contentsTotal = logged
            ? sumNutrients([...inPlan.flatMap((c) => logByPlan.get(c.id) ?? []), ...added].map(logNutrients))
            : sumNutrients(inPlan.map(plannedNutrients))
        const key = `plan:${p.id}`
        return (
            <IntoDropZone key={p.id} mealId={mealId} intoKey={key}>
                {renderPlanned(p, {
                    madeOf: hasContents ? {
                        nutrients: contentsTotal,
                        names: [...inPlan.map((c) => c.foods.name), ...added.map((c) => c.foods?.name ?? m.nutrition.deletedFood)],
                        open: openContents.isOpen(key),
                        onToggle: () => openContents.toggle(key),
                    } : undefined,
                    onAddInto: () => setEntry({ kind: 'add', into: { kind: 'plan', item: p } }),
                })}
                {hasContents && (
                    <ContentsList open={openContents.isOpen(key)}>
                        {inPlan.map((c) => renderPlanned(c, { dense: true }))}
                        {added.map((c) => renderExtra(c, { dense: true }))}
                    </ContentsList>
                )}
            </IntoDropZone>
        )
    }

    // A food logged off plan on its own, with what was put in it
    function renderExtraGroup(l: FoodLogWithFood, mealId: string | null) {
        const inside = extraContents(l.id)
        const key = `log:${l.id}`
        const rowsShown = (
            <>
                {renderExtra(l, {
                    madeOf: inside.length > 0 ? {
                        nutrients: sumNutrients(inside.map(logNutrients)),
                        names: inside.map((c) => c.foods?.name ?? m.nutrition.deletedFood),
                        open: openContents.isOpen(key),
                        onToggle: () => openContents.toggle(key),
                    } : undefined,
                    onAddInto: mealId ? () => setEntry({ kind: 'add', into: { kind: 'log', row: l } }) : undefined,
                })}
                {inside.length > 0 && (
                    <ContentsList open={openContents.isOpen(key)}>
                        {inside.map((c) => renderExtra(c, { dense: true }))}
                    </ContentsList>
                )}
            </>
        )
        // In a deleted meal nothing more is put in it
        return mealId ? (
            <IntoDropZone key={l.id} mealId={mealId} intoKey={`log:${l.id}`}>{rowsShown}</IntoDropZone>
        ) : (
            <Box key={l.id}>{rowsShown}</Box>
        )
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={dropCollision}
            onDragStart={({ active }: DragStartEvent) => setDragging((active.data.current as FoodDragData | undefined) ?? null)}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setDragging(null)}
        >
            <WithFoodSidebar foods={foods} contents={contents}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <IconButton aria-label={m.nutrition.diary.previousDay} onClick={() => setDate(dayKey(addDays(date, -1)))}>
                        <PrevIcon />
                    </IconButton>
                    <TextField
                        size="small"
                        type="date"
                        value={date}
                        onChange={(e) => e.target.value && setDate(e.target.value)}
                        inputProps={{ 'aria-label': m.common.date }}
                    />
                    <IconButton aria-label={m.nutrition.diary.nextDay} onClick={() => setDate(dayKey(addDays(date, 1)))}>
                        <NextIcon />
                    </IconButton>
                    {date !== today && <Button onClick={() => setDate(today)}>{m.common.today}</Button>}
                    <Typography variant="h6" sx={{ flexGrow: 1, textAlign: 'right' }}>{formatDay(date)}</Typography>
                </Box>

                {weekday === MONDAY && (
                    <WeighIn key={date} date={date} existing={weights.find((w) => w.date === date) ?? null} onSaved={onWeightsChange} />
                )}

                {loading ? (
                    <Typography sx={{ mt: 2 }}>{m.common.loading}</Typography>
                ) : log.rows === null ? (
                    <Typography color="error" sx={{ mt: 2 }}>{m.nutrition.diary.failedToLoadDay}</Typography>
                ) : (
                    <>
                        <Box sx={{ mt: 2 }}>
                            <NutrientTotals
                                totals={totals}
                                goals={goals}
                                sources={countedRows.map((l) => ({
                                    key: l.foodId ?? l.id,
                                    name: l.foods?.name ?? m.nutrition.deletedFood,
                                    nutrients: logNutrients(l),
                                }))}
                            />
                        </Box>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mt: 1.5 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                                {dayPlan.length > 0
                                    ? m.nutrition.diary.plannedForDay(formatNutrient(planTotals.kcal, 'kcal'), formatNutrient(planTotals.protein, 'protein'))
                                    : m.nutrition.diary.nothingPlannedForDay}
                            </Typography>
                            {unlogged.length > 0 && (
                                <Button startIcon={<DoneAllIcon />} onClick={() => logPlanned(unlogged)} disabled={busy}>
                                    {m.nutrition.diary.tickAllRemaining}
                                </Button>
                            )}
                            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEntry({ kind: 'add' })}>
                                {m.nutrition.addFood}
                            </Button>
                        </Box>
                        {error && <Typography color="error" sx={{ mt: 1 }}>{error}</Typography>}

                        <Stack spacing={2} sx={{ mt: 2 }}>
                            {meals.map((meal) => {
                                const planned = dayPlan.filter((p) => p.mealId === meal.id && isTopPlanned(p))
                                const mealExtras = extras.filter((l) => l.mealId === meal.id && isTopExtra(l))
                                // Everything logged that is shown in this meal
                                const eaten = sumNutrients([
                                    ...planned.flatMap((p) => {
                                        const l = logByPlan.get(p.id)
                                        return [
                                            ...(l ? [l] : []),
                                            ...plannedContents(p.id).flatMap((c) => logByPlan.get(c.id) ?? []),
                                            ...extraContents(l?.id),
                                        ]
                                    }),
                                    ...mealExtras.flatMap((l) => [l, ...extraContents(l.id)]),
                                ].filter(countsLog).map(logNutrients))

                                return (
                                    <MealDropZone key={meal.id} mealId={meal.id} dragging={!!dragging}>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 2 }}>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 500, flexGrow: 1 }}>{meal.name}</Typography>
                                            {(planned.length > 0 || mealExtras.length > 0) && (
                                                <Typography variant="body2" color="text.secondary">
                                                    {formatNutrient(eaten.kcal, 'kcal')} {m.units.kcal} · {m.nutrients.protein.short} {formatNutrient(eaten.protein, 'protein')} {m.units.g}
                                                </Typography>
                                            )}
                                        </Box>
                                        {planned.map((p) => renderPlannedGroup(p, meal.id))}
                                        {mealExtras.map((l) => renderExtraGroup(l, meal.id))}
                                        {planned.length === 0 && mealExtras.length === 0 && (
                                            <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                                                {m.nutrition.diary.nothingPlanned}
                                                {/* Only where the food list is shown */}
                                                <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>{m.nutrition.diary.dragFoodsHere}</Box>
                                            </Typography>
                                        )}
                                        <Button size="small" startIcon={<AddIcon />} onClick={() => setEntry({ kind: 'add', mealId: meal.id })} sx={{ mt: 0.5 }}>
                                            {m.nutrition.addTo(meal.name)}
                                        </Button>
                                    </MealDropZone>
                                )
                            })}
                            {orphanExtras.length > 0 && (
                                <Paper variant="outlined" sx={{ p: 2 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>{m.nutrition.diary.other}</Typography>
                                    {orphanExtras.map((l) => renderExtraGroup(l, null))}
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
                    title={entry.kind === 'edit' ? m.nutrition.diary.editLogged : entry.into ? m.nutrition.addTo(intoName(entry.into)) : m.nutrition.addFood}
                    submitLabel={entry.kind === 'edit' ? m.common.save : m.nutrition.diary.log}
                    meals={meals}
                    // A food with foods in it goes in no other
                    foods={entry.kind === 'add' && entry.into ? foods.filter((f) => !contents.has(f.id)) : foods}
                    contents={contents}
                    lockFood={entry.kind === 'edit' && entry.planned}
                    hideMeal={entry.kind === 'add' && !!entry.into}
                    initial={
                        entry.kind === 'edit'
                            ? { mealId: entry.log.mealId, foodId: entry.log.foodId, quantity: entry.log.quantity }
                            : { mealId: entry.into ? intoMeal(entry.into) : entry.mealId }
                    }
                    onClose={() => setEntry(null)}
                    onSubmit={saveEntry}
                />
            )}
        </DndContext>
    )
}

// One food of the day: ticked when logged, its amount editable in place. The values shown
// follow what is typed, scaled from `nutrients` at `quantity`. Made of foods (`madeOf`), it shows
// their sum and names instead and has no amount of its own. `dense` is for a food inside another.
function DiaryRow({
    name,
    unit,
    quantity,
    nutrients,
    madeOf,
    dense,
    logged,
    note,
    busy,
    autoFocus,
    onBlurred,
    onToggle,
    onCommit,
    onAddInto,
    onEdit,
}: {
    name: string
    unit: string
    quantity: number
    nutrients: Nutrients
    madeOf?: MadeOf
    dense?: boolean
    logged: boolean
    note?: string
    busy: boolean
    autoFocus?: boolean
    onBlurred?: () => void
    onToggle: () => void
    onCommit: (quantity: number) => Promise<boolean>
    // For a food on its own, which other foods can be put in
    onAddInto?: () => void
    onEdit?: () => void
}) {
    const m = useT()
    const [draft, setDraft] = useState(String(quantity))
    const amount = Number(draft)
    // Made of foods, it comes to what is in it; its own amount and values don't apply
    const shown = madeOf?.nutrients ?? (amount > 0 ? scaleNutrients(nutrients, amount / quantity) : nutrients)

    async function commit() {
        onBlurred?.()
        if (!(amount > 0)) return setDraft(String(quantity))
        if (amount === quantity) return
        if (!(await onCommit(amount))) setDraft(String(quantity))
    }

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Checkbox
                size={dense ? 'small' : 'medium'}
                checked={logged}
                disabled={busy}
                onChange={onToggle}
                inputProps={{ 'aria-label': logged ? m.nutrition.diary.unlogItem(name) : m.nutrition.diary.logItem(name) }}
                sx={dense ? { p: 0.75 } : undefined}
            />
            <Box sx={{ flex: 1, minWidth: 0, opacity: logged ? 1 : 0.7 }}>
                <Typography noWrap variant={dense ? 'body2' : 'body1'}>
                    {name}
                    {note && <Typography component="span" variant="caption" color="text.secondary"> · {note}</Typography>}
                </Typography>
                {madeOf && <MadeOfNames names={madeOf.names} />}
                <Typography variant={dense ? 'caption' : 'body2'} color="text.secondary" component="div">
                    {describeNutrients(shown)}
                </Typography>
            </Box>
            {madeOf ? (
                <MadeOfToggle name={name} madeOf={madeOf} />
            ) : (
                <QuantityInput
                    value={draft}
                    unit={unit}
                    label={m.nutrition.amountOf(name)}
                    autoFocus={autoFocus}
                    disabled={busy}
                    faded={!logged}
                    dense={dense}
                    onChange={setDraft}
                    onCommit={commit}
                    onCancel={() => setDraft(String(quantity))}
                />
            )}
            {onAddInto ? (
                <Tooltip title={m.nutrition.putIn(name)}>
                    <IconButton size="small" aria-label={m.nutrition.putIn(name)} onClick={onAddInto}>
                        <AddIntoIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            ) : (
                // Keeps the amounts lined up with the rows that have this button
                <Box sx={{ width: 34, flexShrink: 0 }} />
            )}
            {onEdit ? (
                <Tooltip title={m.nutrition.diary.changeMealOrFood}>
                    <IconButton size="small" aria-label={m.nutrition.edit(name)} onClick={onEdit}>
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
    const m = useT()
    const [editing, setEditing] = useState(!existing)
    const [kg, setKg] = useState(existing ? String(existing.kg) : '')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        const value = Number(kg)
        if (!(value > 0)) return setError(m.nutrition.diary.enterWeight)
        setSaving(true)
        setError(null)
        const ok = await saveBodyWeight(date, value, existing?.notes ?? null)
        setSaving(false)
        if (!ok) return setError(m.common.failedToSave)
        setEditing(false)
        onSaved()
    }

    return (
        <Paper variant="outlined" sx={{ p: 2, mt: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <WeightIcon color="action" />
            {existing && !editing ? (
                <>
                    <Typography sx={{ flexGrow: 1 }}>
                        {m.nutrition.diary.weeklyWeighIn} <strong>{formatNumber(existing.kg, 1)} {m.units.kg}</strong>
                    </Typography>
                    <Button size="small" startIcon={<EditIcon />} onClick={() => setEditing(true)}>{m.common.edit}</Button>
                </>
            ) : (
                <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', flexGrow: 1 }}>
                    <Typography sx={{ flexGrow: 1 }}>{m.nutrition.diary.mondayWeighIn}</Typography>
                    <TextField
                        size="small"
                        type="number"
                        label={m.common.weight}
                        value={kg}
                        onChange={(e) => setKg(e.target.value)}
                        inputProps={{ min: 0, step: 0.1, inputMode: 'decimal' }}
                        InputProps={{ endAdornment: <InputAdornment position="end">{m.units.kg}</InputAdornment> }}
                        sx={{ width: 140 }}
                    />
                    <Button type="submit" variant="contained" disabled={saving}>{saving ? m.common.saving : m.common.save}</Button>
                    {existing && (
                        <IconButton size="small" aria-label={m.common.cancel} onClick={() => setEditing(false)} disabled={saving}>
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    )}
                </Box>
            )}
            {error && <Typography color="error" sx={{ width: '100%' }}>{error}</Typography>}
        </Paper>
    )
}
