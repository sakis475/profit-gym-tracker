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
    contentsNutrients,
    describeNutrients,
    foodNutrients,
    formatNutrient,
    formatQuantity,
    quantityUnitLabel,
    unitPer,
    type FoodContent,
} from '../../lib/nutrition'

export type FoodEntry = { mealId: string; foodId: string; quantity: number }

type Props = {
    title: string
    submitLabel: string
    meals: MealRow[]
    foods: FoodRow[]
    // What goes in each food, by its id. A food with foods in it comes to what is in it, so it
    // has no quantity to pick.
    contents?: Map<string, FoodContent[]>
    initial: Partial<FoodEntry>
    // When editing a planned food, only the meal and the quantity can change
    lockFood?: boolean
    // When putting a food in another, whose meal is already set
    hideMeal?: boolean
    onClose: () => void
    // Returns an error message, or null when saved
    onSubmit: (entry: FoodEntry, food: FoodRow) => Promise<string | null>
}

// Picks a meal, a food and how much of it: for the meal plan and for the food log alike.
// Mounted only while open, so its fields start from `initial` every time.
export default function FoodEntryDialog({
    title,
    submitLabel,
    meals,
    foods,
    contents,
    initial,
    lockFood,
    hideMeal,
    onClose,
    onSubmit,
}: Props) {
    const [mealId, setMealId] = useState(initial.mealId ?? meals[0]?.id ?? '')
    const [food, setFood] = useState<FoodRow | null>(foods.find((f) => f.id === initial.foodId) ?? null)
    const [quantity, setQuantity] = useState(initial.quantity !== undefined ? String(initial.quantity) : '')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const insideOf = (f: FoodRow) => contents?.get(f.id) ?? []
    const inside = food ? insideOf(food) : []
    const madeOfFoods = inside.length > 0
    const amount = Number(quantity)
    const valid = !!food && (madeOfFoods || (quantity !== '' && amount > 0))
    const preview = madeOfFoods ? contentsNutrients(inside) : valid ? foodNutrients(food, amount) : null

    // "per 100 g · 155 kcal · P 13 g", or for a food made of foods "made of 3 foods · 420 kcal · P 35 g"
    function describeOption(f: FoodRow) {
        const list = insideOf(f)
        const values = list.length > 0 ? contentsNutrients(list) : f
        const per = list.length > 0 ? `made of ${list.length} ${list.length === 1 ? 'food' : 'foods'}` : `per ${unitPer(f.unit)}`
        return `${per} · ${formatNutrient(values.kcal, 'kcal')} kcal · P ${formatNutrient(values.protein, 'protein')} g`
    }

    function chooseFood(next: FoodRow | null) {
        setFood(next)
        // A sensible starting amount when none was typed yet
        if (next && quantity === '') setQuantity(next.unit === 'g' || next.unit === 'ml' ? '100' : '1')
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        if (!hideMeal && !mealId) return setError('Choose a meal')
        if (!food) return setError('Choose a food')
        if (!madeOfFoods && !(amount > 0)) return setError('Quantity must be more than 0')

        setSaving(true)
        // A food made of foods has no amount of its own; 1 is stored
        const message = await onSubmit({ mealId, foodId: food.id, quantity: madeOfFoods ? 1 : amount }, food)
        setSaving(false)
        if (message) setError(message)
    }

    return (
        <Dialog open onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>{title}</DialogTitle>
            <form onSubmit={handleSubmit}>
                <DialogContent>
                    {!hideMeal && (
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
                    )}
                    <Autocomplete
                        sx={hideMeal ? { mt: 1 } : undefined}
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
                                        {describeOption(f)}
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
                    {madeOfFoods ? (
                        <Typography variant="body2" sx={{ mt: 2 }}>
                            Made of {inside.map((c) => `${formatQuantity(c.quantity, c.food.unit)} ${c.food.name}`).join(', ')}
                        </Typography>
                    ) : (
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
                    )}
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
