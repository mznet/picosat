export type DiffType = 'added' | 'removed' | 'changed' | 'unchanged'

export interface JsonNode {
  key: string
  path: string
  value: unknown
  type: 'object' | 'array' | 'primitive'
  depth: number
  children?: JsonNode[]
  isLast: boolean
}

export interface DiffNode {
  path: string
  leftNode?: JsonNode
  rightNode?: JsonNode
  diffType: DiffType
  depth: number
  isCollapsible: boolean
  childDiffs?: DiffNode[]
}

export interface FlatDiffRow {
  path: string
  diffType: DiffType
  rowType: 'node' | 'close'
}

export function buildJsonTree(
  value: unknown,
  key: string,
  path: string,
  depth: number,
  isLast: boolean
): JsonNode {
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
  }
  if (value !== null && typeof value === 'object') {
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
}

export function compareNodes(
  left: JsonNode | undefined,
  right: JsonNode | undefined,
  path: string,
  depth: number
): DiffNode {
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
  const leftChildren = new Map(left.children?.map((c) => [c.key, c]) || [])
  const rightChildren = new Map(right.children?.map((c) => [c.key, c]) || [])
  const allKeys = new Set([...leftChildren.keys(), ...rightChildren.keys()])

  for (const key of allKeys) {
    const leftChild = leftChildren.get(key)
    const rightChild = rightChildren.get(key)
    const childPath = left.type === 'array' ? `${path}[${key}]` : path ? `${path}.${key}` : key
    childDiffs.push(compareNodes(leftChild, rightChild, childPath, depth + 1))
  }

  const hasChanges = childDiffs.some((d) => d.diffType !== 'unchanged')

  return {
    path,
    leftNode: left,
    rightNode: right,
    diffType: hasChanges ? 'changed' : 'unchanged',
    depth,
    isCollapsible: true,
    childDiffs
  }
}
