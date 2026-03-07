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

const MIN_SCALE = 0.25
const MAX_SCALE = 3
const ZOOM_FACTOR = 1.2

export default function MermaidViewer() {
  const [code, setCode] = useState(DEFAULT_CODE)
  const [fileName, setFileName] = useState<string | null>(null)
  const [previewOnly, setPreviewOnly] = useState(false)
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [contentSize, setContentSize] = useState<{ w: number; h: number } | null>(null)
  const [scrollInfo, setScrollInfo] = useState({ scrollLeft: 0, scrollTop: 0, scrollWidth: 0, scrollHeight: 0, clientWidth: 1, clientHeight: 1 })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const renderIdRef = useRef(0)
  const previewScrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const scrollAdjustRef = useRef<{ contentX: number; contentY: number; cursorX: number; cursorY: number; ratio: number } | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; startScrollLeft: number; startScrollTop: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const MINIMAP_WIDTH = 120
  const MINIMAP_HEIGHT = 90

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

  useEffect(() => {
    if (!svg) {
      setContentSize(null)
      return
    }
    const measure = () => {
      if (!contentRef.current) return
      const el = contentRef.current.firstElementChild as SVGSVGElement | null
      if (el) {
        const bbox = el.getBBox?.()
        const w = bbox ? bbox.width + (bbox.x || 0) : el.clientWidth || el.getBoundingClientRect().width
        const h = bbox ? bbox.height + (bbox.y || 0) : el.clientHeight || el.getBoundingClientRect().height
        setContentSize({ w: Math.max(w, 1), h: Math.max(h, 1) })
      } else {
        const rect = contentRef.current.getBoundingClientRect()
        setContentSize({ w: rect.width, h: rect.height })
      }
    }
    const t = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(t)
  }, [svg])

  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(MAX_SCALE, s * ZOOM_FACTOR))
  }, [])
  const zoomOut = useCallback(() => {
    setScale((s) => Math.max(MIN_SCALE, s / ZOOM_FACTOR))
  }, [])

  const handlePreviewWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const container = previewScrollRef.current
      const rect = container?.getBoundingClientRect()
      if (!container || !rect) return
      const cursorX = e.clientX - rect.left
      const cursorY = e.clientY - rect.top
      const contentX = container.scrollLeft + cursorX
      const contentY = container.scrollTop + cursorY
      setScale((s) => {
        const delta = -e.deltaY * 0.005
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s * (1 + delta)))
        const ratio = next / s
        scrollAdjustRef.current = { contentX, contentY, cursorX, cursorY, ratio }
        return next
      })
    },
    []
  )

  const handlePreviewMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const container = previewScrollRef.current
    if (!container) return
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startScrollLeft: container.scrollLeft,
      startScrollTop: container.scrollTop,
    }
    setIsDragging(true)
  }, [])

  useEffect(() => {
    if (!isDragging) return
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current
      const container = previewScrollRef.current
      if (!d || !container) return
      container.scrollLeft = d.startScrollLeft + (d.startX - e.clientX)
      container.scrollTop = d.startScrollTop + (d.startY - e.clientY)
    }
    const onUp = () => {
      dragRef.current = null
      setIsDragging(false)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isDragging])

  useEffect(() => {
    const container = previewScrollRef.current
    if (!container) return
    if (scrollAdjustRef.current !== null) {
      const { contentX, contentY, cursorX, cursorY, ratio } = scrollAdjustRef.current
      scrollAdjustRef.current = null
      requestAnimationFrame(() => {
        container.scrollLeft = contentX * ratio - cursorX
        container.scrollTop = contentY * ratio - cursorY
        clampScroll(container)
      })
    } else {
      requestAnimationFrame(() => clampScroll(container))
    }
  }, [scale])

  function clampScroll(container: HTMLDivElement) {
    const maxLeft = Math.max(0, container.scrollWidth - container.clientWidth)
    const maxTop = Math.max(0, container.scrollHeight - container.clientHeight)
    container.scrollLeft = Math.max(0, Math.min(container.scrollLeft, maxLeft))
    container.scrollTop = Math.max(0, Math.min(container.scrollTop, maxTop))
  }

  useEffect(() => {
    const container = previewScrollRef.current
    if (!container) return
    const update = () => {
      setScrollInfo({
        scrollLeft: container.scrollLeft,
        scrollTop: container.scrollTop,
        scrollWidth: container.scrollWidth,
        scrollHeight: container.scrollHeight,
        clientWidth: container.clientWidth,
        clientHeight: container.clientHeight,
      })
    }
    container.addEventListener('scroll', update)
    const ro = new ResizeObserver(update)
    ro.observe(container)
    update()
    return () => {
      container.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [svg, contentSize, scale])

  const handleMinimapClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const container = previewScrollRef.current
      if (!container || !contentSize) return
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const minimapScale = Math.min(MINIMAP_WIDTH / (contentSize.w * scale), MINIMAP_HEIGHT / (contentSize.h * scale))
      const contentX = x / minimapScale
      const contentY = y / minimapScale
      container.scrollLeft = Math.max(0, contentX - container.clientWidth / 2)
      container.scrollTop = Math.max(0, contentY - container.clientHeight / 2)
    },
    [contentSize, scale]
  )

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
      <div className="flex-1 flex gap-0 min-h-0 items-stretch border border-gray-800 rounded-lg overflow-hidden bg-gray-950">
        {!previewOnly && (
          <>
            <div className="flex-1 flex flex-col min-w-0 min-h-0 self-stretch overflow-hidden">
              <div className="h-9 px-3 border-b border-gray-800 text-xs font-medium text-gray-500 bg-gray-900/50 flex-shrink-0 flex items-center">
                Editor
              </div>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="graph LR&#10;  A --> B"
                spellCheck={false}
                className="flex-1 min-h-0 w-full p-4 font-mono text-sm text-gray-100 bg-gray-950 placeholder-gray-600 focus:outline-none focus:ring-0 resize-none"
              />
            </div>
            <div className="w-px bg-gray-800 flex-shrink-0 self-stretch" />
          </>
        )}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 self-stretch overflow-hidden">
          <div className="h-9 px-3 border-b border-gray-800 text-xs font-medium text-gray-500 bg-gray-900/50 flex-shrink-0 flex items-center justify-between gap-2">
            <span>Preview</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400 min-w-[3ch] tabular-nums" aria-live="polite">
                {Math.round(scale * 100)}%
              </span>
              <button
                type="button"
                onClick={zoomOut}
                className="size-6 flex items-center justify-center text-xs font-medium rounded bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700 transition-colors"
                title="Zoom out"
              >
                −
              </button>
              <button
                type="button"
                onClick={zoomIn}
                className="size-6 flex items-center justify-center text-xs font-medium rounded bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700 transition-colors"
                title="Zoom in"
              >
                +
              </button>
            </div>
          </div>
          <div className="flex-1 flex min-h-0 relative">
            <div
              ref={previewScrollRef}
              onWheel={handlePreviewWheel}
              onMouseDown={handlePreviewMouseDown}
              className={`flex-1 min-h-0 p-4 overflow-auto overflow-x-scroll overflow-y-scroll select-none ${svg && !error ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
            >
              {error && (
                <p className="text-red-400 text-sm">{error}</p>
              )}
              {svg && !error && (
                <div
                  style={
                    contentSize
                      ? {
                          position: 'relative' as const,
                          display: 'inline-block',
                          width: contentSize.w * scale,
                          height: contentSize.h * scale,
                          minWidth: contentSize.w * scale,
                          minHeight: contentSize.h * scale,
                          margin: '0 auto',
                          boxSizing: 'border-box',
                          verticalAlign: 'top',
                        }
                      : undefined
                  }
                  className="block"
                >
                  <div
                    ref={contentRef}
                    className="mermaid-preview"
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      transform: `scale(${scale})`,
                      transformOrigin: '0 0',
                      width: contentSize?.w ?? 'auto',
                      height: contentSize?.h ?? 'auto',
                    }}
                    dangerouslySetInnerHTML={{ __html: svg }}
                  />
                </div>
              )}
              {!code.trim() && !error && (
                <p className="text-gray-500 italic">Preview will appear here.</p>
              )}
            </div>
            {svg && !error && contentSize && (() => {
              const minimapScale = Math.min(MINIMAP_WIDTH / (contentSize.w * scale), MINIMAP_HEIGHT / (contentSize.h * scale))
              return (
                <div
                  className="absolute right-2 bottom-2 z-10 flex flex-col items-center rounded border border-gray-700 bg-gray-900/90 shadow-lg py-1.5 px-1"
                  title="Minimap: click to jump"
                >
                  <div className="text-[10px] text-gray-500 mb-1">Minimap</div>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={handleMinimapClick}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleMinimapClick(e as unknown as React.MouseEvent<HTMLDivElement>)
                      }
                    }}
                    className="relative w-[120px] h-[90px] rounded border border-gray-700 overflow-hidden cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500"
                    style={{ minWidth: MINIMAP_WIDTH, minHeight: MINIMAP_HEIGHT }}
                  >
                    <div
                      className="absolute left-0 top-0"
                      style={{
                        width: contentSize.w * scale,
                        height: contentSize.h * scale,
                        transform: `scale(${minimapScale})`,
                        transformOrigin: '0 0',
                      }}
                    >
                      <div
                        className="mermaid-preview origin-top-left"
                        style={{
                          width: contentSize.w,
                          height: contentSize.h,
                          transform: `scale(${scale})`,
                          transformOrigin: '0 0',
                        }}
                        dangerouslySetInnerHTML={{ __html: svg }}
                      />
                    </div>
                    <div
                      className="absolute border-2 border-violet-400 bg-violet-400/20 pointer-events-none"
                      style={{
                        left: scrollInfo.scrollLeft * minimapScale,
                        top: scrollInfo.scrollTop * minimapScale,
                        width: Math.min(scrollInfo.clientWidth * minimapScale, MINIMAP_WIDTH),
                        height: Math.min(scrollInfo.clientHeight * minimapScale, MINIMAP_HEIGHT),
                      }}
                    />
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}
