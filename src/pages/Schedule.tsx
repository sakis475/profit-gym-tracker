import { useEffect, useState } from 'react'
import PullToRefresh from 'react-simple-pull-to-refresh'
import { getSchedules, createSchedule, updateSchedule, deleteSchedule } from '../services/schedule'
import { getExercises } from '../services/exercises'
import type { ExerciseRow, ScheduleInsert, ScheduleWithExercise } from '../types/entityTypes'
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
    CircularProgress,
    useMediaQuery,
    useTheme,
} from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Refresh as RefreshIcon } from '@mui/icons-material'

// Stored day is the day of the week, 0 (Sunday) to 6 (Saturday), same as Date.getDay()
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_SHORT_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
// Displayed Monday first
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

export default function Schedule() {
    const [items, setItems] = useState<ScheduleWithExercise[] | null>(null)
    const [loading, setLoading] = useState(false)
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
    const theme = useTheme()
    // Swipe-to-refresh on small screens only; bigger screens use the Refresh button
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'))

    async function load() {
        setLoading(true)
        const data = await getSchedules()
        setItems(data)
        setLoading(false)
    }

    useEffect(() => {
        load()
    }, [])

    async function openModal(schedule?: ScheduleWithExercise) {
        setEditing(schedule ?? null)
        setDay(schedule?.day ?? selectedDay)
        setExerciseId(schedule?.exerciseId ?? '')
        setError(null)
        setModalOpen(true)
        setExercises((await getExercises()) ?? [])
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
        load()
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
        load()
    }

    const dayItems = (items ?? []).filter((it) => it.day === selectedDay)

    const spinner = (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
        </Box>
    )

    return (
        <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="h5" sx={{ flexGrow: 1 }}>Schedule</Typography>
                <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={load}
                    disabled={loading}
                    sx={{ display: { xs: 'none', md: 'inline-flex' } }}
                >
                    Refresh
                </Button>
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
                    <ToggleButton key={d} value={d} aria-label={DAY_NAMES[d]}>
                        {DAY_SHORT_NAMES[d]}
                    </ToggleButton>
                ))}
            </ToggleButtonGroup>

            <PullToRefresh
                onRefresh={load}
                isPullable={isSmallScreen}
                pullingContent={spinner}
                refreshingContent={spinner}
            >
                <Box sx={{ minHeight: '60vh' }}>
                    {loading && !items ? (
                        <Typography>Loading...</Typography>
                    ) : (
                        <List>
                            {dayItems.length > 0 ? (
                                dayItems.map((it) => (
                                    <ListItem
                                        key={it.id}
                                        secondaryAction={
                                            <>
                                                <IconButton aria-label="Edit schedule" onClick={() => openModal(it)}>
                                                    <EditIcon />
                                                </IconButton>
                                                <IconButton aria-label="Delete schedule" onClick={() => { setError(null); setDeleting(it) }}>
                                                    <DeleteIcon />
                                                </IconButton>
                                            </>
                                        }
                                    >
                                        <ListItemText primary={it.exercises.name} secondary={it.exercises.category} />
                                    </ListItem>
                                ))
                            ) : (
                                <Typography>Nothing scheduled for {DAY_NAMES[selectedDay]}.</Typography>
                            )}
                        </List>
                    )}
                </Box>
            </PullToRefresh>

            <Dialog open={modalOpen} onClose={closeModal}>
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
                        >
                            {exercises.map((ex) => (
                                <MenuItem key={ex.id} value={ex.id}>{ex.name}</MenuItem>
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
        </>
    )
}
