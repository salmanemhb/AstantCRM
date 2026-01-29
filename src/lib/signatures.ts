// ============================================
// TEAM SIGNATURES - ASTANT GLOBAL MANAGEMENT
// ============================================

// Supabase project configuration
// Uses environment variable with fallback for development
export const SUPABASE_PROJECT_ID = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]
  : 'ezqltihevxrloucssqjf'

// Logo hosted on Supabase storage for reliable email delivery
// Run POST /api/upload-logo to upload the logo first
const LOGO_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/storage/v1/object/public/public-assets/astant-logo.jpg`

export interface TeamMember {
  id: string
  name: string
  firstName: string
  title: string
  email: string
  phone?: string
  replyTo?: string // Optional: if set, replies go to this email instead of the sender email
}

export const TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'jean-francois',
    name: 'Jean-François Manigo Gilardoni',
    firstName: 'Jean-François',
    title: 'Global Partnerships & Expansion Lead',
    email: 'jean.francois@astantglobal.com',
  },
  {
    id: 'fahd',
    name: 'Fahd El Ghorfi',
    firstName: 'Fahd',
    title: 'Chief Operating Officer & Co-Founder',
    email: 'fahd.el.ghorfi@astantglobal.com',
  },
  {
    id: 'marcos',
    name: 'Marcos Agustín Plata',
    firstName: 'Marcos',
    title: 'Chief Executive Officer & Co-Founder',
    email: 'marcos.agustin@astantglobal.com',
  },
]

export const COMPANY_INFO = {
  name: 'Astant Global Management',
  address: 'Paseo de la Castellana, 268',
  city: 'Madrid, 28046',
  country: 'Spain',
  website: 'www.astantglobal.com',
  logoUrl: '/astant-logo.jpg',
  // For email HTML - using Supabase hosted URL for reliable delivery
  logoUrlAbsolute: LOGO_URL,
  // LinkedIn-style blue color for branding
  brandColor: '#0066cc',
}

export function getSignatureText(memberId: string): string {
  const member = TEAM_MEMBERS.find(m => m.id === memberId)
  if (!member) return ''
  
  return `${member.name}
${member.title}
${COMPANY_INFO.name}
${COMPANY_INFO.address}
${COMPANY_INFO.city}
${COMPANY_INFO.country}
${member.email}
${COMPANY_INFO.website}`
}

export function getSignatureHtml(memberId: string, useAbsoluteUrl = true): string {
  const member = TEAM_MEMBERS.find(m => m.id === memberId)
  if (!member) return ''
  
  const logoUrl = useAbsoluteUrl ? COMPANY_INFO.logoUrlAbsolute : COMPANY_INFO.logoUrl
  const brandColor = COMPANY_INFO.brandColor || '#0066cc'
  
  // Professional HTML signature optimized for ALL email clients including Outlook
  // Outlook uses Word's rendering engine which requires:
  // - Explicit width AND height on images (no "auto")
  // - No max-width CSS (use width attribute instead)
  // - Tables for layout (no divs)
  return `
<!--[if mso]>
<table cellpadding="0" cellspacing="0" border="0" width="400">
<tr><td>
<![endif]-->
<table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #333333; border-collapse: collapse;" width="400">
  <tr>
    <td valign="top" width="85" style="padding-right: 15px; border-right: 3px solid ${brandColor};">
      <a href="https://${COMPANY_INFO.website}" target="_blank" style="text-decoration: none;">
        <img src="${logoUrl}" alt="Astant" width="70" height="70" style="display: block; border: 0; width: 70px; height: 70px;" />
      </a>
    </td>
    <td valign="top" style="padding-left: 15px;">
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding-bottom: 3px;">
            <span style="font-size: 16px; font-weight: bold; color: #1a1a1a;">${member.name}</span>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom: 10px;">
            <span style="font-size: 13px; color: #666666;">${member.title}</span>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom: 2px;">
            <span style="font-size: 13px; font-weight: 600; color: #333333;">${COMPANY_INFO.name}</span>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom: 2px;">
            <span style="font-size: 12px; color: #666666;">${COMPANY_INFO.address}</span>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom: 8px;">
            <span style="font-size: 12px; color: #666666;">${COMPANY_INFO.city}, ${COMPANY_INFO.country}</span>
          </td>
        </tr>
        <tr>
          <td>
            <a href="mailto:${member.email}" style="color: ${brandColor}; text-decoration: none; font-size: 12px;">${member.email}</a>
            <span style="color: #cccccc; margin: 0 6px;">|</span>
            <a href="https://${COMPANY_INFO.website}" style="color: ${brandColor}; text-decoration: none; font-size: 12px;">${COMPANY_INFO.website}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
<!--[if mso]>
</td></tr>
</table>
<![endif]-->`.trim()
}

export function getMemberById(id: string): TeamMember | undefined {
  return TEAM_MEMBERS.find(m => m.id === id)
}
