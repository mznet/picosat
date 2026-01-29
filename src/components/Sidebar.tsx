type ViewType = 'json-diff' | 'markdown' | 'mermaid'

interface SidebarProps {
  currentView: ViewType
  onViewChange: (view: ViewType) => void
}

const views: { id: ViewType; label: string; letter: string }[] = [
  { id: 'json-diff', label: 'JSON Diff', letter: 'J' },
  { id: 'markdown', label: 'Markdown Viewer', letter: 'Md' },
  { id: 'mermaid', label: 'Mermaid', letter: 'M' },
]

export default function Sidebar({ currentView, onViewChange }: SidebarProps) {
  return (
    <aside
      className="w-16 flex-shrink-0 border-r border-gray-800 flex flex-col items-center py-3 gap-1"
      style={{
        background: 'linear-gradient(180deg, #1f2937 0%, #111827 50%, #0f172a 100%)',
      }}
    >
      {views.map(({ id, label, letter }) => (
        <button
          key={id}
          onClick={() => onViewChange(id)}
          title={label}
          className={`w-12 h-12 rounded-lg flex items-center justify-center text-lg font-semibold transition-colors ${
            currentView === id
              ? 'bg-blue-600/90 text-white shadow-lg shadow-blue-900/30'
              : 'text-gray-400 hover:bg-gray-700/60 hover:text-gray-200'
          }`}
        >
          {letter}
        </button>
      ))}
    </aside>
  )
}

export type { ViewType }
