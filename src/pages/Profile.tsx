import { useEffect, useState } from 'react'
import {
    Box,
    Button,
    InputAdornment,
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
import { getProfile, saveProfile } from '../services/profile'
import { getBodyWeights, getGoals, saveBodyWeight, saveGoals } from '../services/nutrition'
import {
    ACTIVITY_LEVELS,
    GOALS,
    ageFrom,
    calculateTargets,
    type ActivityLevel,
    type Goal,
    type Sex,
} from '../lib/nutritionTargets'
import { NUTRIENTS, formatNutrientWithUnit } from '../lib/nutrition'
import { dayKey, formatNumber, startOfWeek } from '../lib/workoutStats'
import type { BodyWeightRow, NutritionGoalsRow } from '../types/entityTypes'
import { locale, useT } from '../i18n'

type Form = {
    birthDate: string
    sex: Sex | ''
    heightCm: string
    weightKg: string
    activityLevel: ActivityLevel | ''
    goal: Goal | ''
}

type Loaded = {
    form: Form
    goals: NutritionGoalsRow | null
    latestWeight: BodyWeightRow | null
}

async function load(): Promise<Loaded | null> {
    const [profile, goals, weights] = await Promise.all([getProfile(), getGoals(), getBodyWeights()])
    // getProfile and getGoals give null both for nothing saved yet and for an error
    if (!weights) return null
    const latestWeight = weights[weights.length - 1] ?? null
    return {
        goals,
        latestWeight,
        form: {
            birthDate: profile?.birthDate ?? '',
            sex: (profile?.sex as Sex | null) ?? '',
            heightCm: profile?.heightCm != null ? String(profile.heightCm) : '',
            weightKg: latestWeight ? String(latestWeight.kg) : '',
            activityLevel: (profile?.activityLevel as ActivityLevel | null) ?? '',
            goal: (profile?.goal as Goal | null) ?? '',
        },
    }
}

function formatDate(key: string) {
    const [y, m, d] = key.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function Profile() {
    const t = useT()
    const p = t.profile
    // undefined while loading, null when it failed
    const [data, setData] = useState<Loaded | null | undefined>(undefined)
    const [form, setForm] = useState<Form | null>(null)
    const [version, setVersion] = useState(0)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

    useEffect(() => {
        let cancelled = false
        load().then((loaded) => {
            if (cancelled) return
            setData(loaded)
            if (loaded) setForm(loaded.form)
        })
        return () => {
            cancelled = true
        }
    }, [version])

    if (data === undefined || (data && !form)) return <Typography>{t.common.loading}</Typography>
    if (data === null || !form) return <Typography color="error">{p.failedToLoad}</Typography>

    const age = form.birthDate ? ageFrom(form.birthDate) : null
    const height = Number(form.heightCm)
    const weight = Number(form.weightKg)
    const complete = age !== null && age > 0 && form.sex && height > 0 && weight > 0 && form.activityLevel && form.goal
    // Follows the form as it is typed, saved or not
    const targets = complete
        ? calculateTargets({
            age,
            sex: form.sex as Sex,
            heightCm: height,
            weightKg: weight,
            activity: form.activityLevel as ActivityLevel,
            goal: form.goal as Goal,
        })
        : null

    const weightChanged = weight > 0 && weight !== data.latestWeight?.kg
    const thisMonday = dayKey(startOfWeek(new Date()))

    function set<K extends keyof Form>(key: K, value: Form[K]) {
        setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
        setMessage(null)
    }

    // Saves the details and the weight. Returns an error message, or null when saved.
    async function saveDetails(): Promise<string | null> {
        if (!form) return p.nothingToSave
        if (form.heightCm && !(height > 0)) return p.heightPositive
        if (form.weightKg && !(weight > 0)) return p.weightPositive

        const saved = await saveProfile({
            birthDate: form.birthDate || null,
            sex: form.sex || null,
            heightCm: height > 0 ? height : null,
            activityLevel: form.activityLevel || null,
            goal: form.goal || null,
        })
        if (!saved) return p.failedToSaveProfile
        // The weight is kept as a weigh-in, so the weight progress has it too
        if (weightChanged && !(await saveBodyWeight(thisMonday, weight, null))) return p.failedToSaveWeight
        return null
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        setMessage(null)
        const error = await saveDetails()
        setSaving(false)
        if (error) return setMessage({ text: error, error: true })
        setMessage({ text: p.saved, error: false })
        setVersion((v) => v + 1)
    }

    // The targets come from the details, so the details are saved with them: goals are never
    // applied from details that were not kept
    async function applyTargets() {
        if (!targets) return
        setSaving(true)
        setMessage(null)
        const error = await saveDetails()
        if (error) {
            setSaving(false)
            return setMessage({ text: p.goalsNotChanged(error), error: true })
        }
        const res = await saveGoals({
            kcal: targets.kcal,
            protein: targets.protein,
            carbs: targets.carbs,
            fat: targets.fat,
            fiber: targets.fiber,
        })
        setSaving(false)
        if (!res) return setMessage({ text: p.savedGoalsFailed, error: true })
        setMessage({ text: p.savedWithGoals, error: false })
        setVersion((v) => v + 1)
    }

    const sameAsGoals = !!targets && NUTRIENTS.every(({ key }) => data.goals?.[key] === targets[key])

    return (
        <>
            <Typography variant="h5">{p.title}</Typography>

            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr)' },
                    gap: 3,
                    mt: 2,
                    alignItems: 'start',
                }}
            >
                <Paper variant="outlined" sx={{ p: 2 }} component="form" onSubmit={handleSave}>
                    <Typography variant="h6" sx={{ mb: 2 }}>{p.aboutYou}</Typography>

                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 2 }}>
                        <TextField
                            label={p.birthDate}
                            type="date"
                            value={form.birthDate}
                            onChange={(e) => set('birthDate', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            helperText={age !== null ? p.yearsOld(age) : ' '}
                        />
                        <Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{p.sex}</Typography>
                            <ToggleButtonGroup
                                exclusive
                                fullWidth
                                size="small"
                                color="primary"
                                value={form.sex}
                                onChange={(_, value: Sex | null) => value && set('sex', value)}
                                aria-label={p.sex}
                            >
                                <ToggleButton value="male">{p.male}</ToggleButton>
                                <ToggleButton value="female">{p.female}</ToggleButton>
                            </ToggleButtonGroup>
                        </Box>
                        <TextField
                            label={p.height}
                            type="number"
                            value={form.heightCm}
                            onChange={(e) => set('heightCm', e.target.value)}
                            inputProps={{ min: 0, step: 1, inputMode: 'decimal' }}
                            InputProps={{ endAdornment: <InputAdornment position="end">{t.units.cm}</InputAdornment> }}
                        />
                        <TextField
                            label={p.weight}
                            type="number"
                            value={form.weightKg}
                            onChange={(e) => set('weightKg', e.target.value)}
                            inputProps={{ min: 0, step: 0.1, inputMode: 'decimal' }}
                            InputProps={{ endAdornment: <InputAdornment position="end">{t.units.kg}</InputAdornment> }}
                            helperText={
                                weightChanged
                                    ? p.savedAsWeighIn
                                    : data.latestWeight
                                        ? p.weighInOf(formatDate(data.latestWeight.date))
                                        : ' '
                            }
                        />
                    </Box>

                    <TextField
                        select
                        label={p.activityLevel}
                        value={form.activityLevel}
                        onChange={(e) => set('activityLevel', e.target.value as ActivityLevel)}
                        fullWidth
                        sx={{ mt: 2 }}
                        SelectProps={{ renderValue: (v) => ACTIVITY_LEVELS.find((a) => a.value === v)?.label ?? '' }}
                    >
                        {ACTIVITY_LEVELS.map((a) => (
                            <MenuItem key={a.value} value={a.value}>
                                <Box>
                                    <Typography>{a.label}</Typography>
                                    <Typography variant="caption" color="text.secondary">{a.description}</Typography>
                                </Box>
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        select
                        label={p.goal}
                        value={form.goal}
                        onChange={(e) => set('goal', e.target.value as Goal)}
                        fullWidth
                        sx={{ mt: 2 }}
                        SelectProps={{ renderValue: (v) => GOALS.find((g) => g.value === v)?.label ?? '' }}
                    >
                        {GOALS.map((g) => (
                            <MenuItem key={g.value} value={g.value}>
                                <Box>
                                    <Typography>{g.label}</Typography>
                                    <Typography variant="caption" color="text.secondary">{g.description}</Typography>
                                </Box>
                            </MenuItem>
                        ))}
                    </TextField>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
                        <Typography
                            variant="body2"
                            color={message?.error ? 'error' : 'text.secondary'}
                            sx={{ flexGrow: 1 }}
                            role="status"
                        >
                            {message?.text}
                        </Typography>
                        <Button type="submit" variant="contained" disabled={saving}>
                            {saving ? t.common.saving : t.common.save}
                        </Button>
                    </Box>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="h6">{p.dailyTargets}</Typography>
                    {!targets ? (
                        <Typography color="text.secondary" sx={{ mt: 1 }}>
                            {p.fillIn}
                        </Typography>
                    ) : (
                        <>
                            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mt: 1 }}>
                                <Box>
                                    <Typography variant="body2" color="text.secondary">{p.atRest}</Typography>
                                    <Typography variant="h6">{formatNumber(targets.bmr, 0)} {t.units.kcal}</Typography>
                                </Box>
                                <Box>
                                    <Typography variant="body2" color="text.secondary">{p.maintenance}</Typography>
                                    <Typography variant="h6">{formatNumber(targets.maintenance, 0)} {t.units.kcal}</Typography>
                                </Box>
                                <Box>
                                    <Typography variant="body2" color="text.secondary">{p.forGoal}</Typography>
                                    <Typography variant="h6">{formatNumber(targets.kcal, 0)} {t.units.kcal}</Typography>
                                </Box>
                            </Box>
                            {targets.floored && (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                    {p.floored(formatNumber(targets.kcal, 0))}
                                </Typography>
                            )}

                            <Table size="small" sx={{ mt: 2 }}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell />
                                        <TableCell align="right">{p.suggested}</TableCell>
                                        <TableCell align="right">{p.goalNow}</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {NUTRIENTS.map(({ key, label }) => {
                                        const current = data.goals?.[key] ?? null
                                        return (
                                            <TableRow key={key}>
                                                <TableCell>{label}</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 500 }}>
                                                    {formatNutrientWithUnit(targets[key], key)}
                                                </TableCell>
                                                <TableCell align="right" sx={{ color: 'text.secondary' }}>
                                                    {current !== null ? formatNutrientWithUnit(current, key) : '–'}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>

                            <Box sx={{ textAlign: 'right', mt: 2 }}>
                                <Button variant="contained" onClick={applyTargets} disabled={saving || sameAsGoals}>
                                    {sameAsGoals ? p.theseAreGoals : p.useAsGoals}
                                </Button>
                            </Box>

                            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2 }}>
                                {p.explanation(formatNumber(GOALS.find((g) => g.value === form.goal)!.proteinPerKg, 1))}
                            </Typography>
                        </>
                    )}
                </Paper>
            </Box>
        </>
    )
}
