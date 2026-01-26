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
  first_name: ['first name', 'firstname', 'first', 'given name', 'name', 'contact name'],
  last_name: ['last name', 'lastname', 'last', 'surname', 'family name'],
  email: ['email', 'e-mail', 'email address', 'mail', 'contact email'],
  firm: ['firm', 'company', 'organization', 'organisation', 'fund', 'vc', 'investor', 'fund name'],
  role: ['role', 'title', 'position', 'job title', 'designation', 'vp', 'partner'],
  geography: ['geography', 'location', 'city', 'country', 'region', 'geo', 'office'],
  investment_focus: ['investment focus', 'focus', 'sector', 'sectors', 'thesis', 'investment thesis', 'stage'],
  notes_private: ['notes', 'note', 'comments', 'comment', 'private notes'],
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
        // Don't set sheetRows - let it read everything
        const workbook = XLSX.read(data, { 
          type: 'array',
          // Do NOT set sheetRows - default reads all rows
          cellDates: true,
          cellNF: false,
          cellText: false,
        })
        
        // Combine all sheets
        let allRows: Record<string, any>[] = []
        let headers: string[] = []
        
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName]
          
          // Get sheet range to check total rows
          const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')
          console.log(`Sheet "${sheetName}" range: ${sheet['!ref']}, rows: ${range.e.r - range.s.r + 1}`)
          
          // First, get raw data to find the header row
          const rawData = XLSX.utils.sheet_to_json<any[]>(sheet, {
            header: 1, // Get as array of arrays
            defval: '',
            raw: true,
          })
          
          console.log(`Sheet "${sheetName}" raw data length: ${rawData.length}`)
          
          // Skip empty sheets
          if (rawData.length === 0) continue
          
          // Find the header row - look for a row with "email" or multiple non-empty cells
          let headerRowIndex = 0
          for (let i = 0; i < Math.min(rawData.length, 10); i++) {
            const row = rawData[i] as any[]
            if (!row) continue
            
            // Count non-empty cells
            const nonEmptyCells = row.filter(cell => 
              cell !== null && cell !== undefined && String(cell).trim() !== ''
            ).length
            
            // Check if this looks like a header row (has email-like column or many columns)
            const hasEmailColumn = row.some(cell => 
              String(cell).toLowerCase().includes('email') ||
              String(cell).toLowerCase().includes('e-mail')
            )
            
            const hasNameColumn = row.some(cell => 
              String(cell).toLowerCase().includes('name') ||
              String(cell).toLowerCase().includes('first') ||
              String(cell).toLowerCase().includes('last')
            )
            
            if ((hasEmailColumn || hasNameColumn) && nonEmptyCells >= 3) {
              headerRowIndex = i
              break
            }
            
            // If row has 5+ non-empty cells, it's likely the header
            if (nonEmptyCells >= 5) {
              headerRowIndex = i
              break
            }
          }
          
          console.log(`Sheet "${sheetName}" header row index: ${headerRowIndex}`)
          
          // Now parse with the correct header row
          const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
            defval: '',
            range: headerRowIndex, // Start from the detected header row
            raw: true,
          })
          
          console.log(`Sheet "${sheetName}" parsed jsonData length: ${jsonData.length}`)
          
          // Get headers from first sheet (or first sheet with data)
          if (headers.length === 0 && jsonData.length > 0) {
            headers = Object.keys(jsonData[0]).filter(h => !h.startsWith('__EMPTY'))
          }
          
          // Clean up rows and add to allRows
          for (const row of jsonData) {
            const cleaned: Record<string, any> = {}
            for (const [key, value] of Object.entries(row)) {
              if (!key.startsWith('__EMPTY')) {
                cleaned[key] = value
              }
            }
            // Only add if row has some data
            if (Object.keys(cleaned).length > 0) {
              allRows.push(cleaned)
            }
          }
          
          console.log(`After processing sheet "${sheetName}", total allRows: ${allRows.length}`)
        }
        
        console.log(`FINAL: Parsed ${workbook.SheetNames.length} sheets, total ${allRows.length} rows`)
        
        resolve({
          headers,
          rows: allRows,
          fileName,
          fileType,
          rowCount: allRows.length,
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
 * Returns null if the email is invalid or missing (row will be skipped)
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
} | null {
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
  let email = String(row[mapping.email!] || '').trim().toLowerCase()
  
  // Clean up common email issues
  email = email
    .replace(/\s+/g, '') // Remove all spaces (handles "name @domain" or "name@ domain")
    .replace(/[<>]/g, '') // Remove angle brackets like <email@domain.com>
    .replace(/^mailto:/i, '') // Remove mailto: prefix
  
  // Validate email format - return null for invalid emails (will be skipped)
  if (!email || !emailRegex.test(email)) {
    return null // Signal to skip this row
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

// Columns that are good for filtering (categorical data, not unique per row)
const FILTERABLE_COLUMNS = [
  'tier', 'tier_classification', 'seniority', 'seniority_level',
  'geography', 'geographic_coverage', 'region', 'country', 'city', 'location',
  'sector', 'sectors', 'focus', 'investment_focus', 'stage', 'investment_stage',
  'type', 'organization_type', 'firm_type', 'fund_type',
  'status', 'priority', 'category', 'segment', 'market_segment',
  'role', 'title', 'position', 'department',
]

// Columns to exclude from filtering (too unique or not useful)
const EXCLUDED_FILTER_COLUMNS = [
  'email', 'e-mail', 'phone', 'mobile', 'linkedin', 'twitter',
  'first_name', 'last_name', 'firstname', 'lastname', 'name', 'full_name',
  'notes', 'comments', 'description', 'bio', 'about',
  'id', 'contact_id', 'row_id', 'index',
  'date', 'created', 'updated', 'last_interaction',
  'url', 'website', 'link', 'profile',
]

/**
 * Extract filter columns with unique values from spreadsheet data
 * Returns a Record<column_name, unique_values[]> for columns suitable for filtering
 */
export function extractFilterColumns(
  rows: Record<string, any>[],
  headers: string[],
  maxUniqueValues: number = 50 // Don't include columns with too many unique values
): Record<string, string[]> {
  const filterColumns: Record<string, Set<string>> = {}
  
  // Initialize sets for each header
  for (const header of headers) {
    const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '_')
    
    // Skip excluded columns
    if (EXCLUDED_FILTER_COLUMNS.some(exc => 
      normalizedHeader.includes(exc) || exc.includes(normalizedHeader)
    )) {
      continue
    }
    
    filterColumns[header] = new Set()
  }
  
  // Collect unique values from each row
  for (const row of rows) {
    for (const header of Object.keys(filterColumns)) {
      const value = row[header]
      if (value !== null && value !== undefined && value !== '') {
        const strValue = String(value).trim()
        if (strValue && strValue.length < 100) { // Skip very long values
          filterColumns[header].add(strValue)
        }
      }
    }
  }
  
  // Filter out columns with too many unique values (not useful for filtering)
  // and columns with only 1 unique value (no variation)
  const result: Record<string, string[]> = {}
  
  for (const [header, values] of Object.entries(filterColumns)) {
    const uniqueCount = values.size
    if (uniqueCount >= 2 && uniqueCount <= maxUniqueValues) {
      // Sort values naturally (handles numbers in strings)
      result[header] = Array.from(values).sort((a, b) => 
        a.localeCompare(b, undefined, { numeric: true })
      )
    }
  }
  
  // Prioritize columns that match known filterable patterns
  const prioritized: Record<string, string[]> = {}
  const other: Record<string, string[]> = {}
  
  for (const [header, values] of Object.entries(result)) {
    const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '_')
    const isPriority = FILTERABLE_COLUMNS.some(fc => 
      normalizedHeader.includes(fc) || fc.includes(normalizedHeader)
    )
    
    if (isPriority) {
      prioritized[header] = values
    } else {
      other[header] = values
    }
  }
  
  // Return prioritized columns first, then others
  return { ...prioritized, ...other }
}
