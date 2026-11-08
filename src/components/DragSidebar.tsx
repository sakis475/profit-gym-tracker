import { useMemo, useState } from 'react'
import { Box, InputAdornment, Paper, TextField, Typography } from '@mui/material'
import { DragIndicator as DragIndicatorIcon, Search as SearchIcon } from '@mui/icons-material'
import { useDraggable } from '@dnd-kit/core'
import { normalizeSearch } from '../lib/workoutStats'

// A searchable list beside the page to drag things from (foods onto meals, exercises onto days).
// The page supplies the DndContext and decides what a drop does from the item's `data`.

// Below this width there is no room for the list beside the page; adding goes through dialogs there
const SIDEBAR_BREAKPOINT = 'md'
// Below the sticky app bar
const STICKY_TOP = 80

export type SidebarItem = {
    // Unique among everything draggable on the page, e.g. "food:<id>"
    dragId: string
    name: string
    detail?: string | null
    // Handed to the drop as active.data.current
    data: Record<string, unknown>
}

type Props = {
    title: string
    items: SidebarItem[]
    // Shown when there are no items at all
    emptyText: string
    children: React.ReactNode
}

// The list on the left of `children`, or nothing but `children` on a narrow screen
export function WithDragSidebar({ title, items, emptyText, children }: Props) {
    return (
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', [SIDEBAR_BREAKPOINT]: '280px minmax(0, 1fr)' },
                gap: 3,
                alignItems: 'start',
            }}
        >
            <DragSidebar title={title} items={items} emptyText={emptyText} />
            <Box sx={{ minWidth: 0 }}>{children}</Box>
        </Box>
    )
}

function DragSidebar({ title, items, emptyText }: Omit<Props, 'children'>) {
    const [search, setSearch] = useState('')
    const shown = useMemo(() => {
        const q = normalizeSearch(search.trim())
        return q ? items.filter((it) => normalizeSearch(`${it.name} ${it.detail ?? ''}`).includes(q)) : items
    }, [items, search])

    return (
        <Paper
            variant="outlined"
            sx={{
                display: { xs: 'none', [SIDEBAR_BREAKPOINT]: 'flex' },
                flexDirection: 'column',
                position: 'sticky',
                top: STICKY_TOP,
                maxHeight: `calc(100vh - ${STICKY_TOP + 16}px)`,
            }}
        >
            <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>{title}</Typography>
                <TextField
                    size="small"
                    fullWidth
                    placeholder="Search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon fontSize="small" />
                            </InputAdornment>
                        ),
                    }}
                />
            </Box>
            <Box sx={{ overflowY: 'auto', p: 1 }}>
                {shown.map((item) => <DraggableItem key={item.dragId} item={item} />)}
                {shown.length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                        {items.length === 0 ? emptyText : 'Nothing matches.'}
                    </Typography>
                )}
            </Box>
        </Paper>
    )
}

function DraggableItem({ item }: { item: SidebarItem }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.dragId, data: item.data })

    return (
        <Box
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Drag ${item.name}`}
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1,
                py: 0.75,
                borderRadius: 1,
                cursor: 'grab',
                touchAction: 'none',
                opacity: isDragging ? 0.4 : 1,
                '&:hover': { bgcolor: 'action.hover' },
            }}
        >
            <DragIndicatorIcon fontSize="small" color="action" />
            <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" noWrap>{item.name}</Typography>
                {item.detail && (
                    <Typography variant="caption" color="text.secondary" noWrap component="div">{item.detail}</Typography>
                )}
            </Box>
        </Box>
    )
}

// What follows the pointer while dragging
export function DragPreview({ name }: { name: string }) {
    return (
        <Paper elevation={6} sx={{ px: 1.5, py: 1, cursor: 'grabbing', display: 'inline-block' }}>
            <Typography sx={{ fontWeight: 500 }}>{name}</Typography>
        </Paper>
    )
}
