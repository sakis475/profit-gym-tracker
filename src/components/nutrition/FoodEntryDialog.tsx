import { useState } from 'react'
import {
    Autocomplete,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    InputAdornment,
    MenuItem,
    TextField,
    Typography,
} from '@mui/material'
import type { FoodRow, MealRow } from '../../types/entityTypes'
import {
    describeNutrients,
    foodNutrients,
    formatNutrient,
    quantityUnitLabel,
    unitPer,
} from '../../lib/nutrition'

export type FoodEntry = { mealId: string; foodId: string; quantity: number }

type Props = {
    title: string
    submitLabel: string
    meals: MealRow[]
    foods: FoodRow[]
    initial: Partial<FoodEntry>
    // When editing a planned food, only the meal and the quantity can change
    lockFood?: boolean
    onClose: () => void
    // Returns an error message, or null when saved
    onSubmit: (entry: FoodEntry, food: FoodRow) => Promise<string | null>
}

// Picks a meal, a food and how much of it: for the meal plan and for the food log alike.
// Mounted only while open, so its fields start from `initial` every time.
export default function FoodEntryDialog({ title, submitLabel, meals, foods, initial, lockFood, onClose, onSubmit }: Props) {
    const [mealId, setMealId] = useState(initial.mealId ?? meals[0]?.id ?? '')
    const [food, setFood] = useState<FoodRow | null>(foods.find((f) => f.id === initial.foodId) ?? null)
    const [quantity, setQuantity] = useState(initial.quantity !== undefined ? String(initial.quantity) : '')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const amount = Number(quantity)
    const valid = !!food && quantity !== '' && amount > 0
    const preview = valid ? foodNutrients(food, amount) : null

    function chooseFood(next: FoodRow | null) {
        setFood(next)
        // A sensible starting amount when none was typed yet
        if (next && quantity === '') setQuantity(next.unit === 'g' || next.unit === 'ml' ? '100' : '1')
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        if (!mealId) return setError('Choose a meal')
        if (!food) return setError('Choose a food')
        if (!(amount > 0)) return setError('Quantity must be more than 0')

        setSaving(true)
        const message = await onSubmit({ mealId, foodId: food.id, quantity: amount }, food)
        setSaving(false)
        if (message) setError(message)
    }

    return (
        <Dialog open onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>{title}</DialogTitle>
            <form onSubmit={handleSubmit}>
                <DialogContent>
                    <TextField
                        select
                        label="Meal"
                        value={meals.some((m) => m.id === mealId) ? mealId : ''}
                        onChange={(e) => setMealId(e.target.value)}
                        fullWidth
                        required
                        helperText={meals.length === 0 ? 'Add a meal in the Plan tab first' : undefined}
                        sx={{ mt: 1, mb: 2 }}
                    >
                        {meals.map((m) => (
                            <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
                        ))}
                    </TextField>
                    <Autocomplete
                        options={foods}
                        value={food}
                        onChange={(_, value) => chooseFood(value)}
                        disabled={lockFood}
                        getOptionLabel={(f) => f.name}
                        isOptionEqualToValue={(a, b) => a.id === b.id}
                        renderOption={(props, f) => (
                            <li {...props} key={f.id}>
                                <Box>
                                    <Typography>{f.name}</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        per {unitPer(f.unit)} · {formatNutrient(f.kcal, 'kcal')} kcal · P {formatNutrient(f.protein, 'protein')} g
                                    </Typography>
                                </Box>
                            </li>
                        )}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Food"
                                required
                                helperText={foods.length === 0 ? 'Add foods in the Foods tab first' : undefined}
                            />
                        )}
                    />
                    <TextField
                        label="Quantity"
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        fullWidth
                        required
                        sx={{ mt: 2 }}
                        inputProps={{ min: 0, step: 'any', inputMode: 'decimal' }}
                        InputProps={{
                            endAdornment: food && <InputAdornment position="end">{quantityUnitLabel(food.unit)}</InputAdornment>,
                        }}
                    />
                    {preview && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                            {describeNutrients(preview)}
                        </Typography>
                    )}
                    {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button type="submit" variant="contained" disabled={saving || !valid}>
                        {saving ? 'Saving…' : submitLabel}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    )
}
