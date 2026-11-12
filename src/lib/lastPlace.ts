// Where the user last was, kept in this browser so the app opens there again: the last page, and
// the last tab of each page. Storage can be missing or refuse (private windows, blocked site
// data), in which case nothing is remembered and the defaults apply.

const PAGE_KEY = 'lastPage'
const tabKey = (pathname: string) => `lastTab:${pathname}`

// The pages worth coming back to; the login page and the old redirects are not
const PAGES = ['/training', '/nutrition', '/profile']

function read(key: string) {
    try {
        return localStorage.getItem(key)
    } catch {
        return null
    }
}

function write(key: string, value: string) {
    try {
        localStorage.setItem(key, value)
    } catch {
        // Not remembered this time
    }
}

// The last page with its address, e.g. "/nutrition?tab=plan", or null
export function lastPage() {
    const page = read(PAGE_KEY)
    return page && PAGES.includes(page.split('?')[0]) ? page : null
}

export function rememberPage(pathname: string, search: string) {
    if (PAGES.includes(pathname)) write(PAGE_KEY, pathname + search)
}

export function lastTab(pathname: string) {
    return read(tabKey(pathname))
}

export function rememberTab(pathname: string, tab: string) {
    write(tabKey(pathname), tab)
}
