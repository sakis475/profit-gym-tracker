import { Box, Tab, Tabs, Typography } from '@mui/material'
import { useTabParam } from '../lib/useTabParam'
import Workout from '../components/training/Workout'
import Schedule from '../components/training/Schedule'
import ExercisesList from '../components/training/ExercisesList'
import TrainingHistory from '../components/training/TrainingHistory'

const TABS = ['today', 'plan', 'exercises', 'history', 'progress'] as const

export default function Training() {
    const [tab, setTab] = useTabParam(TABS)

    return (
        <>
            <Typography variant="h5">Training</Typography>

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs value={tab} onChange={(_, value: (typeof TABS)[number]) => setTab(value)} variant="scrollable" allowScrollButtonsMobile>
                    <Tab value="today" label="Today" />
                    <Tab value="plan" label="Plan" />
                    <Tab value="exercises" label="Exercises" />
                    <Tab value="history" label="History" />
                    <Tab value="progress" label="Progress" />
                </Tabs>
            </Box>

            {tab === 'today' ? (
                <Workout />
            ) : tab === 'plan' ? (
                <Schedule />
            ) : tab === 'exercises' ? (
                <ExercisesList />
            ) : (
                // One element for both tabs, so it stays mounted between them
                <TrainingHistory view={tab} onShowProgress={() => setTab('progress')} />
            )}
        </>
    )
}
