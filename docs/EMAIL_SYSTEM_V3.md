# Email Generation System v3 - Production Ready

## ✅ STATUS: DEPLOYED AND TESTED

---

## The Problem We Solved

**Before (v2):** AI was asked to "write an email matching this style" → produced fake startup bro speak like "hop on a call" and "pretty small fund"

**After (v3):** AI ONLY fills variable values → template structure is copied verbatim from Jean-François's actual emails

---

## Architecture

```
User Request
    ↓
/api/generate-claude (route.ts)
    ↓
email-generator-v3.ts
    ├── 1. Select template by category (vc, media, client, etc.)
    ├── 2. Pre-fill known variables (name, company)
    ├── 3. Ask AI ONLY for remaining variable values (short phrases)
    └── 4. Substitute variables into template
    ↓
Output: Email that IS Jean-François's structure with personalized details
```

---

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/email-templates-v3.ts` | 8 fill-in-blank templates | ✅ Production |
| `src/lib/email-generator-v3.ts` | Variable substitution engine | ✅ Production |
| `src/app/api/generate-claude/route.ts` | API endpoint | ✅ Updated |
| `src/lib/knowledge-base.ts` | Banned phrases, style guide | ✅ Integrated |

---

## Templates Available

| ID | Name | Use Case |
|----|------|----------|
| `vc_cold_intro` | VC Cold Introduction | First outreach to investors |
| `warm_intro_followup` | Warm Introduction | When introduced by mutual connection |
| `media_pitch` | Media/Journalist Pitch | Pitching press coverage |
| `client_intro` | Client Introduction | Outreach to potential clients |
| `followup_first` | First Follow-up | After no response (1-2 weeks) |
| `followup_final` | Final Follow-up | Last attempt (3-4 weeks) |
| `expert_outreach` | Expert Outreach | Industry experts, advisors |
| `post_event` | Post-Event Follow-up | After meeting at conference |

---

## How It Works

### Old Approach (BROKEN):
```
AI Prompt: "Write an email that matches Jean-François's style..."
AI Output: *Completely rewritten email with "innovative synergies"*
```

### New Approach (WORKING):
```
Template: "I recently came across {company_name}'s work in {their_focus_area}..."

AI Task: Fill ONLY the variable values:
  - {their_focus_area} → "European hospitality investments"
  - {specific_thing} → "your insights at MIPIM"

Output: Exact template with those values substituted
```

---

## API Usage

### Preview Mode (No Database)
```bash
POST /api/generate-claude
{
  "contact_id": "preview",
  "campaign_id": "preview",
  "config": {
    "email_type": "vc",  # or: media, client, follow-up, expert, warm-intro
    "custom_context": "Works at Blackstone, focuses on European hospitality"
  }
}
```

### Production Mode (With Contact/Campaign)
```bash
POST /api/generate-claude
{
  "contact_id": "uuid-of-contact",
  "campaign_id": "uuid-of-campaign",
  "config": {
    "template_id": "vc_cold_intro",  # Optional: specific template
    "connector_name": "Michael",      # For warm intros
    "specific_ask": "Discuss partnership"
  }
}
```

### Response
```json
{
  "email_id": "uuid",
  "subject": "Blackstone × Astant",
  "body": "Good morning Sarah...",
  "confidence": 90,
  "template_used": "vc_cold_intro",
  "variables_filled": {
    "first_name": "Sarah",
    "company_name": "Blackstone",
    "their_focus_area": "European hospitality investments"
  },
  "validation": {
    "passed": true,
    "issues": []
  }
}
```

---

## Quality Control

1. **Banned Phrases Check**: 100+ phrases automatically flagged
2. **Unfilled Variable Check**: Detects `{missing}` placeholders
3. **Confidence Score**: 0-100 based on:
   - All variables filled (+)
   - No banned phrases (+)
   - Appropriate length (+)

---

## Legacy Files (Can Be Deleted)

These files are superseded by v3:

- `src/lib/email-agents.ts` - Old v1 system
- `src/lib/email-agents-v2.ts` - Multi-agent system (over-engineered)
- `src/lib/gold-standard-emails.ts` - Merged into templates
- `claude-wizards/` folder - Development artifacts

---

## Variable Definitions

| Variable | Format | Example |
|----------|--------|---------|
| `first_name` | First name only | "Sarah" |
| `company_name` | Company/firm name | "Blackstone" |
| `their_focus_area` | 2-4 words | "sustainable infrastructure" |
| `specific_thing_that_caught_attention` | 8-12 words | "your recent Series B in renewable storage" |
| `topic_for_their_expertise` | 5-8 words | "the European hospitality sector" |
| `connector_name` | Name of mutual connection | "Michael" |
| `how_they_know_connector` | 3-6 words | "worked together at Brookfield" |

---

## Maintenance

To add a new template:

1. Add to `TEMPLATES` object in `email-templates-v3.ts`
2. Define: `id`, `name`, `category`, `subject_template`, `body_template`, `variables[]`, `example_filled`
3. Use `{variable_name}` syntax for all personalization points
4. Add variable descriptions to `VARIABLE_DESCRIPTIONS` in `email-generator-v3.ts`

---

*Last updated: System v3 deployment*
