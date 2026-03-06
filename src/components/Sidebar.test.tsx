import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Sidebar from './Sidebar'

describe('Sidebar', () => {
  it('renders view buttons with letters J, Y, Md, M', () => {
    const onViewChange = vi.fn()
    render(<Sidebar currentView="json-diff" onViewChange={onViewChange} />)
    expect(screen.getByTitle('JSON Diff')).toHaveTextContent('J')
    expect(screen.getByTitle('YAML Diff')).toHaveTextContent('Y')
    expect(screen.getByTitle('Markdown Viewer')).toHaveTextContent('Md')
    expect(screen.getByTitle('Mermaid')).toHaveTextContent('M')
  })

  it('calls onViewChange when a view button is clicked', () => {
    const onViewChange = vi.fn()
    render(<Sidebar currentView="json-diff" onViewChange={onViewChange} />)
    fireEvent.click(screen.getByTitle('Mermaid'))
    expect(onViewChange).toHaveBeenCalledWith('mermaid')
  })
})
