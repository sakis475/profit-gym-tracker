import type { WorkoutRow, WorkoutWithExercise } from '../types/entityTypes'
import { locale, t } from '../i18n'

// One exercise done once: the sets logged together, sharing exerciseId and createdAt
export type Session = {
    key: string
    exerciseId: string
    name: string
    category: string | null
    createdAt: string
    sets: WorkoutRow[]
}

export type WorkoutDay = {
    key: string
    date: Date
    sessions: Session[]
}

export type SessionStats = {
    // Heaviest set: the most kg, the most reps breaking a tie
    topSet: WorkoutRow | null
    best1RM: number | null
    maxReps: number | null
    totalReps: number
    volume: number
}

// The local calendar day, so a workout late in the evening is not counted on the next day
export function dayKey(date: Date) {
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${date.getFullYear()}-${m}-${d}`
}

// Weeks start on Monday
export function startOfWeek(date: Date) {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    return d
}

export function setVolume(w: WorkoutRow) {
    return (w.kg ?? 0) * (w.reps ?? 0)
}

// Epley formula. Not meaningful past ~12 reps, but it only needs to be comparable
// between sessions of the same exercise.
export function estimate1RM(kg: number | null, reps: number | null) {
    if (!kg || !reps) return null
    return reps === 1 ? kg : kg * (1 + reps / 30)
}

// Rows come newest workout first, sets in order, so sessions come out newest first too.
// `unknownName` is what an exercise without a name is called.
export function groupSessions(rows: WorkoutWithExercise[], unknownName: string): Session[] {
    const sessions = new Map<string, Session>()
    for (const row of rows) {
        const key = `${row.exerciseId}|${row.createdAt}`
        let session = sessions.get(key)
        if (!session) {
            session = {
                key,
                exerciseId: row.exerciseId,
                name: row.exercises?.name ?? unknownName,
                category: row.exercises?.category ?? null,
                createdAt: row.createdAt,
                sets: [],
            }
            sessions.set(key, session)
        }
        session.sets.push(row)
    }
    return [...sessions.values()]
}

// Days newest first, each day's sessions in the order they were done
export function groupByDay(sessions: Session[]): WorkoutDay[] {
    const days = new Map<string, WorkoutDay>()
    for (const session of sessions) {
        const date = new Date(session.createdAt)
        const key = dayKey(date)
        let day = days.get(key)
        if (!day) {
            date.setHours(0, 0, 0, 0)
            day = { key, date, sessions: [] }
            days.set(key, day)
        }
        day.sessions.unshift(session)
    }
    return [...days.values()]
}

export function sessionStats(sets: WorkoutRow[]): SessionStats {
    let topSet: WorkoutRow | null = null
    let best1RM: number | null = null
    let maxReps: number | null = null
    let totalReps = 0
    let volume = 0

    for (const w of sets) {
        if (w.kg !== null && (
            !topSet || w.kg > (topSet.kg ?? 0) || (w.kg === topSet.kg && (w.reps ?? 0) > (topSet.reps ?? 0))
        )) {
            topSet = w
        }
        const e1rm = estimate1RM(w.kg, w.reps)
        if (e1rm !== null && (best1RM === null || e1rm > best1RM)) best1RM = e1rm
        if (w.reps !== null && (maxReps === null || w.reps > maxReps)) maxReps = w.reps
        totalReps += w.reps ?? 0
        volume += setVolume(w)
    }

    return { topSet, best1RM, maxReps, totalReps, volume }
}

// Weeks in a row with at least one workout. The current week does not break the streak
// until it is over, so it counts from last week when nothing is logged yet this week.
export function weekStreak(days: WorkoutDay[], now = new Date()) {
    const weeks = new Set(days.map((d) => startOfWeek(d.date).getTime()))
    const week = startOfWeek(now)
    if (!weeks.has(week.getTime())) week.setDate(week.getDate() - 7)

    let streak = 0
    while (weeks.has(week.getTime())) {
        streak++
        week.setDate(week.getDate() - 7)
    }
    return streak
}

export type LogFilters = {
    query: string
    // Days of the week as Date.getDay() numbers, empty for all
    weekdays: number[]
    // Inclusive YYYY-MM-DD bounds, empty for open ended
    from: string
    to: string
}

export const NO_FILTERS: LogFilters = { query: '', weekdays: [], from: '', to: '' }

// Lowercase without accents, so "πιεσεις" finds "Πιέσεις"
export function normalizeSearch(text: string) {
    return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase()
}

// Every word of the search has to appear in the exercise name, category or a set's notes
function sessionMatches(session: Session, terms: string[]) {
    const text = normalizeSearch([session.name, session.category ?? '', ...session.sets.map((w) => w.notes ?? '')].join(' '))
    return terms.every((t) => text.includes(t))
}

// Days outside the filters are left out, and the days left keep only the sessions matching the search
export function filterDays(days: WorkoutDay[], { query, weekdays, from, to }: LogFilters): WorkoutDay[] {
    const terms = normalizeSearch(query).split(/\s+/).filter(Boolean)
    const weekdaySet = new Set(weekdays)

    return days.flatMap((day) => {
        if (weekdaySet.size > 0 && !weekdaySet.has(day.date.getDay())) return []
        // dayKey is YYYY-MM-DD like the date inputs, so they compare as strings
        if ((from && day.key < from) || (to && day.key > to)) return []
        const sessions = terms.length > 0 ? day.sessions.filter((s) => sessionMatches(s, terms)) : day.sessions
        return sessions.length > 0 ? [{ ...day, sessions }] : []
    })
}

// In the current language's way, e.g. "1,234.5" or "1.234,5"
export function formatNumber(n: number, maximumFractionDigits = 1) {
    return n.toLocaleString(locale(), { maximumFractionDigits })
}

export function formatSet(w: Pick<WorkoutRow, 'reps' | 'kg'>) {
    const kg = t().units.kg
    if (w.reps !== null && w.kg !== null) return `${w.reps} × ${formatNumber(w.kg, 2)} ${kg}`
    if (w.reps !== null) return t().training.reps(w.reps)
    if (w.kg !== null) return `${formatNumber(w.kg, 2)} ${kg}`
    return '–'
}
