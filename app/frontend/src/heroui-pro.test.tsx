import { render, screen } from '@testing-library/react'
import { test, expect } from 'vitest'
import { EmptyState } from '@heroui-pro/react/empty-state'
test('Pro component resolves React from this project', () => {
  render(<EmptyState><EmptyState.Header><EmptyState.Title>Kosong</EmptyState.Title></EmptyState.Header></EmptyState>)
  expect(screen.getByText('Kosong')).toBeInTheDocument()
})
