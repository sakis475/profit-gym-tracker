import { useEffect, useMemo, useState } from 'react'
import { getSchedules, createSchedule, updateSchedule, deleteSchedule, reorderSchedules } from '../../services/schedule'
import { getExercises } from '../../services/exercises'
import type { ExerciseRow, ScheduleInsert, ScheduleWithExercise } from '../../types/entityTypes'
import {
    Typography,
    Button,
    Box,
    List,
    ListItem,
    ListItemText,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    MenuItem,
    ToggleButton,
    ToggleButtonGroup,
    IconButton,
    type ToggleButtonProps,
} from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, DragIndicator as DragIndicatorIcon } from '@mui/icons-material'
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    KeyboardSensor,
    useDroppable,
    useSensor,
    useSensors,
    closestCenter,
    pointerWithin,
    type CollisionDetection,
    type DragEndEvent,
    type DragStartEvent,
} from '@dnd-kit/core'
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
    sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DragPreview, WithDragSidebar, type SidebarItem } from '../DragSidebar'

// Stored day is the day of the week, 0 (Sunday) to 6 (Saturday), same as Date.getDay()
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_SHORT_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
// Displayed Monday first
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

// An exercise dragged from the list
type ExerciseDragData = { kind: 'exercise'; exercise: ExerciseRow }
// Where things can be dropped: a day's button, or the list of the day shown
type DropData = { target: 'day' | 'list'; day: number }

function sortExercises(exercises: ExerciseRow[]) {
    return [...exercises].sort((a, b) => {
        const catCompare = (a.category ?? '').localeCompare(b.category ?? '')
        if (catCompare !== 0) return catCompare
        return a.name.localeCompare(b.name)
    })
}

function SortableScheduleItem({
    item,
    index,
    onEdit,
    onDelete,
}: {
    item: ScheduleWithExercise
    index: number
    onEdit: () => void
    onDelete: () => void
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })

    return (
        <ListItem
            ref={setNodeRef}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
                opacity: isDragging ? 0.5 : 1,
            }}
            secondaryAction={
                <>
                    <IconButton aria-label="Edit schedule" onClick={onEdit}>
                        <EditIcon />
                    </IconButton>
                    <IconButton aria-label="Delete schedule" onClick={onDelete}>
                        <DeleteIcon />
                    </IconButton>
                </>
            }
        >
            <Box
                aria-label="Drag to reorder, or onto a day to move it there"
                {...attributes}
                {...listeners}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    mr: 2,
                    color: 'text.secondary',
                    cursor: 'grab',
                    touchAction: 'none',
                }}
            >
                <DragIndicatorIcon fontSize="small" sx={{ mr: 0.5 }} />
                <Typography sx={{ minWidth: 16 }}>{index + 1}.</Typography>
            </Box>
            <ListItemText primary={item.exercises.name} secondary={item.exercises.category} />
        </ListItem>
    )
}

// A day's button, which also takes drops. ToggleButtonGroup passes its props on to it.
function DayButton({ day, highlight, sx, ...props }: ToggleButtonProps & { day: number; highlight: boolean }) {
    const { setNodeRef, isOver } = useDroppable({ id: `day:${day}`, data: { target: 'day', day } satisfies DropData })

    return (
        <ToggleButton
            ref={setNodeRef}
            {...props}
            sx={{
                ...sx,
                ...(highlight && { borderStyle: 'dashed' }),
                ...(isOver && {
                    outline: (theme) => `2px solid ${theme.palette.primary.main}`,
                    outlineOffset: -2,
                    bgcolor: 'action.hover',
                    zIndex: 1,
                }),
            }}
        />
    )
}

// The shown day's list, which takes exercises dropped from the list beside it
function DayList({ day, highlight, children }: { day: number; highlight: boolean; children: React.ReactNode }) {
    const { setNodeRef, isOver } = useDroppable({ id: 'day-list', data: { target: 'list', day } satisfies DropData })

    return (
        <Box
            ref={setNodeRef}
            sx={{
                minHeight: '40vh',
                mt: 1,
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

export default function Schedule() {
    const [items, setItems] = useState<ScheduleWithExercise[] | null>(null)
    const [loadFailed, setLoadFailed] = useState(false)
    const [version, setVersion] = useState(0)
    const [modalOpen, setModalOpen] = useState(false)
    const [creating, setCreating] = useState(false)
    const [selectedDay, setSelectedDay] = useState(() => new Date().getDay())
    const [day, setDay] = useState(1)
    const [exerciseId, setExerciseId] = useState('')
    const [exercises, setExercises] = useState<ExerciseRow[]>([])
    const [error, setError] = useState<string | null>(null)
    const [editing, setEditing] = useState<ScheduleWithExercise | null>(null)
    const [deleting, setDeleting] = useState<ScheduleWithExercise | null>(null)
    const [deleteBusy, setDeleteBusy] = useState(false)
    // An exercise being dragged from the list, while the drop targets show themselves
    const [dragging, setDragging] = useState<ExerciseDragData | null>(null)
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    useEffect(() => {
        let cancelled = false
        Promise.all([getSchedules(), getExercises()]).then(([schedules, fetched]) => {
            if (cancelled) return
            if (schedules) setItems(schedules)
            setLoadFailed(!schedules)
            setExercises(sortExercises(fetched ?? []))
        })
        return () => {
            cancelled = true
        }
    }, [version])

    const reload = () => setVersion((v) => v + 1)

    const sidebarItems = useMemo<SidebarItem[]>(
        () => exercises.map((exercise) => ({
            dragId: `exercise:${exercise.id}`,
            name: exercise.name,
            detail: exercise.category,
            data: { kind: 'exercise', exercise } satisfies ExerciseDragData,
        })),
        [exercises]
    )

    function openModal(schedule?: ScheduleWithExercise) {
        setEditing(schedule ?? null)
        setDay(schedule?.day ?? selectedDay)
        setExerciseId(schedule?.exerciseId ?? '')
        setError(null)
        setModalOpen(true)
    }

    function closeModal() {
        setModalOpen(false)
        setEditing(null)
        setExerciseId('')
    }

    async function handleSubmit(e?: React.FormEvent) {
        e?.preventDefault()
        setError(null)
        if (!exerciseId) {
            setError('Exercise is required')
            return
        }
        setCreating(true)
        const payload: Partial<ScheduleInsert> = { day, exerciseId }
        const res = editing
            ? await updateSchedule(editing.id, payload)
            : await createSchedule(payload as ScheduleInsert)
        setCreating(false)
        if (!res) {
            setError(editing ? 'Failed to update schedule' : 'Failed to create schedule')
            return
        }
        setSelectedDay(day)
        closeModal()
        reload()
    }

    async function handleDelete() {
        if (!deleting) return
        setDeleteBusy(true)
        const res = await deleteSchedule(deleting.id)
        setDeleteBusy(false)
        if (!res) {
            setError('Failed to delete schedule')
            return
        }
        setDeleting(null)
        reload()
    }

    const dayItems = (items ?? []).filter((it) => it.day === selectedDay)
    const dayItemIds = new Set(dayItems.map((it) => it.id))
    // Something added to a day goes last
    const countOn = (d: number) => (items ?? []).filter((it) => it.day === d).length

    // A day button under the pointer always wins. Otherwise an exercise from the list lands on
    // the shown day's list, and a planned exercise sorts among the others of its day.
    const collisionDetection: CollisionDetection = (args) => {
        const targets = (target: DropData['target']) =>
            args.droppableContainers.filter((c) => (c.data.current as DropData | undefined)?.target === target)
        const onDay = pointerWithin({ ...args, droppableContainers: targets('day') })
        if (onDay.length > 0) return onDay
        if ((args.active.data.current as ExerciseDragData | undefined)?.kind === 'exercise') {
            return pointerWithin({ ...args, droppableContainers: targets('list') })
        }
        return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => dayItemIds.has(String(c.id))) })
    }

    async function handleDragEnd({ active, over }: DragEndEvent) {
        setDragging(null)
        if (!over) return
        const drop = over.data.current as DropData | undefined
        setError(null)

        // An exercise from the list: added to the day it was dropped on, which is then shown
        const dragged = active.data.current as ExerciseDragData | undefined
        if (dragged?.kind === 'exercise') {
            if (!drop) return
            const res = await createSchedule({ day: drop.day, exerciseId: dragged.exercise.id, order: countOn(drop.day) })
            if (!res) return setError(`Failed to add ${dragged.exercise.name}`)
            setSelectedDay(drop.day)
            reload()
            return
        }

        // A planned exercise dropped on another day's button moves to that day
        if (drop?.target === 'day') {
            const item = dayItems.find((it) => it.id === active.id)
            if (!item || drop.day === item.day) return
            const res = await updateSchedule(item.id, { day: drop.day, order: countOn(drop.day) })
            if (!res) return setError(`Failed to move ${item.exercises.name}`)
            reload()
            return
        }

        if (active.id === over.id) return
        const oldIndex = dayItems.findIndex((it) => it.id === active.id)
        const newIndex = dayItems.findIndex((it) => it.id === over.id)
        if (oldIndex === -1 || newIndex === -1) return

        const reordered = arrayMove(dayItems, oldIndex, newIndex)
        const reorderedIds = new Set(reordered.map((it) => it.id))

        setItems((prev) => {
            if (!prev) return prev
            const others = prev.filter((it) => !reorderedIds.has(it.id))
            return [...others, ...reordered]
        })

        reorderSchedules(reordered.map((it) => it.id)).then((ok) => {
            if (!ok) setError('Failed to save new order')
        })
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={({ active }: DragStartEvent) => {
                const data = active.data.current as ExerciseDragData | undefined
                setDragging(data?.kind === 'exercise' ? data : null)
            }}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setDragging(null)}
        >
            <WithDragSidebar
                title="Exercises: drag onto a day"
                items={sidebarItems}
                emptyText="No exercises yet. Add them in the Exercises tab."
            >
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => openModal()}>
                        Add to schedule
                    </Button>
                </Box>

                <ToggleButtonGroup
                    exclusive
                    fullWidth
                    color="primary"
                    value={selectedDay}
                    onChange={(_, value: number | null) => {
                        if (value !== null) setSelectedDay(value)
                    }}
                    aria-label="Day of the week"
                    sx={{ mt: 2 }}
                >
                    {DAY_ORDER.map((d) => (
                        <DayButton key={d} day={d} value={d} highlight={!!dragging} aria-label={DAY_NAMES[d]}>
                            {DAY_SHORT_NAMES[d]}
                        </DayButton>
                    ))}
                </ToggleButtonGroup>

                {error && !modalOpen && !deleting && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}

                {loadFailed && !items ? (
                    <Typography color="error" sx={{ mt: 2 }}>Failed to load your schedule.</Typography>
                ) : !items ? (
                    <Typography sx={{ mt: 2 }}>Loading...</Typography>
                ) : (
                    <DayList day={selectedDay} highlight={!!dragging}>
                        <List>
                            {dayItems.length > 0 ? (
                                <SortableContext items={dayItems.map((it) => it.id)} strategy={verticalListSortingStrategy}>
                                    {dayItems.map((it, index) => (
                                        <SortableScheduleItem
                                            key={it.id}
                                            item={it}
                                            index={index}
                                            onEdit={() => openModal(it)}
                                            onDelete={() => { setError(null); setDeleting(it) }}
                                        />
                                    ))}
                                </SortableContext>
                            ) : (
                                <Typography sx={{ px: 2 }}>
                                    Nothing scheduled for {DAY_NAMES[selectedDay]}.
                                    {/* Only where the exercise list is shown */}
                                    <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}> Drag exercises here.</Box>
                                </Typography>
                            )}
                        </List>
                    </DayList>
                )}
            </WithDragSidebar>

            <DragOverlay dropAnimation={null}>
                {dragging && <DragPreview name={dragging.exercise.name} />}
            </DragOverlay>

            <Dialog open={modalOpen} onClose={closeModal} fullWidth maxWidth="sm">
                <DialogTitle>{editing ? 'Edit schedule' : 'Add to schedule'}</DialogTitle>
                <form onSubmit={handleSubmit}>
                    <DialogContent>
                        <TextField
                            select
                            label="Day"
                            value={day}
                            onChange={(e) => setDay(Number(e.target.value))}
                            fullWidth
                            sx={{ mt: 1, mb: 2 }}
                        >
                            {DAY_ORDER.map((d) => (
                                <MenuItem key={d} value={d}>{DAY_NAMES[d]}</MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            select
                            label="Exercise"
                            value={exercises.some((ex) => ex.id === exerciseId) ? exerciseId : ''}
                            onChange={(e) => setExerciseId(e.target.value)}
                            fullWidth
                            required
                            helperText={exercises.length === 0 ? 'Create an exercise first' : undefined}
                            SelectProps={{
                                renderValue: (value) => exercises.find((ex) => ex.id === value)?.name ?? '',
                            }}
                        >
                            {exercises.map((ex) => (
                                <MenuItem key={ex.id} value={ex.id}>
                                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                        <Typography variant="body1">{ex.name}</Typography>
                                        {ex.category && (
                                            <Typography variant="caption" color="text.secondary">{ex.category}</Typography>
                                        )}
                                    </Box>
                                </MenuItem>
                            ))}
                        </TextField>
                        {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={closeModal} disabled={creating}>Cancel</Button>
                        <Button type="submit" variant="contained" disabled={creating}>
                            {editing ? (creating ? 'Saving…' : 'Save') : (creating ? 'Adding…' : 'Add')}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            <Dialog open={!!deleting} onClose={() => setDeleting(null)}>
                <DialogTitle>Remove from schedule</DialogTitle>
                <DialogContent>
                    <Typography>
                        Remove "{deleting?.exercises.name}" from {deleting ? DAY_NAMES[deleting.day] : ''}?
                    </Typography>
                    {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleting(null)} disabled={deleteBusy}>Cancel</Button>
                    <Button color="error" variant="contained" onClick={handleDelete} disabled={deleteBusy}>
                        {deleteBusy ? 'Removing…' : 'Remove'}
                    </Button>
                </DialogActions>
            </Dialog>
        </DndContext>
    )
}
