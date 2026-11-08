import { useSearchParams } from 'react-router-dom'

// The open tab of a page, kept in the address as ?tab=..., so a reload, a link or the back
// button lands on the same tab. The first tab is the default and leaves the address bare.
export function useTabParam<T extends string>(tabs: readonly T[]): [T, (tab: T) => void] {
    const [params, setParams] = useSearchParams()
    const value = params.get('tab')
    const tab = tabs.find((t) => t === value) ?? tabs[0]

    function setTab(next: T) {
        setParams(next === tabs[0] ? {} : { tab: next })
    }

    return [tab, setTab]
}
