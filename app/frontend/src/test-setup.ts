import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup)

// jsdom has no IntersectionObserver (React Aria Sheet uses it)
globalThis.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } } as never
// ...nor ResizeObserver (HeroUI Tabs: ScrollShadow in Tabs.ListContainer). Element.getAnimations stays per test file: stubbing it here turns off React Aria's modal hiding behind Sheet.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver
Element.prototype.scrollTo ??= () => {} // jsdom has no element scrolling; HeroUI Sheet scrolls its body to top on open
window.matchMedia ??= (query: string) => ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }) as MediaQueryList
