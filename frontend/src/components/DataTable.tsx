import { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export interface Column<T> {
  key: string
  header: string
  sortable?: boolean
  width?: string
  render?: (row: T) => ReactNode
  // Shorthand for rendering a link cell
  linkTo?: (row: T) => string
  // Inline style function
  cellStyle?: (row: T) => React.CSSProperties | undefined
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (row: T) => string
  loading?: boolean
  emptyMessage?: string
  emptyAction?: ReactNode
  // Pagination
  page?: number
  totalPages?: number
  total?: number
  onPageChange?: (page: number) => void
  // Sort
  sortKey?: string
  sortDir?: 'asc' | 'desc'
  onSort?: (key: string) => void
  // Loading skeleton rows
  skeletonRows?: number
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyExtractor,
  loading,
  emptyMessage = 'No data found.',
  emptyAction,
  page,
  totalPages,
  total,
  onPageChange,
  sortKey,
  sortDir,
  onSort,
  skeletonRows = 5,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="table-container">
        <table>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} style={{ width: col.width }}>{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>            {Array.from({ length: skeletonRows }).map((_, i) => (
                  <tr key={`skeleton-${i}`}>
                    {columns.map((col, j) => (
                      <td key={col.key}>
                        <div
                          className="skeleton-cell"
                          style={{
                            height: 14,
                            width: ['60%', '75%', '45%', '85%', '55%'][j % 5],
                            background: 'var(--gray-100)',
                            borderRadius: 4,
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="empty-state">
        <p>{emptyMessage}</p>
        {emptyAction && <div style={{ marginTop: 12 }}>{emptyAction}</div>}
      </div>
    )
  }

  const handleSort = (key: string) => {
    if (!onSort) return
    onSort(key)
  }

  return (
    <>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    width: col.width,
                    cursor: col.sortable && onSort ? 'pointer' : undefined,
                    userSelect: 'none',
                  }}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  {col.header}
                  {col.sortable && sortKey === col.key && (
                    <span className="sort-indicator" style={{ marginLeft: 4 }}>
                      {sortDir === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={keyExtractor(row)}>
                {columns.map((col) => {
                  const cellStyle = col.cellStyle?.(row)
                  const value = row[col.key]

                  if (col.linkTo) {
                    return (
                      <td key={col.key} style={cellStyle}>
                        <Link to={col.linkTo(row)} style={{ fontWeight: 500 }}>
                          {col.render ? col.render(row) : value}
                        </Link>
                      </td>
                    )
                  }

                  return (
                    <td key={col.key} style={cellStyle}>
                      {col.render ? col.render(row) : value ?? '—'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages && totalPages > 1 && onPageChange && (
        <div className="pagination">
          <button
            disabled={!page || page <= 1}
            onClick={() => onPageChange((page || 1) - 1)}
          >
            Previous
          </button>
          <span className="page-info">
            Page {page || 1} of {totalPages}
            {total != null && <span className="text-muted" style={{ marginLeft: 8 }}>({total} total)</span>}
          </span>
          <button
            disabled={!page || page >= totalPages}
            onClick={() => onPageChange((page || 1) + 1)}
          >
            Next
          </button>
        </div>
      )}
    </>
  )
}
