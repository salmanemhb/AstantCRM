# VC Outreach CRM

AI-powered investor outreach platform with Tinder-style email approval queue.

## Features

- 🤖 **AI Draft Generation** — Claude-powered personalized emails
- 🔄 **One-Click Rebuttal** — Refine tone, length, pitch level instantly
- 📱 **Tinder Queue** — Swipe to approve/reject drafts
- 🎯 **Campaign Management** — Organize outreach by theme/tone
- 👥 **Contact Database** — Track investor relationships
- 📊 **Confidence Scoring** — Red/Yellow/Green quality indicators
- 🔒 **Safety Rails** — No red-confidence sends, approval required

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Supabase Edge Functions (Deno)
- **Database**: PostgreSQL (Supabase)
- **AI**: Anthropic Claude 3.5 Sonnet
- **Email**: Resend (pluggable)

## Project Structure

```
vc-outreach-crm/
├── src/
│   ├── app/
│   │   ├── page.tsx           # Dashboard
│   │   ├── queue/             # Tinder approval queue
│   │   ├── campaigns/         # Campaign management
│   │   └── contacts/          # Contact database
│   ├── components/
│   │   └── email-card.tsx     # Email review component
│   └── lib/
│       ├── supabase/          # Supabase clients
│       ├── types.ts           # TypeScript types
│       └── utils.ts           # Utility functions
├── supabase/
│   ├── schema.sql             # Database schema v1.2
│   └── functions/
│       ├── generate-draft/    # AI email generation
│       ├── rebuttal/          # One-click refinement
│       └── send-drip/         # Email sending
└── package.json
```

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase account
- Anthropic API key
- Resend API key (optional, for sending)

### Setup

1. **Install dependencies**
   ```bash
   cd vc-outreach-crm
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your keys
   ```

3. **Set up Supabase**
   - Create a new Supabase project
   - Run `supabase/schema.sql` in SQL Editor
   - Deploy edge functions:
     ```bash
     supabase functions deploy generate-draft
     supabase functions deploy rebuttal
     supabase functions deploy send-drip
     ```

4. **Run development server**
   ```bash
   npm run dev
   ```

5. **Open** [http://localhost:3000](http://localhost:3000)

## Edge Functions

### generate-draft

Generates AI email drafts from campaign + contact context.

```bash
POST /functions/v1/generate-draft
{
  "contact_id": "uuid",
  "campaign_id": "uuid",
  "signature": "Best,\nAlex"
}
```

### rebuttal

Refines an existing draft with one-click adjustments.

```bash
POST /functions/v1/rebuttal
{
  "email_id": "uuid",
  "rebuttal_type": "SOFTER_TONE" | "MORE_TECHNICAL" | "SHORTER" | "CLARIFY_VALUE_PROP" | "LESS_PITCHY"
}
```

### send-drip

Sends approved emails via configured provider.

```bash
POST /functions/v1/send-drip
{
  "email_id": "uuid",
  "dry_run": false
}
```

## Safety Constraints

- ❌ Red confidence emails cannot be sent
- ❌ Unapproved emails cannot be sent
- ❌ Already-sent emails cannot be modified
- ✅ Original body preserved for audit trail
- ✅ CTA and signature locked during rebuttal

## License

Private — Astant Global Management
