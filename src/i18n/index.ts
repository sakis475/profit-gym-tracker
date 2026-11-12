import { useSyncExternalStore } from 'react'
import { elGR, enUS, type Localization } from '@mui/material/locale'
import en from './locales/en'
import el from './locales/el'

// The app's languages. English (locales/en.ts) is the one every other is checked against: a
// language file has to give every text English has, or the app does not build.
//
// To add a language: copy locales/en.ts to locales/<code>.ts, translate it (texts with values in
// them are functions, so word order and plurals can follow the language), and add it below.

export type Messages = typeof en

type Language = {
    // ISO 639-1, also used for <html lang>
    code: string
    // In the language itself
    name: string
    // For dates and numbers
    locale: string
    // MUI's own texts, e.g. "No options"
    mui: Localization
    messages: Messages
}

export const LANGUAGES: readonly Language[] = [
    { code: 'en', name: 'English', locale: 'en-GB', mui: enUS, messages: en },
    { code: 'el', name: 'Ελληνικά', locale: 'el-GR', mui: elGR, messages: el },
]

const STORAGE_KEY = 'language'

// The one chosen before, or else the first of the browser's languages the app has, or English
function initialLanguage(): Language {
    let saved: string | null = null
    try {
        saved = localStorage.getItem(STORAGE_KEY)
    } catch {
        // Not remembered: the browser's languages decide
    }
    const wanted = saved ? [saved] : typeof navigator !== 'undefined' ? navigator.languages : []
    for (const tag of wanted) {
        const found = LANGUAGES.find((l) => l.code === tag.toLowerCase().split('-')[0])
        if (found) return found
    }
    return LANGUAGES[0]
}

let current = initialLanguage()
const listeners = new Set<() => void>()

function applyToDocument() {
    if (typeof document !== 'undefined') document.documentElement.lang = current.code
}
applyToDocument()

export function setLanguage(code: string) {
    const next = LANGUAGES.find((l) => l.code === code)
    if (!next || next === current) return
    current = next
    try {
        localStorage.setItem(STORAGE_KEY, code)
    } catch {
        // Not remembered for next time, but it still changes now
    }
    applyToDocument()
    listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

// The current language, re-rendering when it changes
export function useLanguage() {
    return useSyncExternalStore(subscribe, () => current)
}

// The texts of the current language, for components
export function useT(): Messages {
    return useLanguage().messages
}

// The texts of the current language, for code outside components (formatting helpers and such).
// They are read during a render, and a change of language re-renders the app, so they follow it.
// A value cached with useMemo that holds such a text needs the language among its dependencies.
export function t(): Messages {
    return current.messages
}

// The locale for dates and numbers, e.g. "el-GR"
export function locale() {
    return current.locale
}
