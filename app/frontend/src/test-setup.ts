import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup)

// jsdom has no IntersectionObserver (React Aria Sheet uses it)
globalThis.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } } as never
// ...nor ResizeObserver (HeroUI Tabs: ScrollShadow in Tabs.ListContainer) or Element.getAnimations (React Aria waits on exit animations).
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver
Element.prototype.getAnimations ??= () => []
