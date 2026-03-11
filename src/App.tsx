import { useState, useCallback, useEffect } from 'react'
import Sidebar, { type ViewType } from './components/Sidebar'
import MarkdownViewer from './components/MarkdownViewer'
import MermaidViewer from './components/MermaidViewer'
import ObjectDiffView from './components/ObjectDiffView'
import EpochConverter from './components/EpochConverter'
import type { ParseFn, FormatFn } from './components/ObjectDiffView'
import yaml from 'js-yaml'

function isEditableElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  const role = target.getAttribute?.('role')
  const editable = target.getAttribute?.('contenteditable')
  return tag === 'input' || tag === 'textarea' || role === 'textbox' || editable === 'true' || editable === ''
}

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('json-diff')
  const [showShortcutHints, setShowShortcutHints] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Meta') {
        setShowShortcutHints(true)
        return
      }
      if (!e.metaKey) return
      if (isEditableElement(e.target)) return
      switch (e.key.toLowerCase()) {
        case 'j':
          e.preventDefault()
          setCurrentView('json-diff')
          break
        case 'y':
          e.preventDefault()
          setCurrentView('yaml-diff')
          break
        case 'm':
          e.preventDefault()
          setCurrentView(e.shiftKey ? 'markdown' : 'mermaid')
          break
        case 'e':
          e.preventDefault()
          setCurrentView('epoch')
          break
        default:
          break
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Meta') setShowShortcutHints(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  const validateJson: ParseFn = useCallback((json: string) => {
    if (!json.trim()) return { valid: true, error: null, parsed: null }
    try {
      const parsed = JSON.parse(json)
      return { valid: true, error: null, parsed }
    } catch (e) {
      try {
        const unescaped = json.replace(/\\"/g, '"')
        const parsed = JSON.parse(unescaped)
        return { valid: true, error: null, parsed }
      } catch {
        return {
          valid: false,
          error: e instanceof Error ? e.message : 'Invalid JSON',
          parsed: null
        }
      }
    }
  }, [])

  const formatJson: FormatFn = useCallback((json: string, setJson, setError) => {
    if (!json.trim()) return
    try {
      let parsed
      try {
        parsed = JSON.parse(json)
      } catch {
        const unescaped = json.replace(/\\"/g, '"')
        parsed = JSON.parse(unescaped)
      }
      setJson(JSON.stringify(parsed, null, 2))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON')
    }
  }, [])

  const validateYaml: ParseFn = useCallback((text: string) => {
    if (!text.trim()) return { valid: true, error: null, parsed: null }
    try {
      const parsed = yaml.load(text)
      return { valid: true, error: null, parsed: parsed ?? null }
    } catch (e) {
      return {
        valid: false,
        error: e instanceof Error ? e.message : 'Invalid YAML',
        parsed: null
      }
    }
  }, [])

  const formatYaml: FormatFn = useCallback((text: string, setText, setError) => {
    if (!text.trim()) return
    try {
      const parsed = yaml.load(text)
      setText(yaml.dump(parsed, { indent: 2 }))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid YAML')
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} showShortcutHints={showShortcutHints} />
      <main className="flex-1 flex flex-col min-w-0 overflow-auto">
        {currentView === 'json-diff' && (
          <ObjectDiffView
            title="JSON Diff"
            parseFn={validateJson}
            formatFn={formatJson}
            placeholder='{"key": "value"}'
            emptyMessage="Enter JSON in both panels to compare"
            errorMessage="Fix JSON errors to see diff"
          />
        )}
        {currentView === 'yaml-diff' && (
          <ObjectDiffView
            title="YAML Diff"
            parseFn={validateYaml}
            formatFn={formatYaml}
            placeholder="key: value"
            emptyMessage="Enter YAML in both panels to compare"
            errorMessage="Fix YAML errors to see diff"
          />
        )}
        {currentView === 'markdown' && (
          <div className="max-w-[1800px] mx-auto px-4 py-6 w-full flex-1 flex flex-col min-h-0">
            <MarkdownViewer />
          </div>
        )}
        {currentView === 'mermaid' && (
          <div className="max-w-[1800px] mx-auto px-4 py-6 w-full flex-1 flex flex-col min-h-0">
            <MermaidViewer />
          </div>
        )}
        {currentView === 'epoch' && (
          <EpochConverter />
        )}
      </main>
    </div>
  )
}

export default App
