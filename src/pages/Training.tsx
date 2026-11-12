import { Box, Tab, Tabs, Typography } from '@mui/material'
import { useTabParam } from '../lib/useTabParam'
import { useT } from '../i18n'
import Workout from '../components/training/Workout'
import Schedule from '../components/training/Schedule'
import ExercisesList from '../components/training/ExercisesList'
import TrainingHistory from '../components/training/TrainingHistory'

const TABS = ['today', 'plan', 'exercises', 'history', 'progress'] as const

export default function Training() {
    const [tab, setTab] = useTabParam(TABS)
    const m = useT()

    return (
        <>
            <Typography variant="h5">{m.training.title}</Typography>

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs value={tab} onChange={(_, value: (typeof TABS)[number]) => setTab(value)} variant="scrollable" allowScrollButtonsMobile>
                    <Tab value="today" label={m.training.tabs.today} />
                    <Tab value="plan" label={m.training.tabs.plan} />
                    <Tab value="exercises" label={m.training.tabs.exercises} />
                    <Tab value="history" label={m.training.tabs.history} />
                    <Tab value="progress" label={m.training.tabs.progress} />
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
