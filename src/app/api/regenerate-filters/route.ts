import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// Columns that are good for filtering (categorical data, not unique per row)
const FILTERABLE_COLUMN_PATTERNS = [
  // Tier & Seniority
  'tier', 'tier_classification', 'seniority', 'seniority_level', 'job_level',
  // Geography
  'geography', 'geographic_coverage', 'region', 'country', 'city', 'location', 'offices',
  // Investment Focus (VC-specific)
  'sector', 'sectors', 'focus', 'investment_focus', 'investment_markets', 'markets',
  'stage', 'investment_stage', 'investment_stages', 'stages',
  'industry', 'industries', 'thesis', 'investment_thesis',
  // Type & Category
  'type', 'organization_type', 'firm_type', 'fund_type', 'investor_type',
  'status', 'priority', 'category', 'segment', 'market_segment',
  // Role
  'role', 'title', 'position', 'department', 'job_title',
  // Other VC columns
  'founded_year', 'number_of_employees', 'email_status', 'email_qualification',
]

// Columns that should have comma-separated values split
const SPLIT_VALUE_COLUMNS = [
  'investment_markets', 'markets', 'investment_focus', 'focus',
  'investment_stages', 'stages', 'sectors', 'industries',
]

// Columns to exclude from filtering (too unique or not useful)
const EXCLUDED_COLUMN_PATTERNS = [
  // Identity columns
  'contact_id', 'id', 'gid', 'row_id', 'index',
  // Name columns (too unique)
  'full_name', 'first_name', 'last_name', 'firstname', 'lastname', 'name',
  // Contact info
  'direct_email', 'email', 'email_2', 'mobile_phone', 'phone', 'company_phone',
  // Links (too unique)
  'linkedin_profile', 'linkedin', 'company_linkedin', 'twitter', 'instagram',
  'website', 'portfolio_link', 'crunchbase', 'pitchbook', 'person_twitter',
  'person_detail_page_link', 'team_detail_page_link', 'person_bio',
  // Long text fields
  'notes', 'short_firm_description', 'description', 'bio', 'about', 'comments',
  // Company identifiers
  'vat_number', 'siren_number', 'siret', 'naf_code', 'headquarters',
  // Address (too specific)
  'company_headquarters_address', 'company_headquarters_zip_code', 'company_headquarters_city',
  // Dates
  'date', 'created', 'updated', 'last_interaction',
  // URLs
  'url', 'link', 'profile',
]

/**
 * POST /api/regenerate-filters
 * Regenerates filter_columns for a contact_list by analyzing contacts' raw_data
 */
export async function POST(request: NextRequest) {
  try {
    const { list_id } = await request.json()

    if (!list_id) {
      return NextResponse.json({ success: false, error: 'list_id is required' }, { status: 400 })
    }

    // Fetch contacts for this list
    const { data: contacts, error: fetchError } = await supabase
      .from('contacts')
      .select('raw_data')
      .eq('contact_list_id', list_id)
      .limit(1000) // Sample for efficiency

    if (fetchError) {
      return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 })
    }

    if (!contacts || contacts.length === 0) {
      return NextResponse.json({ success: false, error: 'No contacts found for this list' }, { status: 404 })
    }

    // Extract filter columns from raw_data
    const filterColumns: Record<string, Set<string>> = {}

    for (const contact of contacts) {
      if (!contact.raw_data || typeof contact.raw_data !== 'object') continue

      for (const [key, value] of Object.entries(contact.raw_data)) {
        if (value === null || value === undefined || value === '') continue

        const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '_')

        // Skip excluded columns
        if (EXCLUDED_COLUMN_PATTERNS.some(exc => 
          normalizedKey.includes(exc) || exc.includes(normalizedKey)
        )) {
          continue
        }

        const strValue = String(value).trim()
        if (!strValue || strValue.length >= 200) continue // Skip empty or very long values
        
        // Check if this column should have values split by comma
        const shouldSplit = SPLIT_VALUE_COLUMNS.some(sc => 
          normalizedKey.includes(sc) || sc.includes(normalizedKey)
        )
        
        if (!filterColumns[key]) {
          filterColumns[key] = new Set()
        }
        
        if (shouldSplit && strValue.includes(',')) {
          // Split comma-separated values and add each individually
          const parts = strValue.split(',').map(p => p.trim()).filter(p => p.length > 0 && p.length < 100)
          parts.forEach(part => filterColumns[key].add(part))
        } else if (strValue.length < 100) {
          filterColumns[key].add(strValue)
        }
      }
    }

    // Filter out columns with too many or too few unique values
    const result: Record<string, string[]> = {}
    const maxUniqueValues = 50

    for (const [header, values] of Object.entries(filterColumns)) {
      const uniqueCount = values.size
      if (uniqueCount >= 2 && uniqueCount <= maxUniqueValues) {
        result[header] = Array.from(values).sort((a, b) =>
          a.localeCompare(b, undefined, { numeric: true })
        )
      }
    }

    // Prioritize filterable columns
    const prioritized: Record<string, string[]> = {}
    const other: Record<string, string[]> = {}

    for (const [header, values] of Object.entries(result)) {
      const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '_')
      const isPriority = FILTERABLE_COLUMN_PATTERNS.some(fc =>
        normalizedHeader.includes(fc) || fc.includes(normalizedHeader)
      )

      if (isPriority) {
        prioritized[header] = values
      } else {
        other[header] = values
      }
    }

    const finalFilterColumns = { ...prioritized, ...other }

    // Update the contact_list
    const { error: updateError } = await supabase
      .from('contact_lists')
      .update({ filter_columns: finalFilterColumns })
      .eq('id', list_id)

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Regenerated ${Object.keys(finalFilterColumns).length} filter columns`,
      filter_columns: finalFilterColumns,
    })
  } catch (err: any) {
    console.error('[REGENERATE-FILTERS] Error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
