# Astant CRM - Complete Technical Documentation

> **Version:** 3.0  
> **Last Updated:** January 8, 2026  
> **Status:** Production Ready

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Email Generation System](#email-generation-system)
4. [Database Schema](#database-schema)
5. [API Reference](#api-reference)
6. [Frontend Components](#frontend-components)
7. [Configuration](#configuration)
8. [Deployment](#deployment)

---

## System Overview

Astant CRM is a VC outreach management system built for Astant Global Management. It enables personalized email campaigns to VCs, media, clients, and industry experts.

### Core Capabilities

| Feature | Description |
|---------|-------------|
| **Contact Management** | Import, organize, and track 2000+ contacts |
| **AI Email Generation** | Template-based emails matching Jean-François's writing style |
| **Campaign Management** | Organize contacts into targeted campaigns |
| **Bulk Operations** | Mass email generation with quality control |
| **Gmail Integration** | Compose and send via Gmail |

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14.1, React 18, TypeScript, TailwindCSS |
| Backend | Next.js API Routes, Server Actions |
| Database | Supabase (PostgreSQL) |
| AI | OpenAI GPT-4o |
| Rich Text | TipTap Editor |
| Spreadsheet | PapaParse, XLSX |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                     │
├─────────────────────────────────────────────────────────────────────┤
│  /                      │  /contacts           │  /campaigns         │
│  Dashboard              │  Contact List        │  Campaign Manager   │
│  Stats & Overview       │  Import/Export       │  Email Generation   │
│                         │  Search/Filter       │  Bulk Operations    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         API ROUTES                                   │
├──────────────────┬──────────────────┬──────────────────────────────┤
│ /api/generate-   │ /api/batch-      │ /api/send-email              │
│ claude           │ generate         │                               │
│ (Single Email)   │ (Bulk Emails)    │ (Gmail Integration)          │
├──────────────────┴──────────────────┴──────────────────────────────┤
│ /api/generate-agrade  │  /api/agents  │  /api/bulk-operations       │
│ (A-Grade System)      │  (Templates)  │  (Mass Updates)             │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         CORE LIBRARIES                               │
├─────────────────────────────────────────────────────────────────────┤
│  src/lib/                                                            │
│  ├── email-generator-v3.ts    ← PRIMARY: Template-based generation  │
│  ├── email-templates-v3.ts    ← 8 fill-in-blank templates          │
│  ├── knowledge-base.ts        ← Gold standards + banned phrases    │
│  ├── email-engine.ts          ← Batch generation engine            │
│  ├── email-templates.ts       ← Legacy templates (batch use)       │
│  ├── astant-knowledge-base.ts ← Company knowledge                  │
│  ├── signatures.ts            ← Team member signatures             │
│  └── agents/openai-client.ts  ← GPT-4o integration                 │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SUPABASE                                     │
├─────────────────────────────────────────────────────────────────────┤
│  Tables: contacts, campaigns, contact_campaigns, emails             │
│  Storage: attachments                                                │
│  Auth: (future)                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Email Generation System

### Overview

The system uses a **template-based approach** where AI only fills variable values, NOT the email structure. This ensures consistent quality matching Jean-François's actual writing style.

### How It Works

```
1. User requests email for Contact + Campaign
                    ↓
2. System selects appropriate template based on category
                    ↓
3. AI fills ONLY the variable values (short phrases)
                    ↓
4. Variables are substituted into template
                    ↓
5. Output: Email with exact structure, personalized details
```

### Template Categories

| Category | Template ID | Use Case |
|----------|-------------|----------|
| VC Outreach | `vc_cold_intro` | Cold outreach to investors |
| Warm Intro | `warm_intro_followup` | Mutual connection introduction |
| Media | `media_pitch` | Journalist/press outreach |
| Client | `client_intro` | Potential client outreach |
| Follow-up | `followup_first` | First follow-up (1-2 weeks) |
| Follow-up | `followup_final` | Final follow-up (3-4 weeks) |
| Expert | `expert_outreach` | Industry expert outreach |
| Event | `post_event` | Post-conference follow-up |

### Variable System

Templates use `{variable_name}` syntax. AI generates only the values:

| Variable | Format | Example |
|----------|--------|---------|
| `first_name` | First name only | "Sarah" |
| `company_name` | Company/firm | "Blackstone" |
| `their_focus_area` | 2-4 words | "European hospitality" |
| `specific_thing_that_caught_attention` | 8-12 words | "your Series B in renewable storage" |
| `topic_for_their_expertise` | 5-8 words | "the hospitality sector outlook" |
| `connector_name` | Name | "Michael" |

### Quality Control

1. **Banned Phrases**: 100+ phrases that trigger warnings
2. **Variable Validation**: Detects unfilled `{placeholders}`
3. **Confidence Score**: 0-100 based on quality signals

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/email-templates-v3.ts` | 8 fill-in-blank templates |
| `src/lib/email-generator-v3.ts` | Template filling engine |
| `src/lib/knowledge-base.ts` | Banned phrases, style guide |
| `src/lib/email-engine.ts` | Batch generation (legacy) |

---

## Database Schema

### Tables

```sql
-- Contacts table
contacts (
  id UUID PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  email TEXT UNIQUE,
  firm TEXT,
  role TEXT,
  geography TEXT,
  investment_focus TEXT,
  fund_size TEXT,
  linkedin_url TEXT,
  notes TEXT,
  previous_meetings TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Campaigns table
campaigns (
  id UUID PRIMARY KEY,
  name TEXT,
  description TEXT,
  status TEXT DEFAULT 'draft',
  prompt TEXT,
  cta TEXT,
  sender_id TEXT,
  prompt_preset_id TEXT,
  attachment_ids TEXT[],
  created_at TIMESTAMP
)

-- Junction table
contact_campaigns (
  id UUID PRIMARY KEY,
  contact_id UUID REFERENCES contacts,
  campaign_id UUID REFERENCES campaigns,
  status TEXT DEFAULT 'pending',
  confidence_score INTEGER,
  sender_id TEXT,
  created_at TIMESTAMP
)

-- Generated emails
emails (
  id UUID PRIMARY KEY,
  contact_campaign_id UUID REFERENCES contact_campaigns,
  subject TEXT,
  original_body JSONB,
  current_body JSONB,
  confidence_score INTEGER,
  approved BOOLEAN DEFAULT false,
  sent_at TIMESTAMP,
  created_at TIMESTAMP
)
```

### Email Body Structure

```json
{
  "body": "Good morning Sarah...",
  "signature": "Jean-François Manigo Gilardoni\n..."
}
```

---

## API Reference

### POST /api/generate-claude

Generate a single email using template-based system.

**Request:**
```json
{
  "contact_id": "uuid" | "preview",
  "campaign_id": "uuid" | "preview",
  "config": {
    "email_type": "vc" | "media" | "client" | "follow-up" | "expert" | "warm-intro",
    "template_id": "vc_cold_intro",
    "custom_context": "Additional context about contact",
    "connector_name": "Michael",
    "specific_ask": "Discuss partnership opportunities"
  }
}
```

**Response:**
```json
{
  "email_id": "uuid",
  "subject": "Blackstone × Astant",
  "body": "Good morning Sarah...",
  "preview": { "body": "...", "signature": "..." },
  "confidence": 90,
  "template_used": "vc_cold_intro",
  "variables_filled": {
    "first_name": "Sarah",
    "company_name": "Blackstone",
    "their_focus_area": "European hospitality"
  },
  "validation": { "passed": true, "issues": [] },
  "engine": "template-v3"
}
```

### POST /api/batch-generate

Generate emails for multiple contacts.

**Request:**
```json
{
  "campaign_id": "uuid",
  "contact_ids": ["uuid1", "uuid2"],
  "config": {
    "category": "vc_cold",
    "sender_id": "jean-francois"
  }
}
```

### POST /api/generate-agrade

A-Grade email generation with deep storytelling.

### POST /api/send-email

Send email via Gmail.

**Request:**
```json
{
  "to": "recipient@example.com",
  "subject": "Subject line",
  "body": "Email body HTML",
  "attachments": []
}
```

---

## Frontend Components

### Pages

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | `page.tsx` | Dashboard with stats |
| `/contacts` | `contacts/page.tsx` | Contact management |
| `/campaigns` | `campaigns/page.tsx` | Campaign management |

### Key Components

| Component | Purpose |
|-----------|---------|
| `email-card.tsx` | Display generated email |
| `email-editor-modal.tsx` | Edit email content |
| `rich-text-editor.tsx` | TipTap-based editor |
| `gmail-email-composer.tsx` | Gmail send integration |
| `import-contacts-modal.tsx` | CSV/Excel import |
| `bulk-operations-panel.tsx` | Mass operations |
| `template-selector.tsx` | Template picker |
| `signature-selector.tsx` | Sender selection |

---

## Configuration

### Environment Variables

```env
# .env.local

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# OpenAI (required for email generation)
OPENAI_API_KEY=sk-xxx

# Optional: Anthropic (not currently used)
ANTHROPIC_API_KEY=xxx
```

### Sender Configuration

Defined in `src/lib/signatures.ts`:

| Sender ID | Name | Role |
|-----------|------|------|
| `jean-francois` | Jean-François Manigo Gilardoni | Global Partnerships Lead |
| `fahd` | Fahd El Ghorfi | Founder & CEO |
| `marcos` | Marcos Agustín Plata | CEO & Co-Founder |
| `salman` | Salman El Mehbaoui | Chief Operating Officer |

---

## Deployment

### Local Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.local.example .env.local
# Edit .env.local with your keys

# Run development server
npm run dev

# Access at http://localhost:3000
```

### Production Build

```bash
npm run build
npm start
```

### Netlify Deployment

Configured via `netlify.toml`:
- Build command: `npm run build`
- Publish directory: `.next`

---

## File Structure

```
vc-outreach-crm/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── generate-claude/     # Main email generation
│   │   │   ├── batch-generate/      # Bulk generation
│   │   │   ├── generate-agrade/     # A-Grade system
│   │   │   ├── agents/              # Template generation
│   │   │   ├── send-email/          # Gmail integration
│   │   │   ├── bulk-operations/     # Mass updates
│   │   │   └── upload-attachment/   # File uploads
│   │   ├── campaigns/               # Campaign page
│   │   ├── contacts/                # Contacts page
│   │   ├── layout.tsx
│   │   └── page.tsx                 # Dashboard
│   ├── components/                  # React components
│   └── lib/
│       ├── agents/
│       │   └── openai-client.ts     # GPT-4o client
│       ├── supabase/
│       │   ├── client.ts            # Browser client
│       │   └── server.ts            # Server client
│       ├── email-generator-v3.ts    # ★ Template engine
│       ├── email-templates-v3.ts    # ★ 8 templates
│       ├── knowledge-base.ts        # Banned phrases
│       ├── email-engine.ts          # Batch engine
│       ├── email-templates.ts       # Legacy templates
│       ├── astant-knowledge-base.ts # Company info
│       ├── signatures.ts            # Team signatures
│       ├── prompt-presets.ts        # Campaign presets
│       └── ...
├── docs/
│   ├── ASTANT_CRM_MASTER.md         # This file
│   ├── EMAIL_SYSTEM_V3.md           # Email system details
│   └── PIPELINE.md                  # Development pipeline
├── supabase/                        # Database migrations
├── public/                          # Static assets
├── .env.local                       # Environment config
├── package.json
└── next.config.js
```

---

## Maintenance Guide

### Adding a New Email Template

1. Open `src/lib/email-templates-v3.ts`
2. Add to `TEMPLATES` object:
```typescript
new_template_id: {
  id: 'new_template_id',
  name: 'Template Name',
  category: 'vc' | 'media' | 'client' | 'follow-up' | 'expert' | 'warm-intro',
  subject_template: '{company_name} × Astant',
  body_template: `Good morning {first_name},

Your template text with {variables}...

Best,
Jean-François`,
  variables: ['first_name', 'company_name', 'custom_variable'],
  example_filled: 'Example of filled template...',
  notes: 'When to use this template'
}
```

3. Add variable descriptions in `src/lib/email-generator-v3.ts`:
```typescript
const VARIABLE_DESCRIPTIONS = {
  // ...existing
  custom_variable: 'Description (X-Y words)'
}
```

### Adding Banned Phrases

Edit `src/lib/knowledge-base.ts`:
```typescript
export const BANNED_PHRASES = [
  // ...existing phrases
  'new banned phrase',
]
```

### Updating Senders

Edit `src/lib/signatures.ts` to add/modify team members.

---

## Known Issues & Future Improvements

### Current Limitations

1. **Legacy Templates**: `email-templates.ts` and `email-engine.ts` still used by batch-generate
2. **No Auth**: No user authentication system yet
3. **Gmail Manual**: Requires manual Gmail window opening

### Roadmap

- [ ] Migrate batch-generate to v3 templates
- [ ] Add user authentication
- [ ] Implement direct Gmail API integration
- [ ] Add email open/click tracking
- [ ] Build analytics dashboard

---

## Support

- **GitHub**: https://github.com/salmanemhb/AstantCRM
- **Team**: Astant Global Management Engineering

---

*Documentation generated January 8, 2026*
