import { useState, useCallback, useRef, useEffect } from 'react'
import mermaid from 'mermaid'

function isTauriEnv(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as unknown as { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown }
  return w.__TAURI_INTERNALS__ != null || w.__TAURI__ != null
}

const DEFAULT_CODE = `graph LR
  A[Start] --> B{Decision}
  B -->|Yes| C[OK]
  B -->|No| D[End]`

export default function MermaidViewer() {
  const [code, setCode] = useState(DEFAULT_CODE)
  const [fileName, setFileName] = useState<string | null>(null)
  const [previewOnly, setPreviewOnly] = useState(false)
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const renderIdRef = useRef(0)

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose',
    })
  }, [])

  useEffect(() => {
    if (!code.trim()) {
      setSvg(null)
      setError(null)
      return
    }
    const id = `mermaid-${++renderIdRef.current}`
    mermaid
      .render(id, code)
      .then(({ svg: result }) => {
        setSvg(result)
        setError(null)
      })
      .catch((e) => {
        setError(e.message ?? 'Invalid diagram')
        setSvg(null)
      })
  }, [code])

  const handleOpenFile = useCallback(async () => {
    if (isTauriEnv()) {
      try {
        const { open } = await import('@tauri-apps/plugin-dialog')
        const { invoke } = await import('@tauri-apps/api/core')
        const selected = await open({
          multiple: false,
          filters: [
            { name: 'Mermaid', extensions: ['mmd', 'md', 'mermaid'] },
            { name: 'All', extensions: ['*'] },
          ],
        })
        if (selected && typeof selected === 'string') {
          const content = (await invoke('read_file_content', { path: selected })) as string
          setCode(content)
          setFileName(selected.split(/[/\\]/).pop() ?? null)
        }
      } catch (e) {
        console.error('Failed to open file:', e)
      }
    } else {
      fileInputRef.current?.click()
    }
  }, [])

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setCode(String(reader.result ?? ''))
      setFileName(file.name)
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [])

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-200">Mermaid</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPreviewOnly((p) => !p)}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700 transition-colors"
            title={previewOnly ? 'Editor + Preview (반반)' : 'Preview만 전체'}
          >
            {previewOnly ? 'Split' : 'Preview only'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mmd,.mermaid,.md,text/plain"
            className="hidden"
            onChange={handleFileInputChange}
          />
          <button
            onClick={handleOpenFile}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Open File
          </button>
        </div>
      </div>
      {fileName && (
        <p className="text-xs text-gray-500 mb-2">File: {fileName}</p>
      )}
      <div className="flex-1 flex gap-4 min-h-0 border border-gray-800 rounded-lg overflow-hidden bg-gray-950">
        {!previewOnly && (
          <>
            <div className="flex-1 flex flex-col min-w-0">
              <div className="px-3 py-2 border-b border-gray-800 text-xs font-medium text-gray-500 bg-gray-900/50">
                Editor
              </div>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="graph LR&#10;  A --> B"
                spellCheck={false}
                className="flex-1 w-full p-4 font-mono text-sm text-gray-100 bg-gray-950 placeholder-gray-600 focus:outline-none focus:ring-0 resize-none"
              />
            </div>
            <div className="w-px bg-gray-800 flex-shrink-0" />
          </>
        )}
        <div className="flex-1 flex flex-col min-w-0 overflow-auto">
          <div className="px-3 py-2 border-b border-gray-800 text-xs font-medium text-gray-500 bg-gray-900/50 flex-shrink-0">
            Preview
          </div>
          <div className="flex-1 p-4 overflow-auto flex items-center justify-center min-h-[200px]">
            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}
            {svg && !error && (
              <div
                className="mermaid-preview"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            )}
            {!code.trim() && !error && (
              <p className="text-gray-500 italic">Preview will appear here.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
