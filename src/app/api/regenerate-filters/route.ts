import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// Columns that are good for filtering (categorical data, not unique per row)
const FILTERABLE_COLUMN_PATTERNS = [
  'type', 'investor_type', 'organization_type', 'firm_type', 'fund_type',
  'tier', 'tier_classification', 'seniority', 'seniority_level',
  'geography', 'geographic_coverage', 'region', 'country', 'city', 'location',
  'sector', 'sectors', 'focus', 'investment_focus', 'stage', 'investment_stage',
  'status', 'priority', 'category', 'segment', 'market_segment',
  'role', 'title', 'position', 'department',
]

// Columns to exclude from filtering (too unique or not useful)
const EXCLUDED_COLUMN_PATTERNS = [
  'email', 'e-mail', 'phone', 'mobile', 'linkedin', 'twitter',
  'first_name', 'last_name', 'firstname', 'lastname', 'name', 'full_name',
  'notes', 'comments', 'description', 'bio', 'about',
  'id', 'contact_id', 'row_id', 'index',
  'date', 'created', 'updated', 'last_interaction',
  'url', 'website', 'link', 'profile',
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
        if (strValue && strValue.length < 100) {
          if (!filterColumns[key]) {
            filterColumns[key] = new Set()
          }
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
