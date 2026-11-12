import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { getSchedules } from '../../services/schedule'
import { getExercises } from '../../services/exercises'
import { getLastWorkoutSets, getMaxSet, getWorkoutsSince, createWorkoutSets, replaceWorkoutSets } from '../../services/workout'
import { formatSet } from '../../lib/workoutStats'
import type { ExerciseRow, ScheduleWithExercise, WorkoutRow } from '../../types/entityTypes'
import {
    Typography,
    Button,
    Box,
    Paper,
    TextField,
    Chip,
    Link,
    Stack,
    IconButton,
} from '@mui/material'
import {
    Add as AddIcon,
    Check as CheckIcon,
    Close as CloseIcon,
    Edit as EditIcon,
    EmojiEvents as TrophyIcon,
} from '@mui/icons-material'
import {
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    useDroppable,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from '@dnd-kit/core'
import { DragPreview, WithDragSidebar, type SidebarItem } from '../DragSidebar'
import { locale, useT } from '../../i18n'

type SetFields = { reps: string; kg: string; notes: string }
const EMPTY_SET: SetFields = { reps: '', kg: '', notes: '' }

function startOfToday() {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(locale(), {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
    })
}

// Rows come ordered by set, so each exercise's array is too
function groupByExercise(rows: WorkoutRow[]) {
    const grouped: Record<string, WorkoutRow[]> = {}
    for (const row of rows) (grouped[row.exerciseId] ??= []).push(row)
    return grouped
}

// Whether any of `sets` beats the max: more kg, or as much kg for more reps. For a max
// without weight (a bodyweight exercise) only more reps count.
function beatsMax(sets: WorkoutRow[], max: WorkoutRow) {
    return sets.some((w) =>
        max.kg
            ? (w.kg ?? 0) > max.kg || ((w.kg ?? 0) === max.kg && (w.reps ?? 0) > (max.reps ?? 0))
            : (w.reps ?? 0) > (max.reps ?? 0)
    )
}

// One row per set number, so a gap in the logged sets stays a gap
function setsToFields(sets: WorkoutRow[]): SetFields[] {
    const count = Math.max(1, ...sets.map((w) => w.set ?? 0))
    return Array.from({ length: count }, (_, i) => {
        const w = sets.find((s) => s.set === i + 1)
        return w ? { reps: String(w.reps ?? ''), kg: String(w.kg ?? ''), notes: w.notes ?? '' } : EMPTY_SET
    })
}

// An exercise on today's list: planned for today, or added today
type TodayItem = { key: string; exerciseId: string; name: string; category: string | null; planned: boolean }

// An exercise dragged from the list
type ExerciseDragData = { kind: 'exercise'; exercise: ExerciseRow }

// Today's cards, which take exercises dropped from the list beside them
function TodayDropZone({ highlight, children }: { highlight: boolean; children: React.ReactNode }) {
    const { setNodeRef, isOver } = useDroppable({ id: 'today' })

    return (
        <Box
            ref={setNodeRef}
            sx={{
                mt: 2,
                minHeight: '40vh',
                borderRadius: 1,
                border: 2,
                borderStyle: 'dashed',
                borderColor: isOver ? 'primary.main' : highlight ? 'divider' : 'transparent',
                bgcolor: isOver ? 'action.hover' : undefined,
                transition: 'border-color 120ms, background-color 120ms',
            }}
        >
            {children}
        </Box>
    )
}

export default function Workout() {
    const m = useT()
    const w = m.training.today
    const DAY_NAMES = m.days.long
    const today = new Date().getDay()
    const [planned, setPlanned] = useState<ScheduleWithExercise[]>([])
    // Exercises done today without being planned, in the order they were added
    const [extras, setExtras] = useState<string[]>([])
    const [exercises, setExercises] = useState<ExerciseRow[]>([])
    const [dragging, setDragging] = useState<ExerciseDragData | null>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const sensors = useSensors(
        // A few pixels of movement before a drag starts, so clicks still work
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor)
    )
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState(false)
    // Sets of the last workout of each exercise before today: what the user aims to beat
    const [last, setLast] = useState<Record<string, WorkoutRow[]>>({})
    // Best set of each exercise before today, so today's sets can be told apart as a new max
    const [max, setMax] = useState<Record<string, WorkoutRow | null>>({})
    // Sets already logged today, by exercise
    const [logged, setLogged] = useState<Record<string, WorkoutRow[]>>({})
    // Sets being entered, by exercise. Until the user touches an exercise it has one row
    // per previous set, so every faded value has a place to be beaten
    const [entries, setEntries] = useState<Record<string, SetFields[]>>({})
    // Exercises whose logged workout is being edited
    const [editing, setEditing] = useState<Record<string, boolean>>({})
    const [saving, setSaving] = useState<string | null>(null)
    const [errors, setErrors] = useState<Record<string, string>>({})

    useEffect(() => {
        let cancelled = false

        async function init() {
            const start = startOfToday().toISOString()
            const [schedules, todays, allExercises] = await Promise.all([
                getSchedules(today),
                getWorkoutsSince(start),
                getExercises(),
            ])
            if (cancelled) return
            if (!schedules) {
                setLoadError(true)
                setLoading(false)
                return
            }

            const todaysByExercise = groupByExercise(todays ?? [])
            const plannedIds = new Set(schedules.map((s) => s.exerciseId))
            // Logged today without being planned, e.g. dragged in earlier today
            const extraIds = Object.keys(todaysByExercise).filter((id) => !plannedIds.has(id))
            const ids = [...plannedIds, ...extraIds]

            const [lastSets, maxSets] = await Promise.all([
                Promise.all(ids.map((id) => getLastWorkoutSets(id, start))),
                Promise.all(ids.map((id) => getMaxSet(id, start))),
            ])
            if (cancelled) return

            setPlanned(schedules)
            setExtras(extraIds)
            setExercises(allExercises ?? [])
            setLast(Object.fromEntries(ids.map((id, i) => [id, lastSets[i] ?? []])))
            setMax(Object.fromEntries(ids.map((id, i) => [id, maxSets[i]])))
            setLogged(todaysByExercise)
            setLoading(false)
        }

        init()
        return () => {
            cancelled = true
        }
    }, [today])

    const items = useMemo<TodayItem[]>(() => {
        const byId = new Map(exercises.map((e) => [e.id, e]))
        return [
            ...planned.map((s) => ({ key: s.id, exerciseId: s.exerciseId, name: s.exercises.name, category: s.exercises.category, planned: true })),
            ...extras.map((id) => ({
                key: `extra:${id}`,
                exerciseId: id,
                // Only active exercises are loaded, a deleted one keeps its logged sets without a name
                name: byId.get(id)?.name ?? m.training.deletedExercise,
                category: byId.get(id)?.category ?? null,
                planned: false,
            })),
        ]
    }, [planned, extras, exercises, m])

    const sidebarItems = useMemo<SidebarItem[]>(
        () => [...exercises]
            .sort((a, b) => (a.category ?? '').localeCompare(b.category ?? '') || a.name.localeCompare(b.name))
            .map((exercise) => ({
                dragId: `exercise:${exercise.id}`,
                name: exercise.name,
                detail: exercise.category,
                data: { kind: 'exercise', exercise } satisfies ExerciseDragData,
            })),
        [exercises]
    )

    // An exercise dropped in gets a card for today, with what it has to beat loaded for it
    async function addExtra(exercise: ExerciseRow) {
        setNotice(null)
        if (items.some((it) => it.exerciseId === exercise.id)) {
            setNotice(w.alreadyOnList(exercise.name))
            return
        }
        setExtras((prev) => [...prev, exercise.id])
        const start = startOfToday().toISOString()
        const [lastSets, maxSet] = await Promise.all([getLastWorkoutSets(exercise.id, start), getMaxSet(exercise.id, start)])
        setLast((prev) => ({ ...prev, [exercise.id]: lastSets ?? [] }))
        setMax((prev) => ({ ...prev, [exercise.id]: maxSet }))
    }

    // Only for an added exercise with nothing logged yet
    function removeExtra(exerciseId: string) {
        setExtras((prev) => prev.filter((id) => id !== exerciseId))
        stopEditing(exerciseId)
    }

    function handleDragEnd({ active, over }: DragEndEvent) {
        setDragging(null)
        const data = active.data.current as ExerciseDragData | undefined
        if (over?.id === 'today' && data?.kind === 'exercise') addExtra(data.exercise)
    }

    function draftSets(exerciseId: string): SetFields[] {
        if (entries[exerciseId]) return entries[exerciseId]
        return setsToFields(last[exerciseId] ?? []).map(() => EMPTY_SET)
    }

    function startEditing(exerciseId: string) {
        setError(exerciseId, null)
        setEntries((prev) => ({ ...prev, [exerciseId]: setsToFields(logged[exerciseId] ?? []) }))
        setEditing((prev) => ({ ...prev, [exerciseId]: true }))
    }

    function stopEditing(exerciseId: string) {
        setError(exerciseId, null)
        setEntries((prev) => {
            const next = { ...prev }
            delete next[exerciseId]
            return next
        })
        setEditing((prev) => ({ ...prev, [exerciseId]: false }))
    }

    function updateSets(exerciseId: string, update: (sets: SetFields[]) => SetFields[]) {
        setEntries((prev) => ({ ...prev, [exerciseId]: update(draftSets(exerciseId)) }))
    }

    function setField(exerciseId: string, index: number, field: keyof SetFields, value: string) {
        updateSets(exerciseId, (sets) => sets.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
    }

    function setError(exerciseId: string, message: string | null) {
        setErrors((prev) => {
            const next = { ...prev }
            if (message) next[exerciseId] = message
            else delete next[exerciseId]
            return next
        })
    }

    async function handleLog(exerciseId: string, e?: React.FormEvent) {
        e?.preventDefault()
        setError(exerciseId, null)

        // Editing keeps the workout's createdAt, so it stays the same workout
        const existing = editing[exerciseId] ? logged[exerciseId] : undefined
        // A new log takes last time's value (the placeholder) for every field left empty, so a
        // workout done as before is logged with one press. Editing takes the fields as they are:
        // emptying one there means taking that value out.
        const previousBySet = new Map((existing ? [] : last[exerciseId] ?? []).map((w) => [w.set, w]))
        const orPrevious = (typed: string, previous: number | string | null | undefined) =>
            typed.trim() !== '' ? typed : previous != null ? String(previous) : ''

        // The set number is the row position, empty rows are skipped
        const rows: { set: number; reps: number | null; kg: number | null; notes: string | null }[] = []
        for (const [i, row] of draftSets(exerciseId).entries()) {
            const prev = previousBySet.get(i + 1)
            const reps = orPrevious(row.reps, prev?.reps)
            const kg = orPrevious(row.kg, prev?.kg)
            const notes = orPrevious(row.notes, prev?.notes)
            if (!reps && !kg) continue
            const repsNum = reps ? Number(reps) : null
            const kgNum = kg ? Number(kg) : null
            if ((repsNum !== null && !(Number.isInteger(repsNum) && repsNum >= 0)) || (kgNum !== null && !(kgNum >= 0))) {
                setError(exerciseId, w.setInvalid(i + 1))
                return
            }
            rows.push({ set: i + 1, reps: repsNum, kg: kgNum, notes: notes.trim() || null })
        }
        if (rows.length === 0) {
            setError(exerciseId, w.noSets)
            return
        }

        setSaving(exerciseId)
        const res = existing
            ? await replaceWorkoutSets(exerciseId, existing[0].createdAt, rows)
            : await createWorkoutSets(rows.map((row) => ({ ...row, exerciseId, createdAt: new Date().toISOString() })))
        setSaving(null)
        if (!res) {
            setError(exerciseId, existing ? w.failedToSaveChanges : w.failedToLog)
            return
        }
        setLogged((prev) => ({ ...prev, [exerciseId]: res }))
        stopEditing(exerciseId)
    }

    return (
        <DndContext
            sensors={sensors}
            onDragStart={({ active }: DragStartEvent) => setDragging((active.data.current as ExerciseDragData | undefined) ?? null)}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setDragging(null)}
        >
            <WithDragSidebar
                title={w.sidebarTitle}
                items={sidebarItems}
                emptyText={m.training.sidebarEmpty}
            >
                <Typography variant="h6">{DAY_NAMES[today]}</Typography>
                {notice && <Typography color="text.secondary" sx={{ mt: 1 }}>{notice}</Typography>}

                {loading ? (
                    <Typography sx={{ mt: 2 }}>{m.common.loading}</Typography>
                ) : loadError ? (
                    <Typography color="error" sx={{ mt: 2 }}>{w.failedToLoad}</Typography>
                ) : (
                    <TodayDropZone highlight={!!dragging}>
                        {items.length === 0 ? (
                            <Typography sx={{ p: 2 }}>
                                {w.nothingPlanned(DAY_NAMES[today])}
                                <Link component={RouterLink} to="/training?tab=plan">{w.planLink}</Link>
                                {/* Only where the exercise list is shown */}
                                <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>{w.orDragHere}</Box>.
                            </Typography>
                        ) : (
                            <Stack spacing={2}>
                                {items.map((it) => {
                                    const id = it.exerciseId
                                    const done = logged[id]
                                    const isEditing = !!done && !!editing[id]
                                    // A logged workout is read-only until the user chooses to edit it
                                    const locked = !!done && !isEditing
                                    const previous = last[id] ?? []
                                    const sets = locked ? setsToFields(done) : draftSets(id)
                                    const previousBySet = new Map(previous.map((w) => [w.set, w]))
                                    const best = max[id]
                                    const newMax = !!done && !!best && beatsMax(done, best)

                                    return (
                                        <Paper key={it.key} variant="outlined" sx={{ p: 2 }}>
                                            <form onSubmit={(e) => handleLog(id, e)}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Box sx={{ flexGrow: 1 }}>
                                                        <Typography variant="h6">{it.name}</Typography>
                                                        {(it.category || !it.planned) && (
                                                            <Typography variant="body2" color="text.secondary">
                                                                {[it.category, !it.planned && w.notPlanned].filter(Boolean).join(' · ')}
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                    {newMax && (
                                                        <Chip color="warning" size="small" icon={<TrophyIcon />} label={w.newMax} />
                                                    )}
                                                    {done && (
                                                        <Chip
                                                            color={isEditing ? 'default' : 'success'}
                                                            size="small"
                                                            icon={isEditing ? <EditIcon /> : <CheckIcon />}
                                                            label={isEditing ? w.editing : w.logged}
                                                        />
                                                    )}
                                                    {!it.planned && !done && (
                                                        <IconButton aria-label={w.removeFromToday(it.name)} size="small" onClick={() => removeExtra(id)}>
                                                            <CloseIcon fontSize="small" />
                                                        </IconButton>
                                                    )}
                                                </Box>

                                                <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', columnGap: 3 }}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {previous.length > 0
                                                            ? w.previousWorkout(formatDate(previous[0].createdAt))
                                                            : w.noPreviousWorkout}
                                                    </Typography>
                                                    {best && (
                                                        <Typography variant="body2" color="text.secondary">
                                                            {w.max}{' '}
                                                            <Box component="span" sx={{ color: 'text.primary', fontWeight: 500 }}>
                                                                {formatSet(best)}
                                                            </Box>
                                                            {' '}({formatDate(best.createdAt)})
                                                        </Typography>
                                                    )}
                                                </Box>

                                                <Stack spacing={1.5} sx={{ mt: 2 }}>
                                                    {sets.map((row, i) => {
                                                        const prev = previousBySet.get(i + 1)
                                                        const removable = !locked && sets.length > 1
                                                        return (
                                                            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                <Typography sx={{ width: 48, flexShrink: 0 }}>{m.training.set(i + 1)}</Typography>
                                                                {(['reps', 'kg'] as const).map((field) => (
                                                                    <TextField
                                                                        key={field}
                                                                        size="small"
                                                                        label={field === 'reps' ? w.repsField : w.kgField}
                                                                        type="number"
                                                                        value={row[field]}
                                                                        placeholder={prev ? String(prev[field] ?? '') : ''}
                                                                        onChange={(e) => setField(id, i, field, e.target.value)}
                                                                        disabled={locked || saving === id}
                                                                        InputLabelProps={{ shrink: true }}
                                                                        inputProps={{
                                                                            min: 0,
                                                                            step: field === 'kg' ? 0.5 : 1,
                                                                            inputMode: field === 'kg' ? 'decimal' : 'numeric',
                                                                        }}
                                                                        sx={{ width: { xs: 70, sm: 120 }, flexShrink: 0 }}
                                                                    />
                                                                ))}
                                                                <TextField
                                                                    size="small"
                                                                    label={m.common.notes}
                                                                    value={row.notes}
                                                                    placeholder={prev?.notes ?? ''}
                                                                    onChange={(e) => setField(id, i, 'notes', e.target.value)}
                                                                    disabled={locked || saving === id}
                                                                    InputLabelProps={{ shrink: true }}
                                                                    sx={{ flex: 1, minWidth: 0 }}
                                                                />
                                                                {!locked && (
                                                                    <IconButton
                                                                        aria-label={w.removeSet(i + 1)}
                                                                        size="small"
                                                                        disabled={!removable || saving === id}
                                                                        onClick={() => updateSets(id, (rows) => rows.filter((_, j) => j !== i))}
                                                                    >
                                                                        <CloseIcon fontSize="small" />
                                                                    </IconButton>
                                                                )}
                                                            </Box>
                                                        )
                                                    })}
                                                </Stack>

                                                {!locked && !isEditing && previous.length > 0 && (
                                                    <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
                                                        {w.emptyUsesLast}
                                                    </Typography>
                                                )}
                                                {errors[id] && <Typography color="error" sx={{ mt: 1 }}>{errors[id]}</Typography>}

                                                {locked ? (
                                                    <Box sx={{ mt: 2, textAlign: 'right' }}>
                                                        <Button key="edit" startIcon={<EditIcon />} onClick={() => startEditing(id)}>
                                                            {m.common.edit}
                                                        </Button>
                                                    </Box>
                                                ) : (
                                                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
                                                        <Button
                                                            key="add"
                                                            startIcon={<AddIcon />}
                                                            onClick={() =>
                                                                updateSets(id, (rows) => [...rows, rows[rows.length - 1] ?? EMPTY_SET])
                                                            }
                                                            disabled={saving === id}
                                                        >
                                                            {w.addSet}
                                                        </Button>
                                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                                            {isEditing && (
                                                                <Button key="cancel" onClick={() => stopEditing(id)} disabled={saving === id}>
                                                                    {m.common.cancel}
                                                                </Button>
                                                            )}
                                                            <Button key="submit" type="submit" variant="contained" disabled={saving === id}>
                                                                {isEditing
                                                                    ? (saving === id ? m.common.saving : m.common.save)
                                                                    : (saving === id ? w.logging : w.log)}
                                                            </Button>
                                                        </Box>
                                                    </Box>
                                                )}
                                            </form>
                                        </Paper>
                                    )
                                })}
                            </Stack>
                        )}
                    </TodayDropZone>
                )}
            </WithDragSidebar>

            <DragOverlay dropAnimation={null}>
                {dragging && <DragPreview name={dragging.exercise.name} />}
            </DragOverlay>
        </DndContext>
    )
}
