import { useEffect, useState } from 'react'
import { Box, Tab, Tabs, Typography } from '@mui/material'
import { getBodyWeights, getFoods, getGoals, getMealPlan, getMeals } from '../services/nutrition'
import type { BodyWeightRow, FoodRow, MealPlanWithFood, MealRow, NutritionGoalsRow } from '../types/entityTypes'
import FoodDiary from '../components/nutrition/FoodDiary'
import MealPlan from '../components/nutrition/MealPlan'
import FoodsList from '../components/nutrition/FoodsList'
import NutritionProgress from '../components/nutrition/NutritionProgress'

type View = 'today' | 'plan' | 'foods' | 'progress'

type Data = {
    plan: MealPlanWithFood[]
    meals: MealRow[]
    foods: FoodRow[]
    goals: NutritionGoalsRow | null
    weights: BodyWeightRow[]
}

export default function Nutrition() {
    const [view, setView] = useState<View>('today')
    // undefined while loading the first time, null when it failed
    const [data, setData] = useState<Data | null | undefined>(undefined)
    // Bumped after a change, to load everything again. It is little data, so this keeps the tabs in step.
    const [version, setVersion] = useState(0)

    useEffect(() => {
        let cancelled = false

        Promise.all([getMealPlan(), getMeals(), getFoods(), getGoals(), getBodyWeights()]).then(
            ([plan, meals, foods, goals, weights]) => {
                if (cancelled) return
                // getGoals gives null both for no goals yet and for an error; either way there are no goals to show
                setData(plan && meals && foods && weights ? { plan, meals, foods, goals, weights } : null)
            }
        )

        return () => {
            cancelled = true
        }
    }, [version])

    const reload = () => setVersion((v) => v + 1)

    return (
        <>
            <Typography variant="h5">Nutrition</Typography>

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs value={view} onChange={(_, value: View) => setView(value)} variant="scrollable" allowScrollButtonsMobile>
                    <Tab value="today" label="Today" />
                    <Tab value="plan" label="Plan" />
                    <Tab value="foods" label="Foods" />
                    <Tab value="progress" label="Progress" />
                </Tabs>
            </Box>

            {data === undefined ? (
                <Typography>Loading...</Typography>
            ) : data === null ? (
                <Typography color="error">Failed to load your nutrition data.</Typography>
            ) : view === 'today' ? (
                <FoodDiary
                    plan={data.plan}
                    meals={data.meals}
                    foods={data.foods}
                    goals={data.goals}
                    weights={data.weights}
                    onWeightsChange={reload}
                />
            ) : view === 'plan' ? (
                <MealPlan plan={data.plan} meals={data.meals} foods={data.foods} goals={data.goals} onChange={reload} />
            ) : view === 'foods' ? (
                <FoodsList foods={data.foods} onChange={reload} />
            ) : (
                <NutritionProgress goals={data.goals} weights={data.weights} onGoalsChange={reload} onWeightsChange={reload} />
            )}
        </>
    )
}
