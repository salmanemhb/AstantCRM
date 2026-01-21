'use client'

import { useState, useMemo, useCallback } from 'react'
import { X, ChevronDown, Filter, Check, ChevronRight } from 'lucide-react'

// Types
export interface FilterColumn {
    name: string
    values: string[]
}

export interface ContactList {
    id: string
    name: string
    filter_columns?: Record<string, string[]>
}

export interface ActiveFilter {
    column: string
    value: string
}

interface ContactFiltersProps {
    // Available contact lists to filter by
    contactLists: ContactList[]
    // Selected list IDs (empty = all lists)
    selectedListIds: string[]
    onListSelectionChange: (ids: string[]) => void
    // Active filters
    activeFilters: ActiveFilter[]
    onFiltersChange: (filters: ActiveFilter[]) => void
    // Optional: total contact count for display
    totalCount?: number
    filteredCount?: number
}

// Priority columns - only the most essential 4 filters
// Order matters - first ones show first
const PRIORITY_COLUMNS = [
    'tier_classification', 'tier',           // Tier
    'seniority_level', 'seniority',          // Seniority  
    'geographic_coverage', 'geography',       // Geography
    'organization_type', 'media_organization' // Organization
]

// Columns to always hide (not useful for filtering)
const HIDDEN_COLUMNS = [
    'contact_id', 'full_name', 'direct_email', 'email', 'mobile_phone', 'phone',
    'linkedin_profile', 'linkedin', 'manager_email', 'manager_phone',
    'director_email', 'director_phone', 'reporting_manager', 'editorial_director',
    'last_interaction_date', 'coverage_probability', 'final_approval_authority',
    'market_segment', 'strategic_value', 'relationship_priority', 'influence_score',
    'editorial_focus', 'reach_potential' // Moved to hidden - too granular
]

// Maximum number of primary filters to show
const MAX_PRIMARY_FILTERS = 4

export default function ContactFilters({
    contactLists,
    selectedListIds,
    onListSelectionChange,
    activeFilters,
    onFiltersChange,
    totalCount,
    filteredCount,
}: ContactFiltersProps) {
    const [openDropdown, setOpenDropdown] = useState<string | null>(null)
    const [showMoreFilters, setShowMoreFilters] = useState(false)

    // Aggregate all filter columns from selected lists (or all if none selected)
    const { primaryFilters, secondaryFilters } = useMemo(() => {
        const listsToUse = selectedListIds.length > 0
            ? contactLists.filter(l => selectedListIds.includes(l.id))
            : contactLists

        const aggregated: Record<string, Set<string>> = {}

        for (const list of listsToUse) {
            if (list.filter_columns) {
                for (const [column, values] of Object.entries(list.filter_columns)) {
                    // Skip hidden columns
                    const normalizedCol = column.toLowerCase()
                    if (HIDDEN_COLUMNS.some(h => normalizedCol.includes(h) || h.includes(normalizedCol))) {
                        continue
                    }

                    if (!aggregated[column]) {
                        aggregated[column] = new Set()
                    }
                    values.forEach(v => aggregated[column].add(v))
                }
            }
        }

        // Convert to sorted array format
        const allFilters = Object.entries(aggregated).map(([name, valuesSet]) => ({
            name,
            values: Array.from(valuesSet).sort((a, b) =>
                a.localeCompare(b, undefined, { numeric: true })
            ),
            // Calculate priority score (lower = higher priority)
            priority: PRIORITY_COLUMNS.findIndex(p =>
                name.toLowerCase().includes(p) || p.includes(name.toLowerCase())
            )
        }))

        // Sort by priority (priority columns first, then alphabetically)
        allFilters.sort((a, b) => {
            if (a.priority === -1 && b.priority === -1) return a.name.localeCompare(b.name)
            if (a.priority === -1) return 1
            if (b.priority === -1) return -1
            return a.priority - b.priority
        })

        // Split into primary (always visible) and secondary (behind "more")
        const primary = allFilters.slice(0, MAX_PRIMARY_FILTERS)
        const secondary = allFilters.slice(MAX_PRIMARY_FILTERS)

        return { primaryFilters: primary, secondaryFilters: secondary }
    }, [contactLists, selectedListIds])

    // Add a filter
    const addFilter = useCallback((column: string, value: string) => {
        // Check if already exists
        if (!activeFilters.some(f => f.column === column && f.value === value)) {
            onFiltersChange([...activeFilters, { column, value }])
        }
        setOpenDropdown(null)
    }, [activeFilters, onFiltersChange])

    // Remove a filter
    const removeFilter = useCallback((index: number) => {
        onFiltersChange(activeFilters.filter((_, i) => i !== index))
    }, [activeFilters, onFiltersChange])

    // Clear all filters
    const clearAllFilters = useCallback(() => {
        onFiltersChange([])
        onListSelectionChange([])
    }, [onFiltersChange, onListSelectionChange])

    // Toggle list selection
    const toggleList = useCallback((listId: string) => {
        if (selectedListIds.includes(listId)) {
            onListSelectionChange(selectedListIds.filter(id => id !== listId))
        } else {
            onListSelectionChange([...selectedListIds, listId])
        }
    }, [selectedListIds, onListSelectionChange])

    // Select all lists
    const selectAllLists = useCallback(() => {
        onListSelectionChange([])
    }, [onListSelectionChange])

    const hasFilters = activeFilters.length > 0 || selectedListIds.length > 0

    // Format column name for display (remove underscores, title case)
    const formatColumnName = (name: string) => {
        return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }

    // Render a filter dropdown
    const renderFilterDropdown = (filter: { name: string; values: string[] }) => (
        <div key={filter.name} className="relative">
            <button
                onClick={() => setOpenDropdown(openDropdown === filter.name ? null : filter.name)}
                className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
                <span>{formatColumnName(filter.name)}</span>
                <ChevronDown className="h-4 w-4 text-gray-500" />
            </button>

            {/* Dropdown */}
            {openDropdown === filter.name && (
                <div className="absolute top-full left-0 mt-1 w-48 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                    {filter.values.map((value) => {
                        const isActive = activeFilters.some(
                            f => f.column === filter.name && f.value === value
                        )
                        return (
                            <button
                                key={value}
                                onClick={() => addFilter(filter.name, value)}
                                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-700'
                                    }`}
                            >
                                <span>{value}</span>
                                {isActive && <Check className="h-4 w-4 text-brand-600" />}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
            {/* Source Lists */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-sm font-medium text-gray-700 mr-2">Source:</span>
                <button
                    onClick={selectAllLists}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${selectedListIds.length === 0
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                        }`}
                >
                    All Lists
                </button>
                {contactLists.map((list) => (
                    <button
                        key={list.id}
                        onClick={() => toggleList(list.id)}
                        className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${selectedListIds.includes(list.id)
                            ? 'bg-brand-600 text-white border-brand-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                            }`}
                    >
                        {list.name}
                    </button>
                ))}
            </div>

            {/* Primary Filter Dropdowns */}
            {primaryFilters.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-sm font-medium text-gray-700 mr-2">
                        <Filter className="inline h-4 w-4 mr-1" />
                        Filters:
                    </span>
                    {primaryFilters.map(renderFilterDropdown)}

                    {/* Show More button */}
                    {secondaryFilters.length > 0 && (
                        <button
                            onClick={() => setShowMoreFilters(!showMoreFilters)}
                            className="flex items-center space-x-1 px-3 py-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium"
                        >
                            <span>{showMoreFilters ? 'Less' : `+${secondaryFilters.length} more`}</span>
                            <ChevronRight className={`h-4 w-4 transition-transform ${showMoreFilters ? 'rotate-90' : ''}`} />
                        </button>
                    )}
                </div>
            )}

            {/* Secondary Filters (expanded) */}
            {showMoreFilters && secondaryFilters.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mb-3 pl-16 border-l-2 border-gray-200 ml-2">
                    {secondaryFilters.map(renderFilterDropdown)}
                </div>
            )}

            {/* Active Filter Chips */}
            {activeFilters.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-gray-500">Active:</span>
                    {activeFilters.map((filter, index) => (
                        <span
                            key={`${filter.column}-${filter.value}-${index}`}
                            className="inline-flex items-center space-x-1 px-2 py-1 bg-brand-100 text-brand-700 rounded-full text-sm"
                        >
                            <span className="font-medium">{formatColumnName(filter.column)}:</span>
                            <span>{filter.value}</span>
                            <button
                                onClick={() => removeFilter(index)}
                                className="ml-1 p-0.5 hover:bg-brand-200 rounded-full transition-colors"
                                title="Remove filter"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    ))}
                    <button
                        onClick={clearAllFilters}
                        className="text-sm text-gray-500 hover:text-gray-700 ml-2"
                    >
                        Clear all
                    </button>
                </div>
            )}

            {/* Count Display */}
            {(totalCount !== undefined || filteredCount !== undefined) && (
                <div className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-500">
                    {hasFilters ? (
                        <span>Showing <strong className="text-gray-900">{filteredCount}</strong> of {totalCount} contacts</span>
                    ) : (
                        <span><strong className="text-gray-900">{totalCount}</strong> contacts</span>
                    )}
                </div>
            )}

            {/* Click outside handler */}
            {openDropdown && (
                <div
                    className="fixed inset-0 z-10"
                    onClick={() => setOpenDropdown(null)}
                />
            )}
        </div>
    )
}

// Helper function to filter contacts based on active filters
export function applyFilters<T extends { raw_data?: Record<string, any> | null }>(
    contacts: T[],
    activeFilters: ActiveFilter[],
    selectedListIds: string[],
    getListId: (contact: T) => string | null
): T[] {
    if (activeFilters.length === 0 && selectedListIds.length === 0) {
        return contacts
    }

    return contacts.filter(contact => {
        // Filter by list
        if (selectedListIds.length > 0) {
            const listId = getListId(contact)
            if (!listId || !selectedListIds.includes(listId)) {
                return false
            }
        }

        // Filter by column values (AND logic - must match all)
        for (const filter of activeFilters) {
            const rawData = contact.raw_data
            if (!rawData) return false

            // Check if raw_data has the column and matches the value
            const value = rawData[filter.column]
            if (value === undefined || value === null) return false

            // Case-insensitive comparison
            if (String(value).toLowerCase() !== filter.value.toLowerCase()) {
                return false
            }
        }

        return true
    })
}
