// ============================================
// SPREADSHEET PARSER - CSV & EXCEL
// ============================================

import * as XLSX from 'xlsx'
import Papa from 'papaparse'

export interface ParsedSpreadsheet {
  headers: string[]
  rows: Record<string, any>[]
  fileName: string
  fileType: 'csv' | 'xlsx' | 'xls'
  rowCount: number
}

export interface ColumnMapping {
  first_name?: string
  last_name?: string
  email?: string
  firm?: string
  role?: string
  geography?: string
  investment_focus?: string
  notes_private?: string
}

// Common header variations for auto-mapping
const HEADER_MAPPINGS: Record<string, string[]> = {
  first_name: ['first name', 'firstname', 'first', 'given name', 'name', 'contact name', 'full_name', 'full name', 'contact'],
  last_name: ['last name', 'lastname', 'last', 'surname', 'family name'],
  email: ['email', 'e-mail', 'email address', 'mail', 'contact email', 'direct_email', 'direct email', 'work email', 'primary email'],
  firm: ['firm', 'company', 'organization', 'organisation', 'fund', 'vc', 'investor', 'fund name', 'media_organization', 'media organization', 'parent_company', 'parent company'],
  role: ['role', 'title', 'position', 'job title', 'designation', 'vp', 'partner', 'professional_title', 'professional title', 'seniority_level', 'seniority level'],
  geography: ['geography', 'location', 'city', 'country', 'region', 'geo', 'office', 'geographic_coverage', 'geographic coverage'],
  investment_focus: ['investment focus', 'focus', 'sector', 'sectors', 'thesis', 'investment thesis', 'stage', 'editorial_focus', 'editorial focus', 'market_segment', 'market segment', 'specialization_areas', 'specialization areas'],
  notes_private: ['notes', 'note', 'comments', 'comment', 'private notes', 'content_preferences', 'content preferences'],
}

/**
 * Parse a file (CSV or Excel) and return structured data
 */
export async function parseSpreadsheet(file: File): Promise<ParsedSpreadsheet> {
  const fileName = file.name
  const fileType = getFileType(fileName)

  if (fileType === 'csv') {
    return parseCSV(file, fileName)
  } else {
    return parseExcel(file, fileName, fileType)
  }
}

/**
 * Determine file type from extension
 */
function getFileType(fileName: string): 'csv' | 'xlsx' | 'xls' {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (ext === 'csv') return 'csv'
  if (ext === 'xlsx') return 'xlsx'
  if (ext === 'xls') return 'xls'
  throw new Error(`Unsupported file type: ${ext}`)
}

/**
 * Parse CSV file using PapaParse
 */
async function parseCSV(file: File, fileName: string): Promise<ParsedSpreadsheet> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        const headers = results.meta.fields || []
        const rows = results.data as Record<string, any>[]

        resolve({
          headers,
          rows,
          fileName,
          fileType: 'csv',
          rowCount: rows.length,
        })
      },
      error: (error) => {
        reject(new Error(`CSV parsing failed: ${error.message}`))
      },
    })
  })
}

/**
 * Parse Excel file using SheetJS
 */
async function parseExcel(
  file: File,
  fileName: string,
  fileType: 'xlsx' | 'xls'
): Promise<ParsedSpreadsheet> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })

        // Get first sheet
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]

        // Convert to array of arrays first to detect header row
        const allRows = XLSX.utils.sheet_to_json<any[]>(sheet, {
          header: 1, // Get raw array data
          defval: '',
        })

        // Find the header row (first row that looks like it has column headers)
        let headerRowIndex = 0
        for (let i = 0; i < Math.min(5, allRows.length); i++) {
          const row = allRows[i] as string[]
          const hasEmailColumn = row.some((cell: any) => {
            const cellStr = String(cell || '').toLowerCase()
            return cellStr.includes('email') || cellStr.includes('mail') || cellStr === 'direct_email'
          })
          const hasNameColumn = row.some((cell: any) => {
            const cellStr = String(cell || '').toLowerCase()
            return cellStr.includes('name') || cellStr === 'full_name' || cellStr === 'contact'
          })
          if (hasEmailColumn && hasNameColumn) {
            headerRowIndex = i
            console.log('[parseExcel] Detected header row at index:', i)
            break
          }
        }

        // Get headers from detected row
        const headers = (allRows[headerRowIndex] as string[]).map(h => String(h || '').trim()).filter(h => h !== '')
        console.log('[parseExcel] Headers found:', headers.slice(0, 10))

        // Build rows as objects starting from row after headers
        const rows: Record<string, any>[] = []
        for (let i = headerRowIndex + 1; i < allRows.length; i++) {
          const rowData = allRows[i] as any[]
          // Skip empty rows
          if (!rowData || rowData.every((cell: any) => !cell || String(cell).trim() === '')) continue

          const rowObj: Record<string, any> = {}
          headers.forEach((header, idx) => {
            rowObj[header] = rowData[idx] ?? ''
          })
          rows.push(rowObj)
        }

        console.log('[parseExcel] Parsed', rows.length, 'data rows')

        resolve({
          headers,
          rows,
          fileName,
          fileType,
          rowCount: rows.length,
        })
      } catch (error: any) {
        reject(new Error(`Excel parsing failed: ${error.message}`))
      }
    }

    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }

    reader.readAsArrayBuffer(file)
  })
}

/**
 * Auto-detect column mappings based on header names
 */
export function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {}

  for (const header of headers) {
    const normalizedHeader = header.toLowerCase().trim()

    for (const [field, variations] of Object.entries(HEADER_MAPPINGS)) {
      if (variations.some(v => normalizedHeader.includes(v) || v.includes(normalizedHeader))) {
        // Only set if not already mapped
        if (!mapping[field as keyof ColumnMapping]) {
          mapping[field as keyof ColumnMapping] = header
        }
        break
      }
    }
  }

  // Handle combined name field (e.g., "Contact Name" = "John Smith")
  if (!mapping.first_name && !mapping.last_name) {
    const nameHeader = headers.find(h =>
      h.toLowerCase().includes('name') &&
      !h.toLowerCase().includes('firm') &&
      !h.toLowerCase().includes('company')
    )
    if (nameHeader) {
      mapping.first_name = nameHeader // Will need to split during import
    }
  }

  return mapping
}

/**
 * Extract a contact from a row using the provided mapping
 */
export function extractContact(
  row: Record<string, any>,
  mapping: ColumnMapping
): {
  first_name: string
  last_name: string
  email: string
  firm: string | null
  role: string | null
  geography: string | null
  investment_focus: string | null
  notes_private: string | null
  raw_data: Record<string, any>
} {
  // Handle combined name field
  let firstName = ''
  let lastName = ''

  if (mapping.first_name && mapping.last_name) {
    firstName = String(row[mapping.first_name] || '').trim()
    lastName = String(row[mapping.last_name] || '').trim()
  } else if (mapping.first_name) {
    // Try to split combined name
    const fullName = String(row[mapping.first_name] || '').trim()
    const parts = fullName.split(/\s+/)
    firstName = parts[0] || ''
    lastName = parts.slice(1).join(' ') || ''
  }

  // Email format validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const email = String(row[mapping.email!] || '').trim().toLowerCase()

  // Validate email format - skip rows with invalid emails
  if (!email || !emailRegex.test(email)) {
    throw new Error(`Invalid email format: "${email || '(empty)'}"`)
  }

  return {
    first_name: firstName || 'Unknown',
    last_name: lastName || 'Contact',
    email: email,
    firm: mapping.firm ? String(row[mapping.firm] || '').trim() || null : null,
    role: mapping.role ? String(row[mapping.role] || '').trim() || null : null,
    geography: mapping.geography ? String(row[mapping.geography] || '').trim() || null : null,
    investment_focus: mapping.investment_focus
      ? String(row[mapping.investment_focus] || '').trim() || null
      : null,
    notes_private: mapping.notes_private
      ? String(row[mapping.notes_private] || '').trim() || null
      : null,
    raw_data: row, // Keep original data for dynamic display
  }
}

/**
 * Validate that required fields are mapped
 */
export function validateMapping(mapping: ColumnMapping): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!mapping.email) {
    errors.push('Email column must be mapped')
  }

  if (!mapping.first_name && !mapping.last_name) {
    errors.push('At least one name column (first or last name) must be mapped')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Columns that should ALWAYS be treated as filterable (case-insensitive match)
 */
const ALWAYS_FILTERABLE_COLUMNS = [
  'tier', 'stage', 'sector', 'geography', 'geo', 'region', 'country', 'city',
  'focus', 'investment focus', 'investment_focus', 'type', 'status', 'category'
]

/**
 * Extract filterable columns from parsed spreadsheet data
 * A column is filterable if:
 * 1. It's in the ALWAYS_FILTERABLE_COLUMNS list, OR
 * 2. It has < 30% unique values relative to total rows AND < 50 unique values
 * 
 * @returns Object mapping column names to their unique values
 */
export function extractFilterableColumns(
  rows: Record<string, any>[],
  headers: string[]
): Record<string, string[]> {
  const filterColumns: Record<string, string[]> = {}

  if (rows.length === 0) return filterColumns

  const totalRows = rows.length
  const maxUniqueForDynamic = Math.min(50, Math.ceil(totalRows * 0.3))

  for (const header of headers) {
    // Skip email and name columns - not useful as filters
    const headerLower = header.toLowerCase()
    if (headerLower.includes('email') ||
      headerLower.includes('name') ||
      headerLower.includes('note') ||
      headerLower.includes('comment')) {
      continue
    }

    // Collect unique non-empty values
    const uniqueValues = new Set<string>()
    for (const row of rows) {
      const value = row[header]
      if (value !== null && value !== undefined && value !== '') {
        const strValue = String(value).trim()
        if (strValue.length > 0 && strValue.length < 100) { // Skip very long values
          uniqueValues.add(strValue)
        }
      }
    }

    // Skip if no values or too many unique values
    if (uniqueValues.size === 0 || uniqueValues.size === totalRows) {
      continue
    }

    // Check if always-filterable OR meets dynamic threshold
    const isAlwaysFilterable = ALWAYS_FILTERABLE_COLUMNS.some(col =>
      headerLower.includes(col) || col.includes(headerLower)
    )
    const meetsDynamicThreshold = uniqueValues.size <= maxUniqueForDynamic

    if (isAlwaysFilterable || meetsDynamicThreshold) {
      // Sort values for consistent display
      filterColumns[header] = Array.from(uniqueValues).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      )
    }
  }

  return filterColumns
}

/**
 * Format a header for display (Title Case)
 */
export function formatHeader(header: string): string {
  return header
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim()
}

/**
 * Get display value for a cell (handles various types)
 */
export function formatCellValue(value: any): string {
  if (value === null || value === undefined || value === '') {
    return '—'
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }
  if (typeof value === 'number') {
    return value.toLocaleString()
  }
  if (value instanceof Date) {
    return value.toLocaleDateString()
  }
  return String(value)
}
