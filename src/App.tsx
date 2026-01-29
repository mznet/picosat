import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import Sidebar, { type ViewType } from './components/Sidebar'
import MarkdownViewer from './components/MarkdownViewer'
import MermaidViewer from './components/MermaidViewer'

type DiffType = 'added' | 'removed' | 'changed' | 'unchanged'

interface JsonNode {
  key: string
  path: string
  value: unknown
  type: 'object' | 'array' | 'primitive'
  depth: number
  children?: JsonNode[]
  isLast: boolean
}

interface DiffNode {
  path: string
  leftNode?: JsonNode
  rightNode?: JsonNode
  diffType: DiffType
  depth: number
  isCollapsible: boolean
  childDiffs?: DiffNode[]
}

interface FlatDiffRow {
  path: string
  diffType: DiffType
  rowType: 'node' | 'close'
}

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('json-diff')
  const [leftJson, setLeftJson] = useState('')
  const [rightJson, setRightJson] = useState('')
  const [leftError, setLeftError] = useState<string | null>(null)
  const [rightError, setRightError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [scrollInfo, setScrollInfo] = useState({ scrollTop: 0, scrollHeight: 1, clientHeight: 1 })
  const [leftLabel, setLeftLabel] = useState('Original')
  const [rightLabel, setRightLabel] = useState('Modified')
  const [showDiff, setShowDiff] = useState(false)

  const validateJson = useCallback((json: string): { valid: boolean; error: string | null; parsed: unknown } => {
    if (!json.trim()) {
      return { valid: true, error: null, parsed: null }
    }
    try {
      // First try to parse as-is
      const parsed = JSON.parse(json)
      return { valid: true, error: null, parsed }
    } catch (e) {
      // If parsing fails, try unescaping escaped quotes
      try {
        const unescaped = json.replace(/\\"/g, '"')
        const parsed = JSON.parse(unescaped)
        return { valid: true, error: null, parsed }
      } catch (e2) {
        if (e instanceof Error) {
          return { valid: false, error: e.message, parsed: null }
        }
        return { valid: false, error: 'Invalid JSON', parsed: null }
      }
    }
  }, [])

  const formatJson = useCallback((json: string, setJson: (j: string) => void, setError: (e: string | null) => void) => {
    if (!json.trim()) return
    try {
      // First try to parse as-is
      let parsed
      try {
        parsed = JSON.parse(json)
      } catch (e) {
        // If parsing fails, try unescaping escaped quotes
        const unescaped = json.replace(/\\"/g, '"')
        parsed = JSON.parse(unescaped)
      }
      setJson(JSON.stringify(parsed, null, 2))
      setError(null)
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message)
      }
    }
  }, [])

  const leftValidation = useMemo(() => {
    const result = validateJson(leftJson)
    setLeftError(result.error)
    return result
  }, [leftJson, validateJson])

  const rightValidation = useMemo(() => {
    const result = validateJson(rightJson)
    setRightError(result.error)
    return result
  }, [rightJson, validateJson])

  const buildJsonTree = useCallback((value: unknown, key: string, path: string, depth: number, isLast: boolean): JsonNode => {
    if (Array.isArray(value)) {
      return {
        key,
        path,
        value,
        type: 'array',
        depth,
        isLast,
        children: value.map((item, idx) =>
          buildJsonTree(item, String(idx), `${path}[${idx}]`, depth + 1, idx === value.length - 1)
        )
      }
    } else if (value !== null && typeof value === 'object') {
      const entries = Object.entries(value)
      return {
        key,
        path,
        value,
        type: 'object',
        depth,
        isLast,
        children: entries.map(([k, v], idx) =>
          buildJsonTree(v, k, path ? `${path}.${k}` : k, depth + 1, idx === entries.length - 1)
        )
      }
    }
    return {
      key,
      path,
      value,
      type: 'primitive',
      depth,
      isLast
    }
  }, [])

  const compareNodes = useCallback((left: JsonNode | undefined, right: JsonNode | undefined, path: string, depth: number): DiffNode => {
    if (!left && right) {
      return {
        path,
        rightNode: right,
        diffType: 'added',
        depth,
        isCollapsible: right.type !== 'primitive',
        childDiffs: right.children?.map((child) =>
          compareNodes(undefined, child, child.path, depth + 1)
        )
      }
    }
    if (left && !right) {
      return {
        path,
        leftNode: left,
        diffType: 'removed',
        depth,
        isCollapsible: left.type !== 'primitive',
        childDiffs: left.children?.map((child) =>
          compareNodes(child, undefined, child.path, depth + 1)
        )
      }
    }
    if (!left || !right) {
      return { path, diffType: 'unchanged', depth, isCollapsible: false }
    }

    if (left.type !== right.type) {
      return {
        path,
        leftNode: left,
        rightNode: right,
        diffType: 'changed',
        depth,
        isCollapsible: false
      }
    }

    if (left.type === 'primitive') {
      const isEqual = JSON.stringify(left.value) === JSON.stringify(right.value)
      return {
        path,
        leftNode: left,
        rightNode: right,
        diffType: isEqual ? 'unchanged' : 'changed',
        depth,
        isCollapsible: false
      }
    }

    const childDiffs: DiffNode[] = []
    const leftChildren = new Map(left.children?.map(c => [c.key, c]) || [])
    const rightChildren = new Map(right.children?.map(c => [c.key, c]) || [])
    const allKeys = new Set([...leftChildren.keys(), ...rightChildren.keys()])

    for (const key of allKeys) {
      const leftChild = leftChildren.get(key)
      const rightChild = rightChildren.get(key)
      const childPath = left.type === 'array' ? `${path}[${key}]` : (path ? `${path}.${key}` : key)
      childDiffs.push(compareNodes(leftChild, rightChild, childPath, depth + 1))
    }

    const hasChanges = childDiffs.some(d => d.diffType !== 'unchanged')

    return {
      path,
      leftNode: left,
      rightNode: right,
      diffType: hasChanges ? 'changed' : 'unchanged',
      depth,
      isCollapsible: true,
      childDiffs
    }
  }, [])

  const diffTree = useMemo(() => {
    if (!leftValidation.valid || !rightValidation.valid) return null
    if (!leftValidation.parsed && !rightValidation.parsed) return null

    const leftTree = leftValidation.parsed ? buildJsonTree(leftValidation.parsed, 'root', '', 0, true) : undefined
    const rightTree = rightValidation.parsed ? buildJsonTree(rightValidation.parsed, 'root', '', 0, true) : undefined

    return compareNodes(leftTree, rightTree, 'root', 0)
  }, [leftValidation, rightValidation, buildJsonTree, compareNodes])

  // Flatten diff tree for overview
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

  const toggleCollapse = (path: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const collapseAll = () => {
    if (!diffTree) return
    const paths = new Set<string>()
    const collect = (node: DiffNode) => {
      if (node.isCollapsible) paths.add(node.path)
      node.childDiffs?.forEach(collect)
    }
    collect(diffTree)
    setCollapsed(paths)
  }

  const expandAll = () => {
    setCollapsed(new Set())
  }

  const stats = useMemo(() => {
    if (!diffTree) return { added: 0, removed: 0, changed: 0 }
    let added = 0, removed = 0, changed = 0
    const count = (node: DiffNode) => {
      if (node.diffType === 'added' && !node.childDiffs) added++
      else if (node.diffType === 'removed' && !node.childDiffs) removed++
      else if (node.diffType === 'changed' && !node.isCollapsible) changed++
      node.childDiffs?.forEach(count)
    }
    count(diffTree)
    return { added, removed, changed }
  }, [diffTree])

  const getIndent = (depth: number) => {
    return { paddingLeft: `${depth * 20}px` }
  }

  const formatValue = (value: unknown): string => {
    if (value === null) return 'null'
    if (typeof value === 'string') return `"${value}"`
    if (typeof value === 'boolean' || typeof value === 'number') return String(value)
    return ''
  }

  const getRowBgClass = (diffType: DiffType, side: 'left' | 'right'): string => {
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

  // Handle scroll for overview
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

  const handleOverviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = scrollContainerRef.current
    if (!container) return

    const rect = e.currentTarget.getBoundingClientRect()
    const clickY = e.clientY - rect.top
    const ratio = clickY / rect.height
    const targetScroll = ratio * (container.scrollHeight - container.clientHeight)
    container.scrollTo({ top: targetScroll, behavior: 'smooth' })
  }

  const renderDiffNode = (node: DiffNode, index: number): JSX.Element[] => {
    const rows: JSX.Element[] = []
    const isCollapsed = collapsed.has(node.path)
    const leftNode = node.leftNode
    const rightNode = node.rightNode

    const renderSide = (n: JsonNode | undefined) => {
      if (!n) {
        return <span className="text-gray-600">-</span>
      }

      const content: JSX.Element[] = []

      // Key
      if (n.key !== 'root' && n.depth > 0) {
        const parentIsArray = n.path.match(/\[\d+\]$/)
        if (!parentIsArray) {
          content.push(
            <span key="key" className="text-purple-400">"{n.key}"</span>,
            <span key="colon" className="text-gray-400">: </span>
          )
        }
      }

      // Value
      if (n.type === 'object') {
        const childCount = n.children?.length || 0
        if (isCollapsed) {
          content.push(
            <span key="collapsed" className="text-gray-400">
              {`{...} `}
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
              {`[...] `}
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
        const valClass = typeof n.value === 'string' ? 'text-green-400' :
                        typeof n.value === 'number' ? 'text-blue-400' :
                        typeof n.value === 'boolean' ? 'text-yellow-400' :
                        'text-gray-400'
        content.push(<span key="val" className={valClass}>{val}</span>)
        if (!n.isLast) {
          content.push(<span key="comma" className="text-gray-400">,</span>)
        }
      }

      return <span>{content}</span>
    }

    // Main row
    rows.push(
      <tr key={`${node.path}-${index}`} className="border-b border-gray-800/50 hover:bg-gray-800/30" data-path={node.path}>
        {/* Left side */}
        <td className={`py-1 px-2 font-mono text-sm ${getRowBgClass(node.diffType, 'left')}`}>
          <div className="flex items-center" style={getIndent(node.depth)}>
            {node.isCollapsible && leftNode && (
              <button
                onClick={() => toggleCollapse(node.path)}
                className="w-4 h-4 mr-1 flex items-center justify-center text-gray-500 hover:text-gray-300 flex-shrink-0"
              >
                <svg className={`w-3 h-3 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            )}
            {!node.isCollapsible && <span className="w-4 mr-1" />}
            {renderSide(leftNode)}
          </div>
        </td>

        {/* Divider */}
        <td className="w-px bg-gray-700" />

        {/* Right side */}
        <td className={`py-1 px-2 font-mono text-sm ${getRowBgClass(node.diffType, 'right')}`}>
          <div className="flex items-center" style={getIndent(node.depth)}>
            {node.isCollapsible && rightNode && (
              <button
                onClick={() => toggleCollapse(node.path)}
                className="w-4 h-4 mr-1 flex items-center justify-center text-gray-500 hover:text-gray-300 flex-shrink-0"
              >
                <svg className={`w-3 h-3 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            )}
            {!node.isCollapsible && <span className="w-4 mr-1" />}
            {renderSide(rightNode)}
          </div>
        </td>
      </tr>
    )

    // Render children if not collapsed
    if (!isCollapsed && node.childDiffs) {
      node.childDiffs.forEach((child, idx) => {
        rows.push(...renderDiffNode(child, idx))
      })
    }

    // Closing bracket
    if (!isCollapsed && (leftNode?.type === 'object' || leftNode?.type === 'array' || rightNode?.type === 'object' || rightNode?.type === 'array')) {
      const closingChar = (leftNode?.type === 'array' || rightNode?.type === 'array') ? ']' : '}'
      const comma = (leftNode?.isLast === false || rightNode?.isLast === false) ? ',' : ''

      rows.push(
        <tr key={`${node.path}-close`} className="border-b border-gray-800/50">
          <td className={`py-1 px-2 font-mono text-sm ${getRowBgClass(node.diffType, 'left')}`}>
            <div style={getIndent(node.depth)}>
              <span className="w-4 mr-1 inline-block" />
              {leftNode && <span className="text-gray-400">{closingChar}{comma}</span>}
            </div>
          </td>
          <td className="w-px bg-gray-700" />
          <td className={`py-1 px-2 font-mono text-sm ${getRowBgClass(node.diffType, 'right')}`}>
            <div style={getIndent(node.depth)}>
              <span className="w-4 mr-1 inline-block" />
              {rightNode && <span className="text-gray-400">{closingChar}{comma}</span>}
            </div>
          </td>
        </tr>
      )
    }

    return rows
  }

  // Calculate overview indicator position
  const viewportRatio = scrollInfo.clientHeight / scrollInfo.scrollHeight
  const viewportTop = (scrollInfo.scrollTop / scrollInfo.scrollHeight) * 100

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      <main className="flex-1 flex flex-col min-w-0 overflow-auto">
        {currentView === 'json-diff' && (
          <div className="max-w-[1800px] mx-auto px-4 py-6 w-full">
            {/* Header */}
            <div className="mb-4">
              <h1 className="text-lg font-medium text-gray-200">JSON Diff</h1>
            </div>

        {/* Input Section */}
        <div className={`grid gap-4 mb-6 ${showDiff ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          {/* Left JSON Input */}
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
                  onClick={() => formatJson(leftJson, setLeftJson, setLeftError)}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700 transition-colors"
                >
                  Format
                </button>
              </div>
            </div>
            <textarea
              value={leftJson}
              onChange={(e) => setLeftJson(e.target.value)}
              placeholder='{"key": "value"}'
              spellCheck={false}
              className={`w-full h-[576px] p-3 font-mono text-sm rounded-lg border bg-gray-950 text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
                leftError ? 'border-red-500/50 focus:ring-red-500' : 'border-gray-800'
              }`}
            />
            {leftError && (
              <div className="flex items-center gap-2 p-2 text-xs bg-red-950/50 border border-red-900/50 rounded-md text-red-400">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>{leftError}</span>
              </div>
            )}
          </div>

          {/* Right JSON Input - only show when showDiff is true */}
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
                  onClick={() => formatJson(rightJson, setRightJson, setRightError)}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700 transition-colors"
                >
                  Format
                </button>
              </div>
              <textarea
                value={rightJson}
                onChange={(e) => setRightJson(e.target.value)}
                placeholder='{"key": "value"}'
                spellCheck={false}
                className={`w-full h-[576px] p-3 font-mono text-sm rounded-lg border bg-gray-950 text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
                  rightError ? 'border-red-500/50 focus:ring-red-500' : 'border-gray-800'
                }`}
              />
              {rightError && (
                <div className="flex items-center gap-2 p-2 text-xs bg-red-950/50 border border-red-900/50 rounded-md text-red-400">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>{rightError}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Diff View - only show when showDiff is true */}
        {showDiff && (
          <div className="rounded-lg border border-gray-800 overflow-hidden bg-gray-950">
            {/* Diff Header */}
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

          {/* Diff Content with Overview */}
          <div className="flex">
            {/* Main scroll area */}
            <div ref={scrollContainerRef} className="flex-1 overflow-auto max-h-[600px]">
              {!leftJson.trim() && !rightJson.trim() ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                  <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-xs">Enter JSON in both panels to compare</p>
                </div>
              ) : leftError || rightError ? (
                <div className="flex flex-col items-center justify-center py-16 text-yellow-500">
                  <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-xs">Fix JSON errors to see diff</p>
                </div>
              ) : !diffTree ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                  <p className="text-xs">No content to compare</p>
                </div>
              ) : stats.added === 0 && stats.removed === 0 && stats.changed === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-green-500">
                  <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
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
                  <tbody>
                    {renderDiffNode(diffTree, 0)}
                  </tbody>
                </table>
              )}
            </div>

            {/* Diff Overview */}
            {diffTree && flatDiffRows.length > 0 && (stats.added > 0 || stats.removed > 0 || stats.changed > 0) && (
              <div
                className="w-3 bg-gray-800 border-l border-gray-700 cursor-pointer relative flex-shrink-0"
                onClick={handleOverviewClick}
                title="Click to navigate"
              >
                {/* Diff markers */}
                {flatDiffRows.map((row, idx) => {
                  if (row.diffType === 'unchanged') return null
                  const top = (idx / flatDiffRows.length) * 100
                  const color = row.diffType === 'added' ? 'bg-green-500' :
                               row.diffType === 'removed' ? 'bg-red-500' :
                               'bg-yellow-500'
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

                {/* Viewport indicator */}
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
      </main>
    </div>
  )
}

export default App
