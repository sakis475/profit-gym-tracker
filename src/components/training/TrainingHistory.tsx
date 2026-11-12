import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Link, Typography } from '@mui/material'
import { getWorkoutHistory } from '../../services/workout'
import { groupSessions, NO_FILTERS, type LogFilters } from '../../lib/workoutStats'
import type { WorkoutWithExercise } from '../../types/entityTypes'
import HistoryLog from './HistoryLog'
import ProgressStats from './ProgressStats'
import { useT } from '../../i18n'

type Props = {
    view: 'history' | 'progress'
    // Opens the progress view, after an exercise is picked in the log
    onShowProgress: () => void
}

// The History and Progress tabs. The page keeps this mounted while switching between the two,
// so the log's filters and the chosen exercise carry over; coming back from another tab loads
// the history again, with whatever was logged meanwhile.
export default function TrainingHistory({ view, onShowProgress }: Props) {
    const m = useT()
    const [rows, setRows] = useState<WorkoutWithExercise[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState(false)
    // Exercise shown in the progress view, null for the most done one
    const [exerciseId, setExerciseId] = useState<string | null>(null)
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

    // An exercise without a name gets the current language's "Unknown exercise"
    const unknownName = m.training.unknownExercise
    const sessions = useMemo(() => groupSessions(rows, unknownName), [rows, unknownName])

    function changeFilters(next: LogFilters) {
        setFilters(next)
        setPage(1)
    }

    function showProgress(id: string) {
        setExerciseId(id)
        onShowProgress()
        window.scrollTo({ top: 0 })
    }

    if (loading) return <Typography>{m.common.loading}</Typography>
    if (loadError) return <Typography color="error">{m.training.history.failedToLoad}</Typography>
    if (sessions.length === 0) {
        return (
            <Typography>
                {m.training.history.noneYet}
                <Link component={RouterLink} to="/training">{m.training.history.todayLink}</Link>{m.training.history.tabSuffix}
            </Typography>
        )
    }

    return view === 'history' ? (
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
    )
}
