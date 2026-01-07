import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Email provider configuration
// Set RESEND_API_KEY in .env.local to enable actual sending
const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@astant.io'
const FROM_NAME = process.env.FROM_NAME || 'Astant Global Management'

interface SendEmailRequest {
  email_id: string
  dry_run?: boolean // If true, don't actually send - just simulate
}

export async function POST(request: NextRequest) {
  try {
    const { email_id, dry_run = false }: SendEmailRequest = await request.json()

    if (!email_id) {
      return NextResponse.json(
        { success: false, error: 'email_id is required' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Fetch email with related data
    const { data: email, error: emailError } = await supabase
      .from('emails')
      .select(`
        *,
        contact_campaign:contact_campaigns (
          *,
          contact:contacts (*),
          campaign:campaigns (*)
        )
      `)
      .eq('id', email_id)
      .single()

    if (emailError || !email) {
      return NextResponse.json(
        { success: false, error: 'Email not found' },
        { status: 404 }
      )
    }

    // Check if already sent
    if (email.sent_at) {
      return NextResponse.json(
        { success: false, error: 'Email already sent' },
        { status: 400 }
      )
    }

    const contact = email.contact_campaign?.contact
    const toEmail = contact?.email

    if (!toEmail) {
      return NextResponse.json(
        { success: false, error: 'No recipient email address' },
        { status: 400 }
      )
    }

    // Build email content
    const body = email.current_body || email.original_body
    const htmlBody = buildHtmlEmail(body, contact)
    const textBody = buildTextEmail(body)

    // Fetch attachments if any
    const { data: attachments } = await supabase
      .from('email_attachments')
      .select('*')
      .eq('email_id', email_id)

    let messageId: string | undefined

    if (dry_run) {
      // Dry run - just log what would be sent
      console.log('=== DRY RUN EMAIL ===')
      console.log('To:', toEmail)
      console.log('Subject:', email.subject)
      console.log('Body preview:', textBody.substring(0, 200))
      console.log('Attachments:', attachments?.length || 0)
      messageId = `dry-run-${Date.now()}`
    } else if (RESEND_API_KEY) {
      // Send via Resend
      const resendPayload: any = {
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [toEmail],
        subject: email.subject,
        html: htmlBody,
        text: textBody,
      }

      // Add attachments if present
      if (attachments && attachments.length > 0) {
        resendPayload.attachments = await Promise.all(
          attachments.map(async (att) => {
            // Fetch file from Supabase storage
            const { data: fileData } = await supabase.storage
              .from('email-attachments')
              .download(att.storage_path)
            
            if (fileData) {
              const buffer = await fileData.arrayBuffer()
              return {
                filename: att.file_name,
                content: Buffer.from(buffer).toString('base64'),
              }
            }
            return null
          })
        ).then(atts => atts.filter(Boolean))
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resendPayload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to send via Resend')
      }

      const result = await response.json()
      messageId = result.id
    } else {
      // No email provider configured - simulate send for demo
      console.log('=== SIMULATED SEND (no RESEND_API_KEY configured) ===')
      console.log('To:', toEmail)
      console.log('Subject:', email.subject)
      messageId = `simulated-${Date.now()}`
    }

    // Update database
    const sentAt = new Date().toISOString()

    await supabase
      .from('emails')
      .update({ 
        sent_at: sentAt,
        approved: true 
      })
      .eq('id', email_id)

    await supabase
      .from('contact_campaigns')
      .update({ stage: 'sent' })
      .eq('id', email.contact_campaign_id)

    // Log engagement event
    if (email.contact_campaign?.unified_thread_id) {
      await supabase
        .from('engagement_events')
        .insert({
          unified_thread_id: email.contact_campaign.unified_thread_id,
          email_id: email_id,
          event_type: 'sent',
          metadata: { message_id: messageId, dry_run }
        })
    }

    return NextResponse.json({
      success: true,
      email_id,
      sent_to: toEmail,
      sent_at: sentAt,
      message_id: messageId,
      dry_run,
    })

  } catch (error: any) {
    console.error('Send email error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send email' },
      { status: 500 }
    )
  }
}

function buildHtmlEmail(body: any, contact: any): string {
  const firstName = contact?.first_name || 'there'
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    p { margin: 0 0 16px 0; }
    .signature { margin-top: 24px; color: #666; font-size: 14px; }
    a { color: #0066cc; }
  </style>
</head>
<body>
  <p>${body.greeting || `Hi ${firstName},`}</p>
  <p>${body.context_p1 || ''}</p>
  <p>${body.value_p2 || ''}</p>
  <p>${body.cta || ''}</p>
  <div class="signature">
    ${(body.signature || '').replace(/\n/g, '<br>')}
  </div>
</body>
</html>
  `.trim()
}

function buildTextEmail(body: any): string {
  return [
    body.greeting,
    '',
    body.context_p1,
    '',
    body.value_p2,
    '',
    body.cta,
    '',
    body.signature
  ].filter(Boolean).join('\n')
}
