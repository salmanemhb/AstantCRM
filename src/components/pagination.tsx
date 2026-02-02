'use client'

import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'
import { getPageNumbers } from '@/lib/pagination'

// ============================================
// TYPES
// ============================================

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  showPageNumbers?: boolean
  showFirstLast?: boolean
  maxVisible?: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

interface PageInfo {
  page: number
  limit: number
  total: number
  hasNext: boolean
  hasPrev: boolean
}

interface PaginationInfoProps {
  pageInfo: PageInfo
  itemName?: string
  className?: string
}

// ============================================
// MAIN COMPONENT
// ============================================

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  showPageNumbers = true,
  showFirstLast = true,
  maxVisible = 7,
  size = 'md',
  className = '',
}: PaginationProps) {
  if (totalPages <= 1) return null

  const pages = getPageNumbers(currentPage, totalPages, maxVisible)
  
  const sizeClasses = {
    sm: 'h-8 min-w-[32px] text-sm',
    md: 'h-10 min-w-[40px] text-sm',
    lg: 'h-12 min-w-[48px] text-base',
  }
  
  const buttonBase = `
    inline-flex items-center justify-center rounded-lg
    font-medium transition-colors duration-200
    focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
    ${sizeClasses[size]}
  `
  
  const buttonVariant = {
    default: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50',
    active: 'bg-purple-600 border border-purple-600 text-white',
    ghost: 'text-gray-500 hover:text-gray-700 hover:bg-gray-100',
  }

  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className={`flex items-center justify-center gap-1 ${className}`}
    >
      {/* First Page */}
      {showFirstLast && (
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className={`${buttonBase} ${buttonVariant.default} px-2`}
          aria-label="Go to first page"
        >
          <ChevronLeft className="w-4 h-4" />
          <ChevronLeft className="w-4 h-4 -ml-2" />
        </button>
      )}

      {/* Previous Page */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={`${buttonBase} ${buttonVariant.default} px-3`}
        aria-label="Go to previous page"
      >
        <ChevronLeft className="w-4 h-4" />
        <span className="hidden sm:inline ml-1">Previous</span>
      </button>

      {/* Page Numbers */}
      {showPageNumbers && (
        <div className="hidden sm:flex items-center gap-1">
          {pages.map((page, index) => (
            page === 'ellipsis' ? (
              <span
                key={`ellipsis-${index}`}
                className={`${buttonBase} ${buttonVariant.ghost}`}
              >
                <MoreHorizontal className="w-4 h-4" />
              </span>
            ) : (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`${buttonBase} px-3 ${
                  currentPage === page ? buttonVariant.active : buttonVariant.default
                }`}
                aria-label={`Go to page ${page}`}
                aria-current={currentPage === page ? 'page' : undefined}
              >
                {page}
              </button>
            )
          ))}
        </div>
      )}

      {/* Mobile Page Indicator */}
      <span className="sm:hidden text-sm text-gray-600 px-2">
        Page {currentPage} of {totalPages}
      </span>

      {/* Next Page */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`${buttonBase} ${buttonVariant.default} px-3`}
        aria-label="Go to next page"
      >
        <span className="hidden sm:inline mr-1">Next</span>
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Last Page */}
      {showFirstLast && (
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className={`${buttonBase} ${buttonVariant.default} px-2`}
          aria-label="Go to last page"
        >
          <ChevronRight className="w-4 h-4" />
          <ChevronRight className="w-4 h-4 -ml-2" />
        </button>
      )}
    </nav>
  )
}

// ============================================
// INFO COMPONENT
// ============================================

export function PaginationInfo({
  pageInfo,
  itemName = 'items',
  className = '',
}: PaginationInfoProps) {
  const { page, limit, total } = pageInfo
  
  const start = (page - 1) * limit + 1
  const end = Math.min(page * limit, total)
  
  return (
    <p className={`text-sm text-gray-600 ${className}`}>
      Showing <span className="font-medium">{start}</span> to{' '}
      <span className="font-medium">{end}</span> of{' '}
      <span className="font-medium">{total}</span> {itemName}
    </p>
  )
}

// ============================================
// PAGE SIZE SELECTOR
// ============================================

interface PageSizeSelectorProps {
  value: number
  onChange: (size: number) => void
  options?: number[]
  className?: string
}

export function PageSizeSelector({
  value,
  onChange,
  options = [10, 20, 50, 100],
  className = '',
}: PageSizeSelectorProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label htmlFor="page-size" className="text-sm text-gray-600">
        Show:
      </label>
      <select
        id="page-size"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="
          h-9 px-3 pr-8 rounded-lg border border-gray-300
          bg-white text-sm text-gray-700
          focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500
          appearance-none cursor-pointer
        "
        style={{
          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
          backgroundPosition: 'right 0.5rem center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: '1.5em 1.5em',
        }}
      >
        {options.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </div>
  )
}

// ============================================
// COMBINED PAGINATION BAR
// ============================================

interface PaginationBarProps {
  pageInfo: PageInfo
  totalPages: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  pageSizeOptions?: number[]
  itemName?: string
  className?: string
}

export function PaginationBar({
  pageInfo,
  totalPages,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions,
  itemName = 'items',
  className = '',
}: PaginationBarProps) {
  return (
    <div
      className={`
        flex flex-col sm:flex-row items-center justify-between gap-4
        py-4 border-t border-gray-200
        ${className}
      `}
    >
      <div className="flex items-center gap-4">
        <PaginationInfo pageInfo={pageInfo} itemName={itemName} />
        
        {onPageSizeChange && (
          <PageSizeSelector
            value={pageInfo.limit}
            onChange={onPageSizeChange}
            options={pageSizeOptions}
          />
        )}
      </div>
      
      <Pagination
        currentPage={pageInfo.page}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </div>
  )
}

// ============================================
// LOAD MORE BUTTON (Infinite Scroll Alternative)
// ============================================

interface LoadMoreButtonProps {
  onClick: () => void
  isLoading?: boolean
  hasMore: boolean
  loadedCount: number
  totalCount?: number
  className?: string
}

export function LoadMoreButton({
  onClick,
  isLoading = false,
  hasMore,
  loadedCount,
  totalCount,
  className = '',
}: LoadMoreButtonProps) {
  if (!hasMore) {
    return (
      <p className={`text-center text-sm text-gray-500 py-4 ${className}`}>
        {totalCount
          ? `Showing all ${totalCount} items`
          : `Showing ${loadedCount} items`}
      </p>
    )
  }

  return (
    <div className={`flex flex-col items-center gap-2 py-4 ${className}`}>
      <button
        onClick={onClick}
        disabled={isLoading}
        className="
          px-6 py-2 rounded-lg
          bg-purple-600 text-white font-medium
          hover:bg-purple-700 transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed
          focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2
        "
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Loading...
          </span>
        ) : (
          'Load More'
        )}
      </button>
      
      {totalCount && (
        <p className="text-sm text-gray-500">
          Showing {loadedCount} of {totalCount}
        </p>
      )}
    </div>
  )
}

export default Pagination
