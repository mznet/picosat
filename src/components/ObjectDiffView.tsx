import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  type JsonNode,
  type DiffNode,
  type FlatDiffRow,
  type DiffType,
  buildJsonTree,
  compareNodes
} from '../utils/diffTree'

export type ParseResult = { valid: boolean; error: string | null; parsed: unknown }
export type ParseFn = (text: string) => ParseResult
export type FormatFn = (text: string, setText: (t: string) => void, setError: (e: string | null) => void) => void

interface ObjectDiffViewProps {
  title: string
  parseFn: ParseFn
  formatFn: FormatFn
  placeholder?: string
  emptyMessage?: string
  errorMessage?: string
}

function getIndent(depth: number) {
  return { paddingLeft: `${depth * 20}px` }
}

function formatValue(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return `"${value}"`
  if (typeof value === 'boolean' || typeof value === 'number') return String(value)
  return ''
}

function getRowBgClass(diffType: DiffType, side: 'left' | 'right'): string {
  switch (diffType) {
    case 'added':
      return side === 'right' ? 'bg-green-900/30' : 'bg-gray-800/30'
    case 'removed':
      return side === 'left' ? 'bg-red-900/30' : 'bg-gray-800/30'
    case 'changed':
      return side === 'left' ? 'bg-red-900/20' : 'bg-green-900/20'
    default:
      return ''
  }
}

export default function ObjectDiffView({
  title,
  parseFn,
  formatFn,
  placeholder = '{"key": "value"}',
  emptyMessage = 'Enter content in both panels to compare',
  errorMessage = 'Fix parse errors to see diff'
}: ObjectDiffViewProps) {
  const [leftText, setLeftText] = useState('')
  const [rightText, setRightText] = useState('')
  const [leftError, setLeftError] = useState<string | null>(null)
  const [rightError, setRightError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [scrollInfo, setScrollInfo] = useState({ scrollTop: 0, scrollHeight: 1, clientHeight: 1 })
  const [leftLabel, setLeftLabel] = useState('Original')
  const [rightLabel, setRightLabel] = useState('Modified')
  const [showDiff, setShowDiff] = useState(false)

  const leftValidation = useMemo(() => {
    const result = parseFn(leftText)
    setLeftError(result.error)
    return result
  }, [leftText, parseFn])

  const rightValidation = useMemo(() => {
    const result = parseFn(rightText)
    setRightError(result.error)
    return result
  }, [rightText, parseFn])

  const diffTree = useMemo(() => {
    if (!leftValidation.valid || !rightValidation.valid) return null
    if (!leftValidation.parsed && !rightValidation.parsed) return null

    const leftTree = leftValidation.parsed
      ? buildJsonTree(leftValidation.parsed, 'root', '', 0, true)
      : undefined
    const rightTree = rightValidation.parsed
      ? buildJsonTree(rightValidation.parsed, 'root', '', 0, true)
      : undefined

    return compareNodes(leftTree, rightTree, 'root', 0)
  }, [leftValidation, rightValidation])

  const flatDiffRows = useMemo(() => {
    if (!diffTree) return []
    const rows: FlatDiffRow[] = []

    const flatten = (node: DiffNode) => {
      const isCollapsedNode = collapsed.has(node.path)
      rows.push({ path: node.path, diffType: node.diffType, rowType: 'node' })

      if (!isCollapsedNode && node.childDiffs) {
        node.childDiffs.forEach(flatten)
      }

      if (!isCollapsedNode && node.isCollapsible) {
        rows.push({ path: node.path, diffType: node.diffType, rowType: 'close' })
      }
    }

    flatten(diffTree)
    return rows
  }, [diffTree, collapsed])

  const toggleCollapse = useCallback((path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const collapseAll = useCallback(() => {
    if (!diffTree) return
    const paths = new Set<string>()
    const collect = (node: DiffNode) => {
      if (node.isCollapsible) paths.add(node.path)
      node.childDiffs?.forEach(collect)
    }
    collect(diffTree)
    setCollapsed(paths)
  }, [diffTree])

  const expandAll = useCallback(() => setCollapsed(new Set()), [])

  const stats = useMemo(() => {
    if (!diffTree) return { added: 0, removed: 0, changed: 0 }
    let added = 0,
      removed = 0,
      changed = 0
    const count = (node: DiffNode) => {
      if (node.diffType === 'added' && !node.childDiffs) added++
      else if (node.diffType === 'removed' && !node.childDiffs) removed++
      else if (node.diffType === 'changed' && !node.isCollapsible) changed++
      node.childDiffs?.forEach(count)
    }
    count(diffTree)
    return { added, removed, changed }
  }, [diffTree])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return
    const handleScroll = () => {
      setScrollInfo({
        scrollTop: container.scrollTop,
        scrollHeight: container.scrollHeight,
        clientHeight: container.clientHeight
      })
    }
    container.addEventListener('scroll', handleScroll)
    handleScroll()
    return () => container.removeEventListener('scroll', handleScroll)
  }, [flatDiffRows])

  const handleOverviewClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = scrollContainerRef.current
    if (!container) return
    const rect = e.currentTarget.getBoundingClientRect()
    const clickY = e.clientY - rect.top
    const ratio = clickY / rect.height
    const targetScroll = ratio * (container.scrollHeight - container.clientHeight)
    container.scrollTo({ top: targetScroll, behavior: 'smooth' })
  }, [])

  const renderDiffNode = useCallback(
    (node: DiffNode, index: number): JSX.Element[] => {
      const rows: JSX.Element[] = []
      const isCollapsed = collapsed.has(node.path)
      const leftNode = node.leftNode
      const rightNode = node.rightNode

      const renderSide = (n: JsonNode | undefined) => {
        if (!n) return <span className="text-gray-600">-</span>

        const content: JSX.Element[] = []
        if (n.key !== 'root' && n.depth > 0) {
          const parentIsArray = n.path.match(/\[\d+\]$/)
          if (!parentIsArray) {
            content.push(
              <span key="key" className="text-purple-400">"{n.key}"</span>,
              <span key="colon" className="text-gray-400">: </span>
            )
          }
        }

        if (n.type === 'object') {
          const childCount = n.children?.length || 0
          if (isCollapsed) {
            content.push(
              <span key="collapsed" className="text-gray-400">
                {'{...} '}
                <span className="text-gray-500 text-xs">{childCount} fields</span>
              </span>
            )
          } else {
            content.push(<span key="open" className="text-gray-400">{'{'}</span>)
          }
        } else if (n.type === 'array') {
          const childCount = n.children?.length || 0
          if (isCollapsed) {
            content.push(
              <span key="collapsed" className="text-gray-400">
                {'[...] '}
                <span className="text-cyan-500 text-xs">{childCount} items</span>
              </span>
            )
          } else {
            content.push(
              <span key="open" className="text-gray-400">{'['}</span>,
              <span key="count" className="text-cyan-500 text-xs ml-1">{childCount} items</span>
            )
          }
        } else {
          const val = formatValue(n.value)
          const valClass =
            typeof n.value === 'string'
              ? 'text-green-400'
              : typeof n.value === 'number'
                ? 'text-blue-400'
                : typeof n.value === 'boolean'
                  ? 'text-yellow-400'
                  : 'text-gray-400'
          content.push(<span key="val" className={valClass}>{val}</span>)
          if (!n.isLast) content.push(<span key="comma" className="text-gray-400">,</span>)
        }
        return <span>{content}</span>
      }

      rows.push(
        <tr
          key={`${node.path}-${index}`}
          className="border-b border-gray-800/50 hover:bg-gray-800/30"
          data-path={node.path}
        >
          <td className={`py-1 px-2 font-mono text-sm ${getRowBgClass(node.diffType, 'left')}`}>
            <div className="flex items-center" style={getIndent(node.depth)}>
              {node.isCollapsible && leftNode && (
                <button
                  onClick={() => toggleCollapse(node.path)}
                  className="w-4 h-4 mr-1 flex items-center justify-center text-gray-500 hover:text-gray-300 flex-shrink-0"
                >
                  <svg
                    className={`w-3 h-3 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              )}
              {!node.isCollapsible && <span className="w-4 mr-1" />}
              {renderSide(leftNode)}
            </div>
          </td>
          <td className="w-px bg-gray-700" />
          <td className={`py-1 px-2 font-mono text-sm ${getRowBgClass(node.diffType, 'right')}`}>
            <div className="flex items-center" style={getIndent(node.depth)}>
              {node.isCollapsible && rightNode && (
                <button
                  onClick={() => toggleCollapse(node.path)}
                  className="w-4 h-4 mr-1 flex items-center justify-center text-gray-500 hover:text-gray-300 flex-shrink-0"
                >
                  <svg
                    className={`w-3 h-3 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              )}
              {!node.isCollapsible && <span className="w-4 mr-1" />}
              {renderSide(rightNode)}
            </div>
          </td>
        </tr>
      )

      if (!isCollapsed && node.childDiffs) {
        node.childDiffs.forEach((child, idx) => rows.push(...renderDiffNode(child, idx)))
      }

      if (
        !isCollapsed &&
        (leftNode?.type === 'object' ||
          leftNode?.type === 'array' ||
          rightNode?.type === 'object' ||
          rightNode?.type === 'array')
      ) {
        const closingChar =
          leftNode?.type === 'array' || rightNode?.type === 'array' ? ']' : '}'
        const comma =
          leftNode?.isLast === false || rightNode?.isLast === false ? ',' : ''
        rows.push(
          <tr key={`${node.path}-close`} className="border-b border-gray-800/50">
            <td className={`py-1 px-2 font-mono text-sm ${getRowBgClass(node.diffType, 'left')}`}>
              <div style={getIndent(node.depth)}>
                <span className="w-4 mr-1 inline-block" />
                {leftNode && (
                  <span className="text-gray-400">
                    {closingChar}
                    {comma}
                  </span>
                )}
              </div>
            </td>
            <td className="w-px bg-gray-700" />
            <td className={`py-1 px-2 font-mono text-sm ${getRowBgClass(node.diffType, 'right')}`}>
              <div style={getIndent(node.depth)}>
                <span className="w-4 mr-1 inline-block" />
                {rightNode && (
                  <span className="text-gray-400">
                    {closingChar}
                    {comma}
                  </span>
                )}
              </div>
            </td>
          </tr>
        )
      }
      return rows
    },
    [collapsed, toggleCollapse]
  )

  const viewportRatio = scrollInfo.clientHeight / scrollInfo.scrollHeight
  const viewportTop = (scrollInfo.scrollTop / scrollInfo.scrollHeight) * 100

  return (
    <div className="max-w-[1800px] mx-auto px-4 py-6 w-full">
      <div className="mb-4">
        <h1 className="text-lg font-medium text-gray-200">{title}</h1>
      </div>

      <div
        className={`grid gap-4 mb-6 ${showDiff ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <input
              type="text"
              value={leftLabel}
              onChange={(e) => setLeftLabel(e.target.value)}
              className="text-xs font-medium text-gray-300 bg-transparent border-b border-transparent hover:border-gray-600 focus:border-blue-500 focus:outline-none px-1 py-0.5 -ml-1 transition-colors"
              placeholder="Label"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDiff(!showDiff)}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                {showDiff ? 'Hide Diff' : 'Show Diff'}
              </button>
              <button
                onClick={() => formatFn(leftText, setLeftText, setLeftError)}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700 transition-colors"
              >
                Format
              </button>
            </div>
          </div>
          <textarea
            value={leftText}
            onChange={(e) => setLeftText(e.target.value)}
            placeholder={placeholder}
            spellCheck={false}
            className={`w-full h-[576px] p-3 font-mono text-sm rounded-lg border bg-gray-950 text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
              leftError ? 'border-red-500/50 focus:ring-red-500' : 'border-gray-800'
            }`}
          />
          {leftError && (
            <div className="flex items-center gap-2 p-2 text-xs bg-red-950/50 border border-red-900/50 rounded-md text-red-400">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{leftError}</span>
            </div>
          )}
        </div>

        {showDiff && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <input
                type="text"
                value={rightLabel}
                onChange={(e) => setRightLabel(e.target.value)}
                className="text-xs font-medium text-gray-300 bg-transparent border-b border-transparent hover:border-gray-600 focus:border-blue-500 focus:outline-none px-1 py-0.5 -ml-1 transition-colors"
                placeholder="Label"
              />
              <button
                onClick={() => formatFn(rightText, setRightText, setRightError)}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700 transition-colors"
              >
                Format
              </button>
            </div>
            <textarea
              value={rightText}
              onChange={(e) => setRightText(e.target.value)}
              placeholder={placeholder}
              spellCheck={false}
              className={`w-full h-[576px] p-3 font-mono text-sm rounded-lg border bg-gray-950 text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
                rightError ? 'border-red-500/50 focus:ring-red-500' : 'border-gray-800'
              }`}
            />
            {rightError && (
              <div className="flex items-center gap-2 p-2 text-xs bg-red-950/50 border border-red-900/50 rounded-md text-red-400">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{rightError}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {showDiff && (
        <div className="rounded-lg border border-gray-800 overflow-hidden bg-gray-950">
          <div className="flex items-center justify-between px-3 py-2 bg-gray-900/50 border-b border-gray-800">
            <div className="flex items-center gap-4">
              <span className="text-xs font-medium text-gray-500">Diff View</span>
              {diffTree && (
                <div className="flex items-center gap-3 text-xs">
                  {stats.added > 0 && <span className="text-green-400">+{stats.added}</span>}
                  {stats.removed > 0 && <span className="text-red-400">-{stats.removed}</span>}
                  {stats.changed > 0 && <span className="text-yellow-400">~{stats.changed}</span>}
                </div>
              )}
            </div>
            {diffTree && (
              <div className="flex items-center gap-2">
                <button
                  onClick={expandAll}
                  className="px-2 py-1.5 text-xs font-medium rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                >
                  Expand All
                </button>
                <button
                  onClick={collapseAll}
                  className="px-2 py-1.5 text-xs font-medium rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                >
                  Collapse All
                </button>
              </div>
            )}
          </div>

          <div className="flex">
            <div ref={scrollContainerRef} className="flex-1 overflow-auto max-h-[600px]">
              {!leftText.trim() && !rightText.trim() ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                  <svg
                    className="w-12 h-12 mb-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="text-xs">{emptyMessage}</p>
                </div>
              ) : leftError || rightError ? (
                <div className="flex flex-col items-center justify-center py-16 text-yellow-500">
                  <svg
                    className="w-12 h-12 mb-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <p className="text-xs">{errorMessage}</p>
                </div>
              ) : !diffTree ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                  <p className="text-xs">No content to compare</p>
                </div>
              ) : stats.added === 0 && stats.removed === 0 && stats.changed === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-green-500">
                  <svg
                    className="w-12 h-12 mb-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-xs">Files are identical</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-500 bg-gray-900/50">
                      <th className="py-2 px-3 text-left font-medium w-1/2">{leftLabel}</th>
                      <th className="w-px bg-gray-700" />
                      <th className="py-2 px-3 text-left font-medium w-1/2">{rightLabel}</th>
                    </tr>
                  </thead>
                  <tbody>{renderDiffNode(diffTree, 0)}</tbody>
                </table>
              )}
            </div>

            {diffTree &&
              flatDiffRows.length > 0 &&
              (stats.added > 0 || stats.removed > 0 || stats.changed > 0) && (
                <div
                  className="w-3 bg-gray-800 border-l border-gray-700 cursor-pointer relative flex-shrink-0"
                  onClick={handleOverviewClick}
                  title="Click to navigate"
                >
                  {flatDiffRows.map((row, idx) => {
                    if (row.diffType === 'unchanged') return null
                    const top = (idx / flatDiffRows.length) * 100
                    const color =
                      row.diffType === 'added'
                        ? 'bg-green-500'
                        : row.diffType === 'removed'
                          ? 'bg-red-500'
                          : 'bg-yellow-500'
                    return (
                      <div
                        key={`${row.path}-${idx}`}
                        className={`absolute left-0 right-0 ${color}`}
                        style={{
                          top: `${top}%`,
                          height: `${Math.max(100 / flatDiffRows.length, 2)}%`,
                          minHeight: '2px'
                        }}
                      />
                    )
                  })}
                  <div
                    className="absolute left-0 right-0 border border-gray-400/50 bg-gray-400/10 pointer-events-none"
                    style={{
                      top: `${viewportTop}%`,
                      height: `${Math.max(viewportRatio * 100, 5)}%`
                    }}
                  />
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  )
}
