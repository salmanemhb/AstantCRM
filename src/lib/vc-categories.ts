// ============================================
// VC CATEGORIES & INDUSTRY DEFINITIONS
// For filtering and categorizing VC contacts
// ============================================

// VC Tier/Category
export const VC_CATEGORIES = [
  'Tier 1 VC',           // Top-tier global VCs (Sequoia, a16z, Accel, etc.)
  'European VC',         // European-focused VCs
  'Corporate VC',        // Corporate venture arms (GV, Intel Capital, etc.)
  'Growth Equity',       // Later-stage growth investors
  'Family Office',       // Family office investors
  'Angel/Syndicate',     // Angel investors and syndicates
  'Accelerator',         // Y Combinator, Techstars, etc.
  'Government Fund',     // Government-backed funds
] as const

export type VCCategory = typeof VC_CATEGORIES[number]

// Investment Stage Focus
export const INVESTMENT_STAGES = [
  'Pre-Seed',
  'Seed',
  'Series A',
  'Series B',
  'Series C',
  'Growth',
  'Late Stage',
] as const

export type InvestmentStage = typeof INVESTMENT_STAGES[number]

// Industry/Sector Focus
export const INDUSTRY_SECTORS = [
  // Technology
  'AI',
  'Machine Learning',
  'Deep Tech',
  'Developer Tools',
  'Cybersecurity',
  'Cloud Infrastructure',
  'Data Analytics',
  
  // Finance
  'Fintech',
  'Insurtech',
  'Wealthtech',
  'Payments',
  'Banking',
  'Crypto',
  'Web3',
  'DeFi',
  
  // Enterprise
  'Enterprise Software',
  'Enterprise SaaS',
  'B2B SaaS',
  'Vertical SaaS',
  'HR Tech',
  'Legal Tech',
  
  // Consumer
  'Consumer Tech',
  'Consumer Apps',
  'E-commerce',
  'Marketplaces',
  'Gaming',
  'Social',
  'Media',
  'Entertainment',
  
  // Health & Science
  'Healthtech',
  'Biotech',
  'Medtech',
  'Digital Health',
  'Pharma',
  
  // Sustainability
  'Climate Tech',
  'Clean Energy',
  'Sustainability',
  'Agtech',
  'Foodtech',
  
  // Other
  'Mobility',
  'Logistics',
  'Real Estate Tech',
  'Proptech',
  'Edtech',
  'Govtech',
] as const

export type IndustrySector = typeof INDUSTRY_SECTORS[number]

// Geographic Focus
export const GEOGRAPHIC_REGIONS = [
  'Global',
  'North America',
  'United States',
  'Silicon Valley',
  'New York',
  'Europe',
  'UK',
  'DACH',          // Germany, Austria, Switzerland
  'France',
  'Nordics',
  'Southern Europe',
  'Spain',
  'Italy',
  'Israel',
  'Asia',
  'Southeast Asia',
  'China',
  'India',
  'LATAM',
  'MENA',          // Middle East & North Africa
] as const

export type GeographicRegion = typeof GEOGRAPHIC_REGIONS[number]

// Check Size Ranges
export const CHECK_SIZE_RANGES = [
  '$100K-$500K',
  '$500K-$2M',
  '$1M-$5M',
  '$5M-$15M',
  '$10M-$25M',
  '$25M-$50M',
  '$50M-$100M',
  '$100M+',
] as const

export type CheckSizeRange = typeof CHECK_SIZE_RANGES[number]

// Filter interface for VC search
export interface VCFilter {
  categories?: VCCategory[]
  stages?: InvestmentStage[]
  industries?: IndustrySector[]
  regions?: GeographicRegion[]
  checkSizes?: CheckSizeRange[]
  searchQuery?: string
}

// Helper to parse pipe-delimited fields (e.g., "Fintech|AI|SaaS")
export function parseMultiValue(value: string | null | undefined): string[] {
  if (!value) return []
  return value.split('|').map(v => v.trim()).filter(Boolean)
}

// Helper to match filter against contact
export function matchesFilter(
  contact: {
    category?: string | null
    industry_focus?: string | null
    stage_focus?: string | null
    geography?: string | null
    check_size?: string | null
  },
  filter: VCFilter
): boolean {
  // Category filter
  if (filter.categories?.length) {
    const contactCategory = contact.category || ''
    if (!filter.categories.some(c => contactCategory.includes(c))) {
      return false
    }
  }
  
  // Industry filter
  if (filter.industries?.length) {
    const industries = parseMultiValue(contact.industry_focus)
    if (!filter.industries.some(i => industries.includes(i))) {
      return false
    }
  }
  
  // Stage filter
  if (filter.stages?.length) {
    const stages = parseMultiValue(contact.stage_focus)
    if (!filter.stages.some(s => stages.includes(s))) {
      return false
    }
  }
  
  // Region filter
  if (filter.regions?.length) {
    const geography = contact.geography || ''
    if (!filter.regions.some(r => geography.includes(r))) {
      return false
    }
  }
  
  return true
}
