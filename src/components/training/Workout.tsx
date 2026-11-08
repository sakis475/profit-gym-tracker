import { useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { getSchedules } from '../../services/schedule'
import { getLastWorkoutSets, getMaxSet, getWorkoutsSince, createWorkoutSets, replaceWorkoutSets } from '../../services/workout'
import { formatSet } from '../../lib/workoutStats'
import type { ScheduleWithExercise, WorkoutRow } from '../../types/entityTypes'
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

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

type SetFields = { reps: string; kg: string; notes: string }
const EMPTY_SET: SetFields = { reps: '', kg: '', notes: '' }

function startOfToday() {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
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

export default function Workout() {
    const today = new Date().getDay()
    const [items, setItems] = useState<ScheduleWithExercise[]>([])
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
            const [schedules, todays] = await Promise.all([getSchedules(today), getWorkoutsSince(start)])
            if (cancelled) return
            if (!schedules) {
                setLoadError(true)
                setLoading(false)
                return
            }

            const [lastSets, maxSets] = await Promise.all([
                Promise.all(schedules.map((s) => getLastWorkoutSets(s.exerciseId, start))),
                Promise.all(schedules.map((s) => getMaxSet(s.exerciseId, start))),
            ])
            if (cancelled) return

            setItems(schedules)
            setLast(Object.fromEntries(schedules.map((s, i) => [s.exerciseId, lastSets[i] ?? []])))
            setMax(Object.fromEntries(schedules.map((s, i) => [s.exerciseId, maxSets[i]])))
            setLogged(groupByExercise(todays ?? []))
            setLoading(false)
        }

        init()
        return () => {
            cancelled = true
        }
    }, [today])

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

        // The set number is the row position, empty rows are skipped
        const rows: { set: number; reps: number | null; kg: number | null; notes: string | null }[] = []
        for (const [i, { reps, kg, notes }] of draftSets(exerciseId).entries()) {
            if (!reps && !kg) continue
            const repsNum = reps ? Number(reps) : null
            const kgNum = kg ? Number(kg) : null
            if ((repsNum !== null && !(Number.isInteger(repsNum) && repsNum >= 0)) || (kgNum !== null && !(kgNum >= 0))) {
                setError(exerciseId, `Set ${i + 1}: reps must be a whole number, kg a positive number`)
                return
            }
            rows.push({ set: i + 1, reps: repsNum, kg: kgNum, notes: notes.trim() || null })
        }
        if (rows.length === 0) {
            setError(exerciseId, 'Enter reps or kg for at least one set')
            return
        }

        // Editing keeps the workout's createdAt, so it stays the same workout
        const existing = editing[exerciseId] ? logged[exerciseId] : undefined
        setSaving(exerciseId)
        const res = existing
            ? await replaceWorkoutSets(exerciseId, existing[0].createdAt, rows)
            : await createWorkoutSets(rows.map((row) => ({ ...row, exerciseId, createdAt: new Date().toISOString() })))
        setSaving(null)
        if (!res) {
            setError(exerciseId, existing ? 'Failed to save changes' : 'Failed to log workout')
            return
        }
        setLogged((prev) => ({ ...prev, [exerciseId]: res }))
        stopEditing(exerciseId)
    }

    return (
        <>
            <Typography variant="h6">{DAY_NAMES[today]}</Typography>

            {loading ? (
                <Typography sx={{ mt: 2 }}>Loading...</Typography>
            ) : loadError ? (
                <Typography color="error" sx={{ mt: 2 }}>Failed to load today's workout.</Typography>
            ) : items.length === 0 ? (
                <Typography sx={{ mt: 2 }}>
                    Nothing planned for {DAY_NAMES[today]}. Add exercises in the{' '}
                    <Link component={RouterLink} to="/training?tab=plan">Plan</Link>.
                </Typography>
            ) : (
                <Stack spacing={2} sx={{ mt: 2 }}>
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
                            <Paper key={it.id} variant="outlined" sx={{ p: 2 }}>
                                <form onSubmit={(e) => handleLog(id, e)}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Box sx={{ flexGrow: 1 }}>
                                            <Typography variant="h6">{it.exercises.name}</Typography>
                                            {it.exercises.category && (
                                                <Typography variant="body2" color="text.secondary">
                                                    {it.exercises.category}
                                                </Typography>
                                            )}
                                        </Box>
                                        {newMax && (
                                            <Chip color="warning" size="small" icon={<TrophyIcon />} label="New max" />
                                        )}
                                        {done && (
                                            <Chip
                                                color={isEditing ? 'default' : 'success'}
                                                size="small"
                                                icon={isEditing ? <EditIcon /> : <CheckIcon />}
                                                label={isEditing ? 'Editing' : 'Logged'}
                                            />
                                        )}
                                    </Box>

                                    <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', columnGap: 3 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            {previous.length > 0
                                                ? `Previous workout: ${formatDate(previous[0].createdAt)}`
                                                : 'No previous workout'}
                                        </Typography>
                                        {best && (
                                            <Typography variant="body2" color="text.secondary">
                                                Max:{' '}
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
                                                    <Typography sx={{ width: 48, flexShrink: 0 }}>Set {i + 1}</Typography>
                                                    {(['reps', 'kg'] as const).map((field) => (
                                                        <TextField
                                                            key={field}
                                                            size="small"
                                                            label={field === 'reps' ? 'Reps' : 'Kg'}
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
                                                        label="Notes"
                                                        value={row.notes}
                                                        placeholder={prev?.notes ?? ''}
                                                        onChange={(e) => setField(id, i, 'notes', e.target.value)}
                                                        disabled={locked || saving === id}
                                                        InputLabelProps={{ shrink: true }}
                                                        sx={{ flex: 1, minWidth: 0 }}
                                                    />
                                                    {!locked && (
                                                        <IconButton
                                                            aria-label={`Remove set ${i + 1}`}
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

                                    {errors[id] && <Typography color="error" sx={{ mt: 1 }}>{errors[id]}</Typography>}

                                    {locked ? (
                                        <Box sx={{ mt: 2, textAlign: 'right' }}>
                                            <Button key="edit" startIcon={<EditIcon />} onClick={() => startEditing(id)}>
                                                Edit
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
                                                Add set
                                            </Button>
                                            <Box sx={{ display: 'flex', gap: 1 }}>
                                                {isEditing && (
                                                    <Button key="cancel" onClick={() => stopEditing(id)} disabled={saving === id}>
                                                        Cancel
                                                    </Button>
                                                )}
                                                <Button key="submit" type="submit" variant="contained" disabled={saving === id}>
                                                    {isEditing
                                                        ? (saving === id ? 'Saving…' : 'Save')
                                                        : (saving === id ? 'Logging…' : 'Log')}
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
        </>
    )
}
