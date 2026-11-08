import type { Nutrients } from './nutrition'

// Daily targets from the profile, with the usual formulas. They are estimates to start
// from: the weekly weigh-ins tell whether they need adjusting.

export type Sex = 'male' | 'female'

export const ACTIVITY_LEVELS = [
    { value: 'sedentary', label: 'Sedentary', description: 'Desk job, little or no exercise', factor: 1.2 },
    { value: 'light', label: 'Lightly active', description: 'Exercise 1–3 days a week', factor: 1.375 },
    { value: 'moderate', label: 'Moderately active', description: 'Exercise 3–5 days a week', factor: 1.55 },
    { value: 'active', label: 'Very active', description: 'Hard exercise 6–7 days a week', factor: 1.725 },
    { value: 'very_active', label: 'Extremely active', description: 'Physical job and hard training', factor: 1.9 },
] as const

// `adjust` is the share of the maintenance calories added or taken away. Protein is higher
// while losing weight, to keep muscle in a calorie deficit.
export const GOALS = [
    { value: 'lose', label: 'Lose weight', description: 'About 0.5–0.75 kg a week', adjust: -0.2, proteinPerKg: 2.0 },
    { value: 'lose_slow', label: 'Lose slowly', description: 'About 0.25–0.5 kg a week', adjust: -0.1, proteinPerKg: 2.0 },
    { value: 'maintain', label: 'Maintain', description: 'Keep your weight', adjust: 0, proteinPerKg: 1.8 },
    { value: 'gain_slow', label: 'Build muscle', description: 'Lean gain, about 0.25 kg a week', adjust: 0.1, proteinPerKg: 1.8 },
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
