import type { Nutrients } from './nutrition'
import { t, type Messages } from '../i18n'

// Daily targets from the profile, with the usual formulas. They are estimates to start
// from: the weekly weigh-ins tell whether they need adjusting.

export type Sex = 'male' | 'female'

// The labels and descriptions are getters, so they are read in the current language
const activity = (value: keyof Messages['profile']['activity'], factor: number) => ({
    value,
    get label() { return t().profile.activity[value].label },
    get description() { return t().profile.activity[value].description },
    factor,
})

export const ACTIVITY_LEVELS = [
    activity('sedentary', 1.2),
    activity('light', 1.375),
    activity('moderate', 1.55),
    activity('active', 1.725),
    activity('very_active', 1.9),
] as const

// `adjust` is the share of the maintenance calories added or taken away. Protein is higher
// while losing weight, to keep muscle in a calorie deficit.
const goal = (value: keyof Messages['profile']['goals'], adjust: number, proteinPerKg: number) => ({
    value,
    get label() { return t().profile.goals[value].label },
    get description() { return t().profile.goals[value].description },
    adjust,
    proteinPerKg,
})

export const GOALS = [
    goal('lose', -0.2, 2.0),
    goal('lose_slow', -0.1, 2.0),
    goal('maintain', 0, 1.8),
    goal('gain_slow', 0.1, 1.8),
] as const

export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number]['value']
export type Goal = (typeof GOALS)[number]['value']

export type TargetsInput = {
    age: number
    sex: Sex
    heightCm: number
    weightKg: number
    activity: ActivityLevel
    goal: Goal
}

export type Targets = Nutrients & {
    // Calories at rest
    bmr: number
    // Calories that keep the weight as it is
    maintenance: number
    // The goal asked for fewer calories than is safe without supervision, so the floor was used
    floored: boolean
}

// Fat as a share of the calories
const FAT_SHARE = 0.25
const FIBER_PER_1000_KCAL = 14
// The lowest daily calories commonly advised without medical supervision
const MIN_KCAL: Record<Sex, number> = { male: 1500, female: 1200 }

// Whole years between the birth date (YYYY-MM-DD) and today
export function ageFrom(birthDate: string, today = new Date()) {
    const [y, m, d] = birthDate.split('-').map(Number)
    const hadBirthday = today.getMonth() + 1 > m || (today.getMonth() + 1 === m && today.getDate() >= d)
    return today.getFullYear() - y - (hadBirthday ? 0 : 1)
}

function round(n: number, to: number) {
    return Math.round(n / to) * to
}

export function calculateTargets({ age, sex, heightCm, weightKg, activity, goal }: TargetsInput): Targets {
    // Mifflin-St Jeor
    const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161)
    const maintenance = bmr * ACTIVITY_LEVELS.find((a) => a.value === activity)!.factor
    const goalInfo = GOALS.find((g) => g.value === goal)!

    const wanted = maintenance * (1 + goalInfo.adjust)
    const kcal = round(Math.max(wanted, MIN_KCAL[sex]), 10)

    const protein = Math.round(goalInfo.proteinPerKg * weightKg)
    const fat = Math.round((kcal * FAT_SHARE) / 9)
    // Whatever calories protein and fat leave go to carbs (4 kcal/g protein and carbs, 9 fat)
    const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4))
    const fiber = Math.round((kcal / 1000) * FIBER_PER_1000_KCAL)

    return {
        bmr: round(bmr, 10),
        maintenance: round(maintenance, 10),
        floored: wanted < MIN_KCAL[sex],
        kcal,
        protein,
        carbs,
        fat,
        fiber,
    }
}
