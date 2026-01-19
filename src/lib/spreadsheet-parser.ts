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
        const workbook = XLSX.read(data, { type: 'array' })
        
        // Get first sheet
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        
        // Convert to JSON with headers
        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
          defval: '', // Default value for empty cells
        })
        
        // Extract headers from first row
        const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : []
        
        resolve({
          headers,
          rows: jsonData,
          fileName,
          fileType,
          rowCount: jsonData.length,
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
