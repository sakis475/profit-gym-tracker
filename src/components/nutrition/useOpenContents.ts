import { useState } from 'react'

// Which foods made of foods have the list of what is in them open, by a key per food. All start closed.
export function useOpenContents() {
    const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set())
    return {
        isOpen: (key: string) => open.has(key),
        toggle: (key: string) => setOpen((prev) => {
            const next = new Set(prev)
            if (!next.delete(key)) next.add(key)
            return next
        }),
        // After putting a food in, so it shows
        show: (key: string) => setOpen((prev) => (prev.has(key) ? prev : new Set(prev).add(key))),
    }
}
