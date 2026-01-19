# Astant CRM - Email Generation Architecture

## 🎯 System Overview

This CRM uses a **multi-agent AI system** to generate human-quality emails that match Jean-François's proven writing style. The system is designed to pass AI detection and feel authentically human.

---

## 📁 File Structure (After v2 Improvements)

```
src/lib/
├── knowledge-base.ts       # 🆕 Unified training data (8 emails, 100+ banned phrases)
├── email-agents-v2.ts      # 🆕 Multi-agent system using knowledge base
├── signatures.ts           # Team signatures
├── prompt-presets.ts       # Campaign presets (VC, media, client)
├── email-engine.ts         # Legacy (kept for compatibility)
├── email-agents.ts         # Legacy v1 agents
├── gold-standard-emails.ts # Legacy (now in knowledge-base.ts)
└── astant-knowledge-base.ts # Legacy knowledge base

src/app/api/
├── generate-claude/route.ts # 🆕 v2 API endpoint (multi-agent)
├── generate-draft/route.ts  # GPT-4 fallback
├── generate-agrade/route.ts # A-grade generator
└── batch-generate/route.ts  # Batch processing

claude-wizards/knowledge-base/
├── README.md               # Overview
├── master-prompt.md        # System prompt
├── style-guide.md          # Writing style rules
├── banned-phrases.md       # 100+ phrases to avoid
├── astant-context.md       # Company information
├── gold-standard-emails/   # 8 analyzed emails
├── style-variations/       # VC, media, client variations
├── anti-patterns/          # What NOT to do
└── templates/              # Fill-in-blank templates
```

---

## 🔄 Email Generation Flow

```
User creates campaign
        ↓
POST /api/generate-claude
        ↓
┌─────────────────────────────────┐
│   EMAIL-AGENTS-V2.ts            │
├─────────────────────────────────┤
│ Agent 1: STYLE ANALYZER         │
│ → Picks best reference email    │
│ → Extracts style patterns       │
├─────────────────────────────────┤
│ Agent 2: CONTEXT BUILDER        │
│ → Researches recipient          │
│ → Builds personalization data   │
├─────────────────────────────────┤
│ Agent 3: DRAFT WRITER           │
│ → Writes email matching style   │
│ → Uses master system prompt     │
├─────────────────────────────────┤
│ Agent 4: AI DETECTOR FIXER      │
│ → Checks for AI patterns        │
│ → Removes banned phrases        │
│ → Rewrites flagged sections     │
├─────────────────────────────────┤
│ Agent 5: QUALITY SCORER         │
│ → Rates email 0-100             │
│ → Checks style match            │
│ → Returns validation            │
└─────────────────────────────────┘
        ↓
    Email saved to DB
        ↓
   Shown in campaigns UI
```

---

## 📊 Knowledge Base Contents

### Gold Standard Emails (8 total)
1. **VC Intro 1** - Andreessen Horowitz intro
2. **VC Intro 2** - Sequoia intro
3. **Follow-up 1** - Light follow-up
4. **Follow-up 2** - Meeting follow-up
5. **Media Pitch** - Forbes journalist pitch
6. **Expert Intro** - Industry expert outreach
7. **Warm Intro** - Common connection intro
8. **LP Intro** - Limited partner outreach

### Banned Phrases (100+)
Organized by category:
- **Greetings**: "I hope this email finds you well", "I wanted to reach out"
- **Transition words**: "Furthermore", "Additionally", "Moreover"
- **Corporate-speak**: "Synergy", "Leverage", "Scalable"
- **AI patterns**: "I'd love to", "Excited to share", "Game-changing"
- **Closings**: "Looking forward to hearing from you", "Best regards"

### Style Guide Rules
- **Tone**: Professional but warm, European sophistication
- **Length**: 80-120 words max
- **Structure**: Quick hook → Value → Soft ask
- **Signature**: First name only

---

## 🛠️ API Endpoints

### POST /api/generate-claude (Primary)
```typescript
{
  contact_id: string,       // or "preview"
  campaign_id: string,      // or "preview"
  config: {
    sender_id?: string,     // "jean-francois" | "fahd" | "marcos" | "salman"
    email_type?: string,    // "vc" | "media" | "client" | "follow-up"
    reference_email?: string,
    specific_ask?: string,
    formality?: string
  },
  quick?: boolean           // Skip full agent chain
}
```

**Response:**
```typescript
{
  email_id: string,
  subject: string,
  body: string,
  confidence: number,       // 0-100
  quality_score: {
    score: number,
    styleMatch: string,
    humanlike: string,
    feedback: string
  },
  agent_logs: string[],     // Agent process logs
  validation: {
    passed: boolean,
    issues: string[]
  }
}
```

---

## 🔐 Environment Variables

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=          # For Claude multi-agent

# Optional
OPENAI_API_KEY=             # For GPT-4 fallback
```

---

## ✅ Quality Checks

The system validates every email:

1. **Banned phrase detection** - Scans for 100+ AI patterns
2. **Length validation** - Must be 50-200 words
3. **Style match scoring** - Compares to Jean-François patterns
4. **Human-like rating** - Checks for natural flow
5. **Overall confidence** - Combined 0-100 score

---

## 📈 Improvements Made (v2)

| Before | After |
|--------|-------|
| Knowledge base in markdown only | TypeScript integration |
| Separate email-agents.ts | Unified email-agents-v2.ts |
| No validation | Full quality scoring |
| Hardcoded prompts | Dynamic from knowledge base |
| Single-pass generation | Multi-agent with retry loop |
| No banned phrase checking | 100+ phrases with alternatives |

---

## 🚀 Usage in Campaigns

1. Create new campaign
2. Enable "Claude Multi-Agent System" toggle
3. Write your prompt/CTA
4. Click "Generate Template"
5. View agent logs in real-time
6. Review quality score
7. Approve or regenerate

---

## 📞 Team Members

| ID | Name | Role |
|----|------|------|
| jean-francois | Jean-François Manigo Gilardoni | Investor Relations Associate |
| fahd | Fahd El Ghorfi | Chief Investment Officer & Co-Founder |
| marcos | Marcos Agustín Plata | Chief Executive Officer & Co-Founder |
| salman | Salman El Mehbaoui | Chief Operating Officer |

---

*Last updated: v2 Architecture Overhaul*
