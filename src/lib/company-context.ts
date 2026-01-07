// ============================================
// ASTANT COMPANY CONTEXT - Auto-loaded
// ============================================

// This is loaded automatically - no need to ask user each time
export const ASTANT_CONTEXT = {
  name: 'Astant Global Management',
  
  // Core description - update this with your actual company info
  description: `Astant Global Management is a next-generation investment and technology firm 
that leverages AI-powered tools to transform how institutional investors and startups connect. 
We're building the infrastructure for smarter capital allocation.`,
  
  // What makes Astant unique
  value_proposition: `We combine deep financial expertise with cutting-edge AI technology 
to streamline investor relations, due diligence, and deal flow management.`,
  
  // Current stage
  stage: 'Seed',
  
  // Key metrics (update as they change)
  traction: '',
  
  // Team highlights
  team: '',
  
  // What you're looking for
  target_investors: 'VCs focused on Fintech, AI/ML, and Enterprise SaaS',
  
  // The ask
  current_raise: '',
}

/**
 * Get the company context as a formatted string for prompts
 */
export function getCompanyContext(): string {
  const parts = [
    `Company: ${ASTANT_CONTEXT.name}`,
    `Description: ${ASTANT_CONTEXT.description}`,
    `Value Proposition: ${ASTANT_CONTEXT.value_proposition}`,
  ]
  
  if (ASTANT_CONTEXT.stage) {
    parts.push(`Stage: ${ASTANT_CONTEXT.stage}`)
  }
  if (ASTANT_CONTEXT.traction) {
    parts.push(`Traction: ${ASTANT_CONTEXT.traction}`)
  }
  if (ASTANT_CONTEXT.team) {
    parts.push(`Team: ${ASTANT_CONTEXT.team}`)
  }
  if (ASTANT_CONTEXT.target_investors) {
    parts.push(`Target Investors: ${ASTANT_CONTEXT.target_investors}`)
  }
  if (ASTANT_CONTEXT.current_raise) {
    parts.push(`Currently Raising: ${ASTANT_CONTEXT.current_raise}`)
  }
  
  return parts.join('\n')
}
