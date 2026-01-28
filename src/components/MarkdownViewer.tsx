import { useState, useCallback, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function isTauriEnv(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as unknown as { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown }
  return w.__TAURI_INTERNALS__ != null || w.__TAURI__ != null
}

export default function MarkdownViewer() {
  const [markdown, setMarkdown] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [previewOnly, setPreviewOnly] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleOpenFile = useCallback(async () => {
    if (isTauriEnv()) {
      try {
        const { open } = await import('@tauri-apps/plugin-dialog')
        const { invoke } = await import('@tauri-apps/api/core')
        const selected = await open({
          multiple: false,
          filters: [
            { name: 'Markdown', extensions: ['md', 'markdown'] },
            { name: 'All', extensions: ['*'] },
          ],
        })
        if (selected && typeof selected === 'string') {
          const content = (await invoke('read_file_content', { path: selected })) as string
          setMarkdown(content)
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
      setMarkdown(String(reader.result ?? ''))
      setFileName(file.name)
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [])

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-200">Markdown Viewer</h2>
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
            accept=".md,.markdown,text/markdown,text/plain"
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
                value={markdown}
                onChange={(e) => setMarkdown(e.target.value)}
                placeholder="# Hello&#10;&#10;Write markdown here..."
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
          <div className="flex-1 p-4 overflow-auto prose prose-invert prose-sm max-w-none prose-headings:text-gray-200 prose-p:text-gray-300 prose-code:text-gray-200 prose-pre:bg-gray-800 prose-li:text-gray-300 prose-blockquote:text-gray-400 prose-table:text-gray-300 prose-th:border prose-th:border-gray-600 prose-th:bg-gray-800 prose-th:px-3 prose-th:py-2 prose-td:border prose-td:border-gray-600 prose-td:px-3 prose-td:py-2">
            {markdown.trim() ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ node, ...props }) => (
                    <a {...props} className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer" />
                  ),
                  code: ({ node, className, children, ...props }) =>
                    className ? (
                      <code className={className} {...props}>{children}</code>
                    ) : (
                      <code className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-200 text-sm" {...props}>{children}</code>
                    ),
                  pre: ({ node, ...props }) => (
                    <pre className="bg-gray-800 rounded-lg p-4 overflow-x-auto text-sm" {...props} />
                  ),
                  table: ({ node, ...props }) => (
                    <div className="overflow-x-auto my-3">
                      <table className="min-w-full border-collapse border border-gray-600" {...props} />
                    </div>
                  ),
                  th: ({ node, ...props }) => (
                    <th className="border border-gray-600 bg-gray-800 px-3 py-2 text-left text-gray-200 font-medium" {...props} />
                  ),
                  td: ({ node, ...props }) => (
                    <td className="border border-gray-600 px-3 py-2 text-gray-300" {...props} />
                  ),
                }}
              >
                {markdown}
              </ReactMarkdown>
            ) : (
              <p className="text-gray-500 italic">Preview will appear here.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
