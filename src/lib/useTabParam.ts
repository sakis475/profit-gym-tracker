import { useEffect } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { lastTab, rememberTab } from './lastPlace'

// The open tab of a page, kept in the address as ?tab=..., so a reload, a link or the back
// button lands on the same tab. Without one in the address, the page opens on the tab it was
// last left on, or else the first. Choosing the first tab leaves the address bare.
export function useTabParam<T extends string>(tabs: readonly T[]): [T, (tab: T) => void] {
    const [params, setParams] = useSearchParams()
    const { pathname } = useLocation()
    const value = params.get('tab') ?? lastTab(pathname)
    const tab = tabs.find((t) => t === value) ?? tabs[0]

    // Remembered whichever way it was reached: chosen here, or from a link
    useEffect(() => {
        rememberTab(pathname, tab)
    }, [pathname, tab])

    function setTab(next: T) {
        // First, so a bare address for the first tab does not fall back to the tab left before
        rememberTab(pathname, next)
        setParams(next === tabs[0] ? {} : { tab: next })
    }

    return [tab, setTab]
}
