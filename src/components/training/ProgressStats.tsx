import { useMemo, useState } from 'react'
import {
    Box,
    Button,
    MenuItem,
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
import TrendChart, { type TrendPoint } from '../TrendChart'
import {
    formatNumber,
    formatSet,
    groupByDay,
    sessionStats,
    startOfWeek,
    weekStreak,
    type Session,
    type SessionStats,
} from '../../lib/workoutStats'
import { locale, t, useT } from '../../i18n'

type Props = {
    sessions: Session[]
    exerciseId: string | null
    onSelectExercise: (exerciseId: string) => void
}

type Metric = 'e1rm' | 'topKg' | 'volume' | 'reps'

// The labels are in the translations, under training.progress.metrics
const METRICS: { value: Metric; needsKg: boolean }[] = [
    { value: 'e1rm', needsKg: true },
    { value: 'topKg', needsKg: true },
    { value: 'volume', needsKg: true },
    { value: 'reps', needsKg: false },
]

const CHART_WEEKS = 12
const SESSIONS_PER_PAGE = 10

type SessionWithStats = SessionStats & { session: Session }

function metricValue(s: SessionWithStats, metric: Metric) {
    switch (metric) {
        case 'e1rm': return s.best1RM
        case 'topKg': return s.topSet?.kg ?? null
        case 'volume': return s.volume
        case 'reps': return s.totalReps
    }
}

function formatMetric(value: number, metric: Metric) {
    return metric === 'reps' ? formatNumber(value, 0) : `${formatNumber(value, metric === 'volume' ? 0 : 1)} ${t().units.kg}`
}

function formatShortDate(date: Date | string) {
    return new Date(date).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })
}

function formatDate(date: Date | string) {
    return new Date(date).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' })
}

// The session with the highest value; the earliest one wins a tie, it set the record first
function best(stats: SessionWithStats[], value: (s: SessionWithStats) => number | null) {
    let top: SessionWithStats | null = null
    for (const s of stats) {
        const v = value(s)
        if (v !== null && (top === null || v > value(top)!)) top = s
    }
    return top
}

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

export default function ProgressStats({ sessions, exerciseId, onSelectExercise }: Props) {
    const m = useT()
    const p = m.training.progress
    const kg = m.units.kg
    const [metric, setMetric] = useState<Metric>('e1rm')
    const [shownSessions, setShownSessions] = useState(SESSIONS_PER_PAGE)

    const days = useMemo(() => groupByDay(sessions), [sessions])

    const overview = useMemo(() => {
        const now = new Date()
        const monthAgo = new Date(now)
        monthAgo.setDate(monthAgo.getDate() - 30)
        const thisWeek = startOfWeek(now).getTime()

        return {
            first: days[days.length - 1]?.date,
            last30: days.filter((d) => d.date >= monthAgo).length,
            thisWeek: days.filter((d) => d.date.getTime() >= thisWeek).length,
            streak: weekStreak(days, now),
            sets: sessions.reduce((n, s) => n + s.sets.length, 0),
            volume30: sessions
                .filter((s) => new Date(s.createdAt) >= monthAgo)
                .reduce((n, s) => n + sessionStats(s.sets).volume, 0),
        }
    }, [days, sessions])

    const weekly = useMemo<TrendPoint[]>(() => {
        const counts = new Map<number, number>()
        for (const d of days) {
            const week = startOfWeek(d.date).getTime()
            counts.set(week, (counts.get(week) ?? 0) + 1)
        }
        const week = startOfWeek(new Date())
        week.setDate(week.getDate() - 7 * (CHART_WEEKS - 1))
        return Array.from({ length: CHART_WEEKS }, (_, i) => {
            const start = new Date(week)
            start.setDate(start.getDate() + 7 * i)
            return { x: start.getTime(), y: counts.get(start.getTime()) ?? 0, label: p.weekOf(formatShortDate(start)) }
        })
    }, [days, p])

    // Most done first, so the exercises worth tracking are at the top
    const exercises = useMemo(() => {
        const byId = new Map<string, { id: string; name: string; count: number }>()
        for (const s of sessions) {
            const e = byId.get(s.exerciseId) ?? { id: s.exerciseId, name: s.name, count: 0 }
            e.count++
            byId.set(s.exerciseId, e)
        }
        return [...byId.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    }, [sessions])

    const selectedId = exerciseId && exercises.some((e) => e.id === exerciseId) ? exerciseId : exercises[0]?.id

    // Oldest first, the way the chart reads
    const stats = useMemo<SessionWithStats[]>(
        () => sessions
            .filter((s) => s.exerciseId === selectedId)
            .reverse()
            .map((session) => ({ session, ...sessionStats(session.sets) })),
        [sessions, selectedId]
    )

    // Without any weight logged (e.g. bodyweight exercises) only reps say anything
    const hasKg = stats.some((s) => s.topSet)
    const activeMetric = hasKg ? metric : 'reps'
    const metricLabel = p.metrics[activeMetric]

    const points: TrendPoint[] = stats.flatMap((s) => {
        const y = metricValue(s, activeMetric)
        return y === null ? [] : [{ x: new Date(s.session.createdAt).getTime(), y, label: formatDate(s.session.createdAt) }]
    })

    const heaviest = best(stats, (s) => (s.topSet ? (s.topSet.kg ?? 0) * 1000 + (s.topSet.reps ?? 0) : null))
    const best1RM = best(stats, (s) => s.best1RM)
    const mostReps = best(stats, (s) => s.maxReps)
    const bestVolume = best(stats, (s) => (s.volume > 0 ? s.volume : null))
    const firstKg = stats.find((s) => s.topSet)?.topSet?.kg
    const lastKg = stats.findLast((s) => s.topSet)?.topSet?.kg
    const kgChange = firstKg != null && lastKg != null ? lastKg - firstKg : null

    return (
        <>
            <Typography variant="h6">{p.overview}</Typography>
            <Box sx={{ ...tileGrid, mt: 1 }}>
                <StatTile
                    label={p.workouts}
                    value={String(days.length)}
                    detail={overview.first && p.since(formatDate(overview.first))}
                />
                <StatTile label={p.last30} value={String(overview.last30)} detail={p.workoutDays} />
                <StatTile label={p.thisWeek} value={String(overview.thisWeek)} detail={p.workoutDays} />
                <StatTile
                    label={p.weekStreak}
                    value={String(overview.streak)}
                    detail={p.weeksInARow(overview.streak)}
                />
                <StatTile label={p.setsLogged} value={formatNumber(overview.sets, 0)} detail={p.allTime} />
                <StatTile label={p.volume} value={`${formatNumber(overview.volume30, 0)} ${kg}`} detail={p.last30Days} />
            </Box>

            <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                    {p.workoutDaysPerWeek}
                </Typography>
                <TrendChart
                    kind="bar"
                    height={180}
                    points={weekly}
                    formatValue={(y) => formatNumber(y, 0)}
                    formatTick={(p) => formatShortDate(new Date(p.x))}
                    ariaLabel={p.workoutDaysChartAria(CHART_WEEKS)}
                />
            </Paper>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, mt: 4 }}>
                <Typography variant="h6" sx={{ flexGrow: 1 }}>{p.exerciseProgress}</Typography>
                <TextField
                    select
                    size="small"
                    label={p.exercise}
                    value={selectedId ?? ''}
                    onChange={(e) => {
                        setShownSessions(SESSIONS_PER_PAGE)
                        onSelectExercise(e.target.value)
                    }}
                    sx={{ minWidth: 220 }}
                >
                    {exercises.map((e) => (
                        <MenuItem key={e.id} value={e.id}>
                            {e.name}
                            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                                {e.count}×
                            </Typography>
                        </MenuItem>
                    ))}
                </TextField>
            </Box>

            <Box sx={{ ...tileGrid, mt: 1.5 }}>
                <StatTile
                    label={p.sessions}
                    value={String(stats.length)}
                    detail={stats.length > 0 ? p.lastOn(formatDate(stats[stats.length - 1].session.createdAt)) : undefined}
                />
                {heaviest?.topSet && (
                    <StatTile label={p.heaviestSet} value={formatSet(heaviest.topSet)} detail={formatDate(heaviest.session.createdAt)} />
                )}
                {best1RM?.best1RM != null && (
                    <StatTile
                        label={p.best1RM}
                        value={`${formatNumber(best1RM.best1RM, 1)} ${kg}`}
                        detail={formatDate(best1RM.session.createdAt)}
                    />
                )}
                {mostReps?.maxReps != null && (
                    <StatTile label={p.mostReps} value={String(mostReps.maxReps)} detail={formatDate(mostReps.session.createdAt)} />
                )}
                {bestVolume && (
                    <StatTile
                        label={p.bestVolume}
                        value={`${formatNumber(bestVolume.volume, 0)} ${kg}`}
                        detail={formatDate(bestVolume.session.createdAt)}
                    />
                )}
                {kgChange !== null && stats.length > 1 && (
                    <StatTile
                        label={p.topWeightChange}
                        value={`${kgChange > 0 ? '+' : ''}${formatNumber(kgChange, 2)} ${kg}`}
                        detail={p.sinceFirstSession}
                    />
                )}
            </Box>

            <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 500, flexGrow: 1 }}>
                        {p.perSession(metricLabel)}
                    </Typography>
                    <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={activeMetric}
                        onChange={(_, value: Metric | null) => value && setMetric(value)}
                    >
                        {METRICS.map((metric) => (
                            <ToggleButton key={metric.value} value={metric.value} disabled={metric.needsKg && !hasKg} sx={{ textTransform: 'none' }}>
                                {p.metrics[metric.value]}
                            </ToggleButton>
                        ))}
                    </ToggleButtonGroup>
                </Box>
                {points.length < 2 ? (
                    <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                        {p.needTwoSessions}
                    </Typography>
                ) : (
                    <TrendChart
                        points={points}
                        formatValue={(y) => formatMetric(y, activeMetric)}
                        formatTick={(p) => formatShortDate(new Date(p.x))}
                        ariaLabel={p.perSession(metricLabel)}
                    />
                )}
                {activeMetric === 'e1rm' && points.length >= 2 && (
                    <Typography variant="caption" color="text.secondary">
                        {p.e1rmNote}
                    </Typography>
                )}
            </Paper>

            <Paper variant="outlined" sx={{ mt: 2, overflowX: 'auto' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>{p.date}</TableCell>
                            <TableCell>{p.sets}</TableCell>
                            <TableCell align="right">{p.metrics.e1rm}</TableCell>
                            <TableCell align="right">{p.volume}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {stats.slice().reverse().slice(0, shownSessions).map((s) => (
                            <TableRow key={s.session.key}>
                                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(s.session.createdAt)}</TableCell>
                                <TableCell>{s.session.sets.map(formatSet).join(', ')}</TableCell>
                                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                    {s.best1RM !== null ? `${formatNumber(s.best1RM, 1)} ${kg}` : '–'}
                                </TableCell>
                                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                    {s.volume > 0 ? `${formatNumber(s.volume, 0)} ${kg}` : '–'}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {shownSessions < stats.length && (
                    <Box sx={{ textAlign: 'center', p: 1 }}>
                        <Button onClick={() => setShownSessions((n) => n + SESSIONS_PER_PAGE)}>{p.showMoreSessions}</Button>
                    </Box>
                )}
            </Paper>
        </>
    )
}
