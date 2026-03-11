import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import EpochConverter, { detectUnit, toMillis } from './EpochConverter'

describe('detectUnit', () => {
  it('returns seconds for ≤10 digits', () => {
    expect(detectUnit('1700000000')).toBe('seconds')
  })

  it('returns milliseconds for ≤13 digits', () => {
    expect(detectUnit('1700000000000')).toBe('milliseconds')
  })

  it('returns microseconds for ≤16 digits', () => {
    expect(detectUnit('1700000000000000')).toBe('microseconds')
  })

  it('returns nanoseconds for >16 digits', () => {
    expect(detectUnit('1700000000000000000')).toBe('nanoseconds')
  })

  it('handles negative values by ignoring sign', () => {
    expect(detectUnit('-1700000000')).toBe('seconds')
  })
})

describe('toMillis', () => {
  it('converts seconds to ms', () => {
    expect(toMillis('1700000000', 'seconds')).toBe(1700000000000)
  })

  it('returns milliseconds as-is', () => {
    expect(toMillis('1700000000000', 'milliseconds')).toBe(1700000000000)
  })

  it('converts microseconds to ms', () => {
    expect(toMillis('1700000000000000', 'microseconds')).toBe(1700000000000)
  })

  it('converts nanoseconds to ms', () => {
    expect(toMillis('1700000000000000000', 'nanoseconds')).toBe(1700000000000)
  })

  it('handles negative timestamps', () => {
    expect(toMillis('-1700000000', 'seconds')).toBe(-1700000000000)
  })
})

describe('EpochConverter', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn(() => Promise.resolve()) },
    })
  })

  it('renders the title and both sections', () => {
    render(<EpochConverter />)
    expect(screen.getByText('Epoch Converter')).toBeInTheDocument()
    expect(screen.getByText('Timestamp → Date')).toBeInTheDocument()
    expect(screen.getByText('Date → Timestamp')).toBeInTheDocument()
  })

  describe('Timestamp → Date', () => {
    it('shows UTC/Local results and detected unit for seconds input', () => {
      render(<EpochConverter />)
      const input = screen.getByPlaceholderText(/e\.g\. 1700000000/)
      fireEvent.change(input, { target: { value: '1700000000' } })
      expect(screen.getByText('Detected: seconds')).toBeInTheDocument()
      const timestampSection = screen.getByRole('heading', { name: 'Timestamp → Date' }).closest('div')!
      expect(within(timestampSection).getByText('UTC')).toBeInTheDocument()
      expect(within(timestampSection).getByText('Local')).toBeInTheDocument()
    })

    it('shows detected milliseconds for 13-digit input', () => {
      render(<EpochConverter />)
      const input = screen.getByPlaceholderText(/e\.g\. 1700000000/)
      fireEvent.change(input, { target: { value: '1700000000000' } })
      expect(screen.getByText('Detected: milliseconds')).toBeInTheDocument()
    })

    it('shows error for non-integer input', () => {
      render(<EpochConverter />)
      const input = screen.getByPlaceholderText(/e\.g\. 1700000000/)
      fireEvent.change(input, { target: { value: 'abc' } })
      expect(screen.getByText('Enter a valid integer timestamp')).toBeInTheDocument()
    })

    it('shows nothing for empty input', () => {
      render(<EpochConverter />)
      const input = screen.getByPlaceholderText(/e\.g\. 1700000000/)
      fireEvent.change(input, { target: { value: '1700000000' } })
      expect(screen.getByText('Detected: seconds')).toBeInTheDocument()
      fireEvent.change(input, { target: { value: '' } })
      expect(screen.queryByText(/Detected:/)).not.toBeInTheDocument()
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument()
    })
  })

  describe('Date → Timestamp', () => {
    it('renders all four unit results', () => {
      render(<EpochConverter />)
      expect(screen.getByText('Seconds')).toBeInTheDocument()
      expect(screen.getByText('Milliseconds')).toBeInTheDocument()
      expect(screen.getByText('Microseconds')).toBeInTheDocument()
      expect(screen.getByText('Nanoseconds')).toBeInTheDocument()
    })

    it('toggles AM/PM', () => {
      render(<EpochConverter />)
      const ampmSelect = screen.getByDisplayValue('AM')
      fireEvent.change(ampmSelect, { target: { value: 'PM' } })
      expect(screen.getByDisplayValue('PM')).toBeInTheDocument()
    })

    it('toggles UTC/Local', () => {
      render(<EpochConverter />)
      const tzSelect = screen.getByDisplayValue('Local')
      fireEvent.change(tzSelect, { target: { value: 'UTC' } })
      expect(screen.getByDisplayValue('UTC')).toBeInTheDocument()
    })
  })

  describe('CopyButton', () => {
    it('calls clipboard.writeText and shows Copied!', async () => {
      render(<EpochConverter />)
      const input = screen.getByPlaceholderText(/e\.g\. 1700000000/)
      fireEvent.change(input, { target: { value: '1700000000' } })

      const copyButtons = screen.getAllByText('Copy')
      fireEvent.click(copyButtons[0])

      expect(navigator.clipboard.writeText).toHaveBeenCalled()
      // Wait for state update
      await screen.findByText('Copied!')
    })
  })
})
