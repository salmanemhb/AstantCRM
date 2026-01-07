// ============================================
// TEAM SIGNATURES - ASTANT GLOBAL MANAGEMENT
// ============================================

export interface TeamMember {
  id: string
  name: string
  firstName: string
  title: string
  email: string
  phone?: string
}

export const TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'jean-francois',
    name: 'Jean-François Manigo Gilardoni',
    firstName: 'Jean-François',
    title: 'Investor Relations Associate',
    email: 'jean.francois@astantglobal.com',
  },
  {
    id: 'fahd',
    name: 'Fahd El Ghorfi',
    firstName: 'Fahd',
    title: 'Chief Investment Officer & Co-Founder',
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
  address: 'Paseo de la Castellana, 280',
  city: 'Madrid, 28046',
  country: 'Spain',
  website: 'www.astantglobal.com',
  logoUrl: '/astant-logo.jpg',
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

export function getSignatureHtml(memberId: string): string {
  const member = TEAM_MEMBERS.find(m => m.id === memberId)
  if (!member) return ''
  
  return `
<table cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
  <tr>
    <td style="padding-right: 15px; border-right: 2px solid #0066cc;">
      <img src="${COMPANY_INFO.logoUrl}" alt="Astant Global Management" style="width: 80px; height: auto;" />
    </td>
    <td style="padding-left: 15px;">
      <p style="margin: 0; font-weight: bold; font-size: 15px; color: #1a1a1a;">${member.name}</p>
      <p style="margin: 4px 0 8px 0; font-size: 13px; color: #666;">${member.title}</p>
      <p style="margin: 0; font-size: 13px; color: #333; font-weight: 600;">${COMPANY_INFO.name}</p>
      <p style="margin: 2px 0; font-size: 12px; color: #666;">${COMPANY_INFO.address}</p>
      <p style="margin: 2px 0; font-size: 12px; color: #666;">${COMPANY_INFO.city}, ${COMPANY_INFO.country}</p>
      <p style="margin: 8px 0 0 0;">
        <a href="mailto:${member.email}" style="color: #0066cc; text-decoration: none; font-size: 12px;">${member.email}</a>
        <span style="color: #ccc; margin: 0 8px;">|</span>
        <a href="https://${COMPANY_INFO.website}" style="color: #0066cc; text-decoration: none; font-size: 12px;">${COMPANY_INFO.website}</a>
      </p>
    </td>
  </tr>
</table>
  `.trim()
}

export function getMemberById(id: string): TeamMember | undefined {
  return TEAM_MEMBERS.find(m => m.id === id)
}
