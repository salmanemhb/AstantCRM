import {
  personalizeEmail,
  JEAN_FRANCOIS_INVESTOR_OUTREACH,
  JEAN_FRANCOIS_VC_COLD,
  JEAN_FRANCOIS_FOLLOW_UP,
} from '@/lib/email-knowledge-base'

describe('Email Knowledge Base', () => {
  describe('personalizeEmail', () => {
    it('should replace recipient placeholders with contact info', () => {
      const contact = {
        firstName: 'Michael',
        company: 'Sequoia Capital',
      }

      const result = personalizeEmail(JEAN_FRANCOIS_INVESTOR_OUTREACH, contact)

      expect(result.body).toContain('Michael')
      expect(result.body).toContain('Sequoia Capital')
      expect(result.body).not.toContain('[RECIPIENT_NAME]')
      expect(result.body).not.toContain('[RECIPIENT_COMPANY]')
    })

    it('should replace sender placeholders when sender is provided', () => {
      const contact = {
        firstName: 'John',
        company: 'Andreessen Horowitz',
      }

      const sender = {
        id: 'fahd',
        name: 'Fahd El Ghorfi',
        firstName: 'Fahd',
        title: 'Founder & CEO',
        email: 'fahd@astantglobal.com',
      }

      const result = personalizeEmail(JEAN_FRANCOIS_INVESTOR_OUTREACH, contact, sender)

      expect(result.body).toContain('Fahd')
      expect(result.body).toContain('Founder & CEO')
      expect(result.body).not.toContain('[SENDER_NAME]')
      expect(result.body).not.toContain('[SENDER_FIRST_NAME]')
    })

    it('should track all replacements made', () => {
      const contact = {
        firstName: 'Sarah',
        company: 'Benchmark',
      }

      const result = personalizeEmail(JEAN_FRANCOIS_INVESTOR_OUTREACH, contact)

      expect(result.replacements.length).toBeGreaterThan(0)
      expect(result.replacements.some(r => r.placeholder === 'RECIPIENT_NAME')).toBe(true)
      expect(result.replacements.some(r => r.placeholder === 'RECIPIENT_COMPANY')).toBe(true)
    })

    it('should use default values when contact info is missing', () => {
      const contact = {
        firstName: 'Alex',
        company: 'TestVC',
      }

      const result = personalizeEmail(JEAN_FRANCOIS_INVESTOR_OUTREACH, contact)

      // Should still have the subject and body
      expect(result.subject).toBeTruthy()
      expect(result.body).toBeTruthy()
      expect(result.body).toContain('Alex')
    })
  })

  describe('Templates', () => {
    it('JEAN_FRANCOIS_INVESTOR_OUTREACH should have required placeholders', () => {
      expect(JEAN_FRANCOIS_INVESTOR_OUTREACH.placeholders).toBeDefined()
      expect(JEAN_FRANCOIS_INVESTOR_OUTREACH.placeholders.length).toBeGreaterThan(0)
      
      const fields = JEAN_FRANCOIS_INVESTOR_OUTREACH.placeholders.map(p => p.field)
      expect(fields).toContain('RECIPIENT_NAME')
      expect(fields).toContain('RECIPIENT_COMPANY')
    })

    it('JEAN_FRANCOIS_VC_COLD should be a valid template', () => {
      expect(JEAN_FRANCOIS_VC_COLD.id).toBe('jf-vc-cold-v1')
      expect(JEAN_FRANCOIS_VC_COLD.subject).toBeTruthy()
      expect(JEAN_FRANCOIS_VC_COLD.body).toBeTruthy()
    })

    it('JEAN_FRANCOIS_FOLLOW_UP should be a valid template', () => {
      expect(JEAN_FRANCOIS_FOLLOW_UP.id).toBe('jf-follow-up-v1')
      expect(JEAN_FRANCOIS_FOLLOW_UP.category).toBe('follow-up')
    })

    it('all templates should have sender placeholders', () => {
      const templates = [
        JEAN_FRANCOIS_INVESTOR_OUTREACH,
        JEAN_FRANCOIS_VC_COLD,
        JEAN_FRANCOIS_FOLLOW_UP,
      ]

      templates.forEach(template => {
        expect(template.body).toContain('[SENDER_')
      })
    })
  })
})
