import { useEffect, useMemo, useState } from 'react'
import { Box, Tab, Tabs, Typography } from '@mui/material'
import { getBodyWeights, getFoodContents, getFoods, getGoals, getMealPlan, getMeals } from '../services/nutrition'
import { useTabParam } from '../lib/useTabParam'
import { contentsByFood, type FoodContent } from '../lib/nutrition'
import type {
    BodyWeightRow,
    FoodContentRow,
    FoodRow,
    MealPlanWithFood,
    MealRow,
    NutritionGoalsRow,
} from '../types/entityTypes'
import FoodDiary from '../components/nutrition/FoodDiary'
import MealPlan from '../components/nutrition/MealPlan'
import FoodsList from '../components/nutrition/FoodsList'
import NutritionProgress from '../components/nutrition/NutritionProgress'

const TABS = ['today', 'plan', 'foods', 'progress'] as const
type View = (typeof TABS)[number]

type Data = {
    plan: MealPlanWithFood[]
    meals: MealRow[]
    foods: FoodRow[]
    foodContents: FoodContentRow[]
    goals: NutritionGoalsRow | null
    weights: BodyWeightRow[]
}

const NO_CONTENTS = new Map<string, FoodContent[]>()

export default function Nutrition() {
    const [view, setView] = useTabParam(TABS)
    // undefined while loading the first time, null when it failed
    const [data, setData] = useState<Data | null | undefined>(undefined)
    // Bumped after a change, to load everything again. It is little data, so this keeps the tabs in step.
    const [version, setVersion] = useState(0)

    useEffect(() => {
        let cancelled = false

        Promise.all([getMealPlan(), getMeals(), getFoods(), getFoodContents(), getGoals(), getBodyWeights()]).then(
            ([plan, meals, foods, foodContents, goals, weights]) => {
                if (cancelled) return
                // getGoals gives null both for no goals yet and for an error; either way there are no goals to show
                setData(
                    plan && meals && foods && foodContents && weights
                        ? { plan, meals, foods, foodContents, goals, weights }
                        : null
                )
            }
        )

        return () => {
            cancelled = true
        }
    }, [version])

    const reload = () => setVersion((v) => v + 1)

    // What goes in each food, by its id
    const contents = useMemo(() => (data ? contentsByFood(data.foodContents, data.foods) : NO_CONTENTS), [data])

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
                    contents={contents}
                    goals={data.goals}
                    weights={data.weights}
                    onWeightsChange={reload}
                />
            ) : view === 'plan' ? (
                <MealPlan
                    plan={data.plan}
                    meals={data.meals}
                    foods={data.foods}
                    contents={contents}
                    goals={data.goals}
                    onChange={reload}
                />
            ) : view === 'foods' ? (
                <FoodsList foods={data.foods} contents={contents} onChange={reload} />
            ) : (
                <NutritionProgress goals={data.goals} weights={data.weights} onGoalsChange={reload} onWeightsChange={reload} />
            )}
        </>
    )
}
