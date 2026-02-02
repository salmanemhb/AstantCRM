/**
 * Pagination Utilities
 * Provides cursor-based and offset pagination helpers
 */

// ============================================
// TYPES
// ============================================

export interface PaginationParams {
  page?: number
  limit?: number
  cursor?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResult<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
    nextCursor?: string
    prevCursor?: string
  }
}

export interface CursorPaginatedResult<T> {
  data: T[]
  pagination: {
    limit: number
    hasNext: boolean
    hasPrev: boolean
    nextCursor: string | null
    prevCursor: string | null
    total?: number // Optional, expensive to compute
  }
}

// ============================================
// OFFSET PAGINATION
// ============================================

export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

/**
 * Parse pagination params from URL search params
 */
export function parsePaginationParams(
  searchParams: URLSearchParams | Record<string, string>
): PaginationParams {
  const params = searchParams instanceof URLSearchParams
    ? Object.fromEntries(searchParams.entries())
    : searchParams
  
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1)
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(params.limit || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)
  )
  
  return {
    page,
    limit,
    cursor: params.cursor,
    sortBy: params.sortBy || 'created_at',
    sortOrder: (params.sortOrder === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
  }
}

/**
 * Calculate offset from page and limit
 */
export function getOffset(page: number, limit: number): number {
  return (page - 1) * limit
}

/**
 * Create pagination metadata from results
 */
export function createPaginationMeta(
  total: number,
  page: number,
  limit: number
): PaginatedResult<never>['pagination'] {
  const totalPages = Math.ceil(total / limit)
  
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  }
}

/**
 * Paginate an array (client-side)
 */
export function paginateArray<T>(
  items: T[],
  page: number,
  limit: number
): PaginatedResult<T> {
  const offset = getOffset(page, limit)
  const data = items.slice(offset, offset + limit)
  
  return {
    data,
    pagination: createPaginationMeta(items.length, page, limit),
  }
}

// ============================================
// CURSOR PAGINATION
// ============================================

/**
 * Encode cursor from object
 */
export function encodeCursor(obj: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64url')
}

/**
 * Decode cursor to object
 */
export function decodeCursor<T = Record<string, unknown>>(cursor: string): T | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf-8')
    return JSON.parse(decoded) as T
  } catch {
    return null
  }
}

/**
 * Create cursor from item's sortable fields
 */
export function createCursor(
  item: Record<string, unknown>,
  sortBy: string,
  idField: string = 'id'
): string {
  return encodeCursor({
    value: item[sortBy],
    id: item[idField],
    sortBy,
  })
}

/**
 * Parse cursor for Supabase query
 */
export interface CursorData {
  value: unknown
  id: string
  sortBy: string
}

export function parseCursor(cursor: string): CursorData | null {
  return decodeCursor<CursorData>(cursor)
}

// ============================================
// SUPABASE HELPERS
// ============================================

/**
 * Apply pagination to Supabase query builder
 * Returns the query with range applied
 */
export function applyOffsetPagination<T>(
  query: T,
  page: number,
  limit: number
): T {
  const offset = getOffset(page, limit)
  // Note: This returns the query with range, but can't add methods
  // Caller should apply .range(offset, offset + limit - 1)
  return query
}

/**
 * Build Supabase range from pagination params
 */
export function getSupabaseRange(page: number, limit: number): { from: number; to: number } {
  const offset = getOffset(page, limit)
  return {
    from: offset,
    to: offset + limit - 1,
  }
}

// ============================================
// REACT HOOKS HELPERS
// ============================================

/**
 * Generate page numbers for pagination UI
 */
export function getPageNumbers(
  currentPage: number,
  totalPages: number,
  maxVisible: number = 7
): (number | 'ellipsis')[] {
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  
  const pages: (number | 'ellipsis')[] = []
  const sidePages = Math.floor((maxVisible - 3) / 2) // Pages on each side of current
  
  // Always show first page
  pages.push(1)
  
  // Calculate range around current page
  let start = Math.max(2, currentPage - sidePages)
  let end = Math.min(totalPages - 1, currentPage + sidePages)
  
  // Adjust if near start or end
  if (currentPage <= sidePages + 2) {
    end = maxVisible - 2
  } else if (currentPage >= totalPages - sidePages - 1) {
    start = totalPages - maxVisible + 3
  }
  
  // Add ellipsis before range if needed
  if (start > 2) {
    pages.push('ellipsis')
  }
  
  // Add range
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  
  // Add ellipsis after range if needed
  if (end < totalPages - 1) {
    pages.push('ellipsis')
  }
  
  // Always show last page
  if (totalPages > 1) {
    pages.push(totalPages)
  }
  
  return pages
}

/**
 * URL builder for pagination links
 */
export function buildPaginationUrl(
  baseUrl: string,
  page: number,
  params: Record<string, string> = {}
): string {
  const url = new URL(baseUrl, 'http://localhost') // Base URL for parsing
  
  url.searchParams.set('page', String(page))
  
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value)
    }
  }
  
  return `${url.pathname}${url.search}`
}

// ============================================
// INFINITE SCROLL HELPERS
// ============================================

export interface InfiniteScrollState<T> {
  items: T[]
  cursor: string | null
  hasMore: boolean
  isLoading: boolean
  error: string | null
}

/**
 * Merge new page into infinite scroll state
 */
export function mergeInfiniteScrollPage<T>(
  currentState: InfiniteScrollState<T>,
  newItems: T[],
  nextCursor: string | null,
  hasMore: boolean
): InfiniteScrollState<T> {
  return {
    items: [...currentState.items, ...newItems],
    cursor: nextCursor,
    hasMore,
    isLoading: false,
    error: null,
  }
}

/**
 * Initial infinite scroll state
 */
export function createInfiniteScrollState<T>(): InfiniteScrollState<T> {
  return {
    items: [],
    cursor: null,
    hasMore: true,
    isLoading: false,
    error: null,
  }
}
