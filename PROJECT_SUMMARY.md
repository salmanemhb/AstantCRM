# VC Outreach CRM - Project Summary

**Client:** Astant Global Management  
**Delivered:** January 2026  
**Status:** MVP Complete

---

## What Was Built

An AI-powered CRM for investor outreach that generates personalized emails, enforces quality control through confidence scoring, and requires human approval before sending.

---

## Core Features

| Feature | Description |
|---------|-------------|
| **AI Email Generation** | Claude 3.5 Sonnet creates personalized outreach based on contact and campaign data |
| **Confidence Scoring** | Green/Yellow/Red classification prevents low-quality emails from being sent |
| **Review Queue** | Card-based interface for rapid email approval or rejection |
| **One-Click Refinement** | Five rebuttal options: Softer, Shorter, More Technical, Clarify Value, Less Pitchy |
| **Campaign Management** | Configure tone, CTA, and fallback strategy per campaign |
| **Contact Database** | Store investor details with firm, role, and investment focus |

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| Database | PostgreSQL (Supabase) |
| Backend | Supabase Edge Functions (Deno) |
| AI | Anthropic Claude 3.5 Sonnet |
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Email | Resend (pluggable) |

---

## Deliverables

**Backend (3 Edge Functions)**
- generate-draft: AI email generation with context assembly
- rebuttal: One-click tone and style adjustments
- send-drip: Email delivery with validation

**Frontend (4 Pages)**
- Dashboard: Overview and navigation
- Queue: Card-based email review
- Campaigns: Campaign creation and management
- Contacts: Contact database

**Database**
- 10 tables with foreign keys and constraints
- 8 ENUM types for data integrity
- Full audit trail support

---

## Design Principles

1. **Frozen Architecture** - Schema finalized before coding began
2. **Deterministic AI** - AI generates only specific fields, never fabricates
3. **Human-in-the-Loop** - Every email requires explicit approval
4. **Safety Rails** - Database constraints block red-confidence sends

---

## Next Steps

1. Configure Supabase project and credentials
2. Add user authentication
3. Deploy to production

---

*Built for Astant Global Management*
