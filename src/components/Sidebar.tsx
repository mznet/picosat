type ViewType = 'json-diff' | 'yaml-diff' | 'markdown' | 'mermaid'

interface SidebarProps {
  currentView: ViewType
  onViewChange: (view: ViewType) => void
  showShortcutHints?: boolean
}

const views: { id: ViewType; label: string; letter: string; shortcutHint: string }[] = [
  { id: 'json-diff', label: 'JSON Diff', letter: 'J', shortcutHint: 'J' },
  { id: 'yaml-diff', label: 'YAML Diff', letter: 'Y', shortcutHint: 'Y' },
  { id: 'markdown', label: 'Markdown Viewer', letter: 'Md', shortcutHint: '⇧M' },
  { id: 'mermaid', label: 'Mermaid', letter: 'M', shortcutHint: 'M' },
]

export default function Sidebar({ currentView, onViewChange, showShortcutHints = false }: SidebarProps) {
  return (
    <aside className="w-16 flex-shrink-0 flex flex-col items-center py-3 gap-1 bg-gray-950">
      {views.map(({ id, label, letter, shortcutHint }) => (
        <div key={id} className="relative">
          <button
            onClick={() => onViewChange(id)}
            title={label}
            className={`w-12 h-12 rounded-lg flex items-center justify-center text-lg font-semibold transition-colors ${
              currentView === id
                ? 'bg-violet-600/90 text-white shadow-lg shadow-violet-900/30'
                : 'text-gray-400 hover:bg-gray-700/60 hover:text-gray-200'
            }`}
          >
            {letter}
          </button>
          {showShortcutHints && (
            <span
              className="absolute -bottom-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-medium rounded bg-gray-800 text-gray-300 border border-gray-600 shadow"
              aria-hidden
            >
              {shortcutHint}
            </span>
          )}
        </div>
      ))}
    </aside>
  )
}

export type { ViewType }
