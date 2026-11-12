import { pointerWithin, rectIntersection, type CollisionDetection } from '@dnd-kit/core'
import type { DropTarget } from './FoodDnd'

// Foods take drops inside the meals' cards. The food under the pointer wins over the meal around
// it. A keyboard drag has no pointer, so it falls back to the default.
export const dropCollision: CollisionDetection = (args) => {
    const hits = pointerWithin(args)
    if (hits.length === 0) return rectIntersection(args)
    const into = hits.find((hit) => (hit.data?.droppableContainer.data.current as DropTarget | undefined)?.intoKey)
    return into ? [into] : hits
}
