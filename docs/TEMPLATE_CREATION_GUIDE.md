# 📝 Template Creation Guide for Astant CRM

> **How to create email templates that the AI can easily personalize**

---

## 🎯 Quick Summary

The AI's ONLY job is to **detect and replace placeholders**. It does NOT rewrite, shorten, or modify your email. Write the complete email yourself, then mark what should be personalized with brackets.

---

## ✅ Placeholder Format Rules

### **Use UPPERCASE with UNDERSCORES inside SQUARE BRACKETS**

| ✅ CORRECT | ❌ INCORRECT |
|-----------|-------------|
| `[FIRST_NAME]` | `{first_name}`, `<FirstName>`, `FIRST_NAME` |
| `[COMPANY_NAME]` | `[Company Name]`, `{{company}}` |
| `[INVESTMENT_FOCUS]` | `[investment focus]`, `[InvestmentFocus]` |

### **Standard Placeholder Names (AI recognizes these best)**

#### Recipient Info
| Placeholder | What it becomes | Example |
|-------------|-----------------|---------|
| `[FIRST_NAME]` | Recipient's first name | Michael |
| `[LAST_NAME]` | Recipient's last name | Chen |
| `[FULL_NAME]` | Recipient's full name | Michael Chen |
| `[FIRM]` or `[COMPANY]` | Their organization | Sequoia Capital |
| `[ROLE]` or `[TITLE]` | Their job title | Partner |
| `[INVESTMENT_FOCUS]` | What they invest in | fintech and AI |
| `[GEOGRAPHY]` | Their geographic focus | EMEA |

#### Sender Info (Auto-filled from selected sender)
| Placeholder | What it becomes | Example |
|-------------|-----------------|---------|
| `[SENDER_NAME]` | Sender full name | Jean-François Manigo Gilardoni |
| `[SENDER_FIRST_NAME]` | Sender first name | Jean-François |
| `[SENDER_TITLE]` | Sender job title | Global Partnerships Lead |

#### Custom/Context
| Placeholder | What it becomes | Example |
|-------------|-----------------|---------|
| `[CUSTOM_HOOK]` | Personalized opening | I saw your recent interview on Bloomberg... |
| `[RECENT_NEWS]` | News about them | your firm's recent Series A in Stripe |
| `[PORTFOLIO_COMPANY]` | A portfolio company ref | your investment in Notion |

---

## 📋 Template Structure Best Practices

### 1. **Keep Subject Lines Short with 1-2 Placeholders Max**
```
✅ Quick intro – Astant x [FIRM]
✅ Following up – [FIRST_NAME]
✅ Invitation: Astant Event in [GEOGRAPHY]

❌ [FIRST_NAME] from [COMPANY] regarding [INVESTMENT_FOCUS] meeting about [TOPIC]
```

### 2. **Start Body with a Personalized Greeting**
```
Good morning [FIRST_NAME],

Hi [FIRST_NAME],

Dear [FIRST_NAME],
```

### 3. **Use Placeholders Naturally in Sentences**
```
✅ I came across [FIRM]'s work in [INVESTMENT_FOCUS] and thought there might be a strong fit.

❌ I came across [FIRM]'s work. Your focus is [INVESTMENT_FOCUS]. I thought there might be a fit.
```

### 4. **End with Sender Signature Block**
```
Sincerely,

[SENDER_NAME]
[SENDER_TITLE]
Astant Global Management
```

---

## 🧪 AI Detection Tips

The AI looks for these patterns (in order of confidence):

| Pattern | Confidence | Example |
|---------|------------|---------|
| `[UPPERCASE_NAME]` | 🟢 HIGH | `[FIRST_NAME]`, `[FIRM]` |
| `{lowercase_name}` | 🟡 MEDIUM | `{first_name}`, `{company}` |
| `{{double_braces}}` | 🟡 MEDIUM | `{{name}}` |
| Generic text | 🔴 LOW | "Dear Friend", "your company" |

**For best results:** Always use `[UPPERCASE_WITH_UNDERSCORES]`

---

## 📏 Template Length Guidelines

| Type | Word Count | Use Case |
|------|------------|----------|
| **Micro** | 50-80 words | Quick follow-ups, reminders |
| **Short** | 100-150 words | Cold outreach, intros |
| **Medium** | 200-300 words | Warm outreach, detailed intros |
| **Long** | 400-500 words | Strategic partners, investors with history |

---

## ⚠️ Common Mistakes to Avoid

1. **Don't use placeholders in the middle of words**
   - ❌ `[FIRST_NAME]'s company` → ✅ `the company of [FIRST_NAME]`
   
2. **Don't create overly specific placeholders**
   - ❌ `[SPECIFIC_PORTFOLIO_COMPANY_FROM_2023_SERIES_A]`
   - ✅ `[PORTFOLIO_COMPANY]`

3. **Don't forget sender placeholders**
   - Always include `[SENDER_NAME]` and `[SENDER_TITLE]` in signature

4. **Don't mix placeholder formats**
   - ❌ `Hi [FIRST_NAME], I noticed {company} is doing well...`
   - ✅ `Hi [FIRST_NAME], I noticed [COMPANY] is doing well...`

---

## 📄 Template Checklist

Before importing a template, verify:

- [ ] All placeholders use `[UPPERCASE_UNDERSCORES]` format
- [ ] Subject line has max 1-2 placeholders
- [ ] Greeting includes `[FIRST_NAME]`
- [ ] Signature includes `[SENDER_NAME]` and `[SENDER_TITLE]`
- [ ] Placeholders fit naturally in sentences
- [ ] No spelling errors in placeholder names
- [ ] Template makes sense if placeholders are replaced with examples

---

## 🧪 Test Your Template

Mentally replace each placeholder with a real value:

```
[FIRST_NAME] → Michael
[FIRM] → Sequoia Capital
[INVESTMENT_FOCUS] → fintech and AI
[SENDER_NAME] → Jean-François Manigo Gilardoni
```

Read the email out loud. Does it sound natural? If yes, you're good! ✅

---

## 📚 Example Templates

### Micro Template (Follow-up)
```
Subject: Following up – [FIRST_NAME]

Hi [FIRST_NAME],

Just wanted to follow up on my previous email. Would love to find a time to connect this week or next.

Let me know what works for you.

Best,
[SENDER_NAME]
```

### Short Template (Cold Outreach)
```
Subject: Quick intro – Astant x [FIRM]

Good morning [FIRST_NAME],

I'm [SENDER_FIRST_NAME] from Astant Global Management.

I noticed [FIRM]'s focus on [INVESTMENT_FOCUS] and thought there could be a strong fit with what we're building.

We're launching OpenMacro, an AI-driven macro intelligence platform. Would you have 15 minutes for a quick call?

Best regards,
[SENDER_NAME]
[SENDER_TITLE]
Astant Global Management
```

---

*Last updated: January 2026*
