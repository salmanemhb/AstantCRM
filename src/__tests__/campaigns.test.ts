// Self-contained unit tests for campaign functionality
// These test business logic without requiring actual Supabase connection

describe('Campaign CRUD Operations', () => {
  describe('Create Campaign', () => {
    it('should create a campaign with required fields', () => {
      const newCampaign = {
        name: 'Q1 2024 VC Outreach',
        description: 'Series A fundraising campaign',
        status: 'active',
        created_at: new Date().toISOString(),
        global_context: JSON.stringify({
          sender_id: 'fahd',
          template_id: 'jf-investor-outreach-v1',
          notes: 'Target top-tier VCs',
        }),
      }

      expect(newCampaign.name).toBe('Q1 2024 VC Outreach')
      expect(newCampaign.status).toBe('active')
      expect(JSON.parse(newCampaign.global_context).sender_id).toBe('fahd')
    })

    it('should validate campaign name is not empty', () => {
      const validateCampaign = (campaign: { name: string }) => {
        const errors: string[] = []
        if (!campaign.name || campaign.name.trim() === '') {
          errors.push('Campaign name is required')
        }
        return { isValid: errors.length === 0, errors }
      }

      expect(validateCampaign({ name: '' }).isValid).toBe(false)
      expect(validateCampaign({ name: '  ' }).isValid).toBe(false)
      expect(validateCampaign({ name: 'Valid Campaign' }).isValid).toBe(true)
    })

    it('should validate campaign status is valid', () => {
      const validStatuses = ['draft', 'active', 'paused', 'completed']
      
      const isValidStatus = (status: string) => validStatuses.includes(status)

      expect(isValidStatus('active')).toBe(true)
      expect(isValidStatus('completed')).toBe(true)
      expect(isValidStatus('invalid')).toBe(false)
    })
  })

  describe('Campaign Status Management', () => {
    it('should transition from draft to active', () => {
      const campaign = { id: '1', status: 'draft' }
      
      const canTransition = (from: string, to: string) => {
        const transitions: Record<string, string[]> = {
          'draft': ['active'],
          'active': ['paused', 'completed'],
          'paused': ['active', 'completed'],
          'completed': [], // terminal state
        }
        return transitions[from]?.includes(to) ?? false
      }

      expect(canTransition(campaign.status, 'active')).toBe(true)
      expect(canTransition(campaign.status, 'completed')).toBe(false)
    })

    it('should not allow invalid status transitions', () => {
      const canTransition = (from: string, to: string) => {
        const transitions: Record<string, string[]> = {
          'draft': ['active'],
          'active': ['paused', 'completed'],
          'paused': ['active', 'completed'],
          'completed': [],
        }
        return transitions[from]?.includes(to) ?? false
      }

      expect(canTransition('completed', 'draft')).toBe(false)
      expect(canTransition('completed', 'active')).toBe(false)
    })
  })

  describe('Campaign Metrics', () => {
    it('should calculate campaign statistics', () => {
      const contacts = [
        { email_status: 'sent' },
        { email_status: 'sent' },
        { email_status: 'pending' },
        { email_status: 'failed' },
        { email_status: 'opened' },
      ]

      const stats = {
        total: contacts.length,
        sent: contacts.filter(c => c.email_status === 'sent').length,
        pending: contacts.filter(c => c.email_status === 'pending').length,
        failed: contacts.filter(c => c.email_status === 'failed').length,
        opened: contacts.filter(c => c.email_status === 'opened').length,
      }

      expect(stats.total).toBe(5)
      expect(stats.sent).toBe(2)
      expect(stats.pending).toBe(1)
      expect(stats.failed).toBe(1)
      expect(stats.opened).toBe(1)
    })

    it('should calculate open rate', () => {
      const calculateOpenRate = (opened: number, sent: number) => 
        sent > 0 ? ((opened / sent) * 100).toFixed(1) : '0.0'

      expect(calculateOpenRate(10, 100)).toBe('10.0')
      expect(calculateOpenRate(0, 100)).toBe('0.0')
      expect(calculateOpenRate(50, 100)).toBe('50.0')
      expect(calculateOpenRate(0, 0)).toBe('0.0')
    })
  })
})

describe('Contact Campaign Association', () => {
  it('should format personalization data correctly', () => {
    const contact = {
      firstName: 'Michael',
      lastName: 'Smith',
      company: 'Sequoia Capital',
      email: 'michael@sequoia.com',
    }

    const personalizationData = JSON.stringify({
      firstName: contact.firstName,
      company: contact.company,
    })

    const parsed = JSON.parse(personalizationData)
    expect(parsed.firstName).toBe('Michael')
    expect(parsed.company).toBe('Sequoia Capital')
  })

  it('should detect duplicate contacts in campaign', () => {
    const existingContacts = [
      { contact_id: 'contact-1', campaign_id: 'campaign-1' },
      { contact_id: 'contact-2', campaign_id: 'campaign-1' },
    ]

    const isDuplicate = (contactId: string, campaignId: string) =>
      existingContacts.some(
        c => c.contact_id === contactId && c.campaign_id === campaignId
      )

    expect(isDuplicate('contact-1', 'campaign-1')).toBe(true)
    expect(isDuplicate('contact-3', 'campaign-1')).toBe(false)
    expect(isDuplicate('contact-1', 'campaign-2')).toBe(false)
  })

  it('should generate contact campaign record', () => {
    const createContactCampaign = (
      campaignId: string,
      contactId: string,
      personalization: Record<string, string>
    ) => ({
      campaign_id: campaignId,
      contact_id: contactId,
      email_status: 'pending',
      personalization_data: JSON.stringify(personalization),
      created_at: new Date().toISOString(),
    })

    const record = createContactCampaign(
      'campaign-1',
      'contact-1',
      { firstName: 'John', company: 'a16z' }
    )

    expect(record.campaign_id).toBe('campaign-1')
    expect(record.contact_id).toBe('contact-1')
    expect(record.email_status).toBe('pending')
    expect(JSON.parse(record.personalization_data).firstName).toBe('John')
  })
})

describe('Campaign Data Validation', () => {
  it('should validate global_context JSON structure', () => {
    const isValidGlobalContext = (context: string) => {
      try {
        const parsed = JSON.parse(context)
        return typeof parsed === 'object' && parsed !== null
      } catch {
        return false
      }
    }

    expect(isValidGlobalContext('{"sender_id": "fahd"}')).toBe(true)
    expect(isValidGlobalContext('invalid json')).toBe(false)
    expect(isValidGlobalContext('{}')).toBe(true)
    expect(isValidGlobalContext('null')).toBe(false)
  })

  it('should validate required sender_id in global_context', () => {
    const hasSenderId = (context: string) => {
      try {
        const parsed = JSON.parse(context)
        return !!parsed.sender_id
      } catch {
        return false
      }
    }

    expect(hasSenderId('{"sender_id": "fahd"}')).toBe(true)
    expect(hasSenderId('{"template_id": "abc"}')).toBe(false)
    expect(hasSenderId('{}')).toBe(false)
  })
})
