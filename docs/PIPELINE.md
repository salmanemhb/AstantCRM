# VC Outreach CRM - Pipeline Architecture

**Updated:** January 6, 2026  
**Client:** Astant Global Management

---

## 🔄 The Pipeline (Current Implementation)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ASTANT VC OUTREACH CRM                            │
│                              Pipeline Flow                                   │
└─────────────────────────────────────────────────────────────────────────────┘

     ┌──────────────┐
     │   STEP 1     │
     │   IMPORT     │─────────────────────────────────────────────────────┐
     │   CONTACTS   │                                                     │
     └──────────────┘                                                     │
           │                                                              │
           ▼                                                              │
     ┌─────────────────────────────────────────────────────────────┐     │
     │  📁 Spreadsheet Parser (Dynamic Columns)                    │     │
     │  ─────────────────────────────────────────────────────────  │     │
     │  • Supports CSV, XLSX, XLS                                  │     │
     │  • Auto-detects column mappings                             │     │
     │  • Preserves ALL original data in raw_data field            │     │
     │  • Maps to: first_name, last_name, email, firm, role, etc.  │     │
     │  • Stores original_headers for dynamic display              │     │
     └─────────────────────────────────────────────────────────────┘     │
           │                                                              │
           ▼                                                              │
     ┌──────────────┐                                                     │
     │   STEP 2     │                                                     │
     │   CREATE     │◄────────────────────────────────────────────────────┘
     │   CAMPAIGN   │
     └──────────────┘
           │
           ▼
     ┌─────────────────────────────────────────────────────────────┐
     │  🎯 Campaign Configuration                                  │
     │  ─────────────────────────────────────────────────────────  │
     │  • Name, Prompt/Description                                 │
     │  • Tone: direct | warm | technical | visionary              │
     │  • Template Subject & Body (optional)                       │
     │  • CTA (Call to Action)                                     │
     │  • Fallback Strategy                                        │
     └─────────────────────────────────────────────────────────────┘
           │
           ▼
     ┌──────────────┐
     │   STEP 3     │
     │   ADD VCs    │
     │   TO CAMPAIGN│
     └──────────────┘
           │
           ▼
     ┌─────────────────────────────────────────────────────────────┐
     │  🤖 AI Draft Generation (GPT-4o)                            │
     │  ─────────────────────────────────────────────────────────  │
     │  • Fetches contact + campaign from Supabase                 │
     │  • Loads company context (Astant Global Management)         │
     │  • Generates: subject, greeting, context_p1, value_p2, cta  │
     │  • Assigns confidence score: green | yellow | red           │
     │  • Saves to emails table                                    │
     └─────────────────────────────────────────────────────────────┘
           │
           ▼
     ┌──────────────┐
     │   STEP 4     │
     │   REVIEW &   │
     │   EDIT       │
     └──────────────┘
           │
           ▼
     ┌─────────────────────────────────────────────────────────────┐
     │  ✏️ Rich Text Email Editor                                  │
     │  ─────────────────────────────────────────────────────────  │
     │  • Full editing: subject, greeting, body, signature         │
     │  • Rich formatting: Bold, Italic, Underline, Links          │
     │  • Bullet/numbered lists                                    │
     │  • Signature templates (Formal, Casual, Short)              │
     │  • File attachments (images, documents)                     │
     │  • Undo/Redo history                                        │
     └─────────────────────────────────────────────────────────────┘
           │
           ▼
     ┌──────────────┐
     │   STEP 5     │
     │   VERIFY &   │
     │   SEND       │
     └──────────────┘
           │
           ▼
     ┌─────────────────────────────────────────────────────────────┐
     │  ✅ Individual Email Verification                           │
     │  ─────────────────────────────────────────────────────────  │
     │  • Approve individual emails                                │
     │  • Or Edit & Send directly                                  │
     │  • Confidence indicator visible                             │
     │  • Email marked as sent in database                         │
     │  • (TODO: Resend API integration)                           │
     └─────────────────────────────────────────────────────────────┘
```

---

## 📁 Current File Structure

```
vc-outreach-crm/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Dashboard home page
│   │   ├── layout.tsx                  # Root layout
│   │   ├── globals.css                 # Tailwind styles
│   │   ├── campaigns/
│   │   │   ├── page.tsx                # Campaign list
│   │   │   └── [id]/
│   │   │       └── page.tsx            # Campaign detail + email editor
│   │   ├── contacts/
│   │   │   └── page.tsx                # Contact lists + import
│   │   └── api/
│   │       └── generate-draft/
│   │           └── route.ts            # AI email generation endpoint
│   │
│   ├── components/
│   │   ├── rich-text-editor.tsx        # TipTap WYSIWYG editor
│   │   ├── email-editor-modal.tsx      # Full email editing modal
│   │   ├── email-card.tsx              # Email display component
│   │   └── import-contacts-modal.tsx   # Spreadsheet import wizard
│   │
│   └── lib/
│       ├── api.ts                      # Supabase API functions
│       ├── types.ts                    # TypeScript interfaces
│       ├── utils.ts                    # Helper functions
│       ├── company-context.ts          # Astant company info for AI
│       ├── spreadsheet-parser.ts       # CSV/Excel parser
│       ├── supabase/
│       │   ├── client.ts               # Browser Supabase client
│       │   └── server.ts               # Server Supabase client
│       └── agents/
│           └── openai-client.ts        # GPT-4o integration
│
├── supabase/
│   ├── schema.sql                      # Database schema
│   └── migrations/                     # Database migrations
│
└── docs/
    └── PIPELINE.md                     # This file
```

---

## 🗄️ Database Schema (Key Tables)

### contacts
```sql
- id: uuid
- contact_list_id: uuid (nullable, links to import)
- first_name, last_name, email: text
- firm, role, geography, investment_focus: text (nullable)
- raw_data: jsonb           -- ALL original spreadsheet columns
- created_at: timestamp
```

### contact_lists
```sql
- id: uuid
- name: text
- file_name, file_type: text
- column_mapping: jsonb     -- Maps original columns to our fields
- original_headers: text[]  -- Original column names
- row_count: int
```

### campaigns
```sql
- id: uuid
- name, prompt: text
- tone: enum (direct, warm, technical, visionary)
- template_subject, template_body: text (nullable)
- cta, fallback_strategy: text (nullable)
```

### emails
```sql
- id: uuid
- contact_campaign_id: uuid
- subject: text
- original_body: jsonb      -- AI-generated version
- current_body: jsonb       -- User-edited version
- confidence_score: enum (green, yellow, red)
- approved: boolean
- sent_at: timestamp (nullable)
```

---

## ✅ What's Working Now

1. **Dynamic Spreadsheet Import** ✓
   - Any CSV/Excel format accepted
   - Auto-detects columns, preserves all data
   
2. **Campaign Management** ✓
   - Create, view, delete campaigns
   - Add/remove contacts from campaigns

3. **AI Email Generation** ✓
   - GPT-4o generates personalized drafts
   - Uses company context + contact data
   - Confidence scoring

4. **Rich Text Email Editor** ✓
   - Bold, italic, underline, links
   - Lists (bullet/numbered)
   - Signature templates
   - File attachments (UI ready)
   - Save draft / Edit & Send

5. **Individual Verification** ✓
   - Approve emails individually
   - Edit before sending
   - View confidence score

---

## 🚧 TODO (Next Steps)

1. **Resend API Integration**
   - Connect to Resend for actual email delivery
   - Handle attachments in API call
   - Track delivery status

2. **Dynamic Contact Data Display**
   - Show ALL raw_data fields per contact
   - Expandable contact cards

3. **Email Templates Library**
   - Save/load custom templates
   - Template categories

4. **Tracking & Analytics**
   - Open/click tracking (via Resend)
   - Response tracking
   - Dashboard analytics

---

*Built for Astant Global Management*
