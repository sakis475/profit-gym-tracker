import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Box, Link, Tab, Tabs, Typography } from '@mui/material'
import { getWorkoutHistory } from '../services/workout'
import { groupSessions, NO_FILTERS, type LogFilters } from '../lib/workoutStats'
import type { WorkoutWithExercise } from '../types/entityTypes'
import HistoryLog from '../components/HistoryLog'
import ProgressStats from '../components/ProgressStats'

type View = 'log' | 'progress'

export default function History() {
    const [rows, setRows] = useState<WorkoutWithExercise[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState(false)
    const [view, setView] = useState<View>('log')
    // Exercise shown in the progress view, null for the most done one
    const [exerciseId, setExerciseId] = useState<string | null>(null)
    // Kept here rather than in the log, so they survive a visit to the progress view
    const [filters, setFilters] = useState<LogFilters>(NO_FILTERS)
    const [page, setPage] = useState(1)

    useEffect(() => {
        let cancelled = false

        getWorkoutHistory().then((data) => {
            if (cancelled) return
            if (data) setRows(data)
            else setLoadError(true)
            setLoading(false)
        })

        return () => {
            cancelled = true
        }
    }, [])

    const sessions = useMemo(() => groupSessions(rows), [rows])

    function changeFilters(next: LogFilters) {
        setFilters(next)
        setPage(1)
    }

    function showProgress(id: string) {
        setExerciseId(id)
        setView('progress')
        window.scrollTo({ top: 0 })
    }

    return (
        <>
            <Typography variant="h5">History</Typography>

            {loading ? (
                <Typography sx={{ mt: 2 }}>Loading...</Typography>
            ) : loadError ? (
                <Typography color="error" sx={{ mt: 2 }}>Failed to load your workout history.</Typography>
            ) : sessions.length === 0 ? (
                <Typography sx={{ mt: 2 }}>
                    No workouts logged yet. Log your first one on the{' '}
                    <Link component={RouterLink} to="/workout">Workout</Link> page.
                </Typography>
            ) : (
                <>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                        <Tabs value={view} onChange={(_, value: View) => setView(value)}>
                            <Tab value="log" label="Log" />
                            <Tab value="progress" label="Progress" />
                        </Tabs>
                    </Box>

                    {view === 'log' ? (
                        <HistoryLog
                            sessions={sessions}
                            filters={filters}
                            onFiltersChange={changeFilters}
                            page={page}
                            onPageChange={setPage}
                            onSelectExercise={showProgress}
                        />
                    ) : (
                        <ProgressStats sessions={sessions} exerciseId={exerciseId} onSelectExercise={setExerciseId} />
                    )}
                </>
            )}
        </>
    )
}
