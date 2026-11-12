import { useMemo } from 'react'
import {
    Box,
    Button,
    Divider,
    IconButton,
    InputAdornment,
    Link,
    Pagination,
    Paper,
    Stack,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material'
import { Close as CloseIcon, Search as SearchIcon } from '@mui/icons-material'
import {
    filterDays,
    formatNumber,
    formatSet,
    groupByDay,
    NO_FILTERS,
    sessionStats,
    type LogFilters,
    type Session,
} from '../../lib/workoutStats'
import { locale, useT } from '../../i18n'

type Props = {
    sessions: Session[]
    filters: LogFilters
    onFiltersChange: (filters: LogFilters) => void
    page: number
    onPageChange: (page: number) => void
    onSelectExercise: (exerciseId: string) => void
}

const DAYS_PER_PAGE = 10

// Monday first, matching how weeks are counted; values are Date.getDay() numbers
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0]

function formatDay(date: Date) {
    return date.toLocaleDateString(locale(), {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
    })
}

export default function HistoryLog({ sessions, filters, onFiltersChange, page, onPageChange, onSelectExercise }: Props) {
    const m = useT()
    const h = m.training.history
    const days = useMemo(() => groupByDay(sessions), [sessions])
    const filtered = useMemo(() => filterDays(days, filters), [days, filters])

    const pageCount = Math.max(1, Math.ceil(filtered.length / DAYS_PER_PAGE))
    // The page can be past the end when the data shrinks under it
    const currentPage = Math.min(page, pageCount)
    const pageStart = (currentPage - 1) * DAYS_PER_PAGE
    const pageDays = filtered.slice(pageStart, pageStart + DAYS_PER_PAGE)

    const filtering = filters.query !== '' || filters.weekdays.length > 0 || filters.from !== '' || filters.to !== ''

    function setFilter<K extends keyof LogFilters>(key: K, value: LogFilters[K]) {
        onFiltersChange({ ...filters, [key]: value })
    }

    function changePage(next: number) {
        onPageChange(next)
        window.scrollTo({ top: 0 })
    }

    return (
        <>
            <Paper variant="outlined" sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                    <TextField
                        size="small"
                        placeholder={h.searchPlaceholder}
                        value={filters.query}
                        onChange={(e) => setFilter('query', e.target.value)}
                        sx={{ flex: '1 1 240px' }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small" />
                                </InputAdornment>
                            ),
                            endAdornment: filters.query && (
                                <InputAdornment position="end">
                                    <IconButton size="small" aria-label={h.clearSearch} onClick={() => setFilter('query', '')}>
                                        <CloseIcon fontSize="small" />
                                    </IconButton>
                                </InputAdornment>
                            ),
                        }}
                    />
                    <TextField
                        size="small"
                        type="date"
                        label={h.from}
                        value={filters.from}
                        onChange={(e) => setFilter('from', e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        inputProps={{ max: filters.to || undefined }}
                        sx={{ flex: '1 1 150px' }}
                    />
                    <TextField
                        size="small"
                        type="date"
                        label={h.to}
                        value={filters.to}
                        onChange={(e) => setFilter('to', e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        inputProps={{ min: filters.from || undefined }}
                        sx={{ flex: '1 1 150px' }}
                    />
                </Box>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mt: 1.5 }}>
                    <ToggleButtonGroup
                        size="small"
                        value={filters.weekdays}
                        onChange={(_, value: number[]) => setFilter('weekdays', value)}
                        aria-label={h.daysOfWeek}
                        sx={{ flexWrap: 'wrap' }}
                    >
                        {WEEKDAYS.map((d) => (
                            <ToggleButton key={d} value={d} sx={{ textTransform: 'none', px: 1.25 }}>
                                {m.days.short[d]}
                            </ToggleButton>
                        ))}
                    </ToggleButtonGroup>
                    <Box sx={{ flexGrow: 1 }} />
                    {filtering && (
                        <Button size="small" onClick={() => onFiltersChange(NO_FILTERS)}>
                            {h.clearFilters}
                        </Button>
                    )}
                </Box>
            </Paper>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 2, mb: 1 }}>
                {filtered.length === 0
                    ? h.noMatches
                    : h.showing(pageStart + 1, pageStart + pageDays.length, filtered.length)}
            </Typography>

            <Stack spacing={2}>
                {pageDays.map((day) => {
                    const setCount = day.sessions.reduce((n, s) => n + s.sets.length, 0)
                    const volume = day.sessions.reduce((n, s) => n + sessionStats(s.sets).volume, 0)

                    return (
                        <Paper key={day.key} variant="outlined" sx={{ p: 2 }}>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 2 }}>
                                <Typography variant="h6" sx={{ flexGrow: 1 }}>{formatDay(day.date)}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {h.exercises(day.sessions.length)}
                                    {' · '}{h.sets(setCount)}
                                    {volume > 0 && ` · ${h.volume(formatNumber(volume, 0))}`}
                                </Typography>
                            </Box>

                            <Stack divider={<Divider flexItem />} spacing={1.5} sx={{ mt: 1.5 }}>
                                {day.sessions.map((session) => (
                                    <Box key={session.key}>
                                        <Link
                                            component="button"
                                            type="button"
                                            underline="hover"
                                            color="inherit"
                                            onClick={() => onSelectExercise(session.exerciseId)}
                                            sx={{ fontWeight: 500, textAlign: 'left' }}
                                        >
                                            {session.name}
                                        </Link>
                                        {session.category && (
                                            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                                                {session.category}
                                            </Typography>
                                        )}
                                        <Stack spacing={0.25} sx={{ mt: 0.5 }}>
                                            {session.sets.map((w) => (
                                                <Typography key={w.id} variant="body2" sx={{ display: 'flex', gap: 1.5 }}>
                                                    <Box component="span" sx={{ width: 48, flexShrink: 0, color: 'text.secondary' }}>
                                                        {m.training.set(w.set ?? 0)}
                                                    </Box>
                                                    <Box component="span" sx={{ minWidth: 96 }}>{formatSet(w)}</Box>
                                                    {w.notes && (
                                                        <Box component="span" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                                                            {w.notes}
                                                        </Box>
                                                    )}
                                                </Typography>
                                            ))}
                                        </Stack>
                                    </Box>
                                ))}
                            </Stack>
                        </Paper>
                    )
                })}
            </Stack>

            {pageCount > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                    <Pagination
                        count={pageCount}
                        page={currentPage}
                        onChange={(_, next) => changePage(next)}
                        color="primary"
                        siblingCount={1}
                        boundaryCount={1}
                    />
                </Box>
            )}
        </>
    )
}
