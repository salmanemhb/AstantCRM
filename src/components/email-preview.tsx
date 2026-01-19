'use client'

import { useState } from 'react'
import { X, Eye, Monitor, Smartphone, Mail } from 'lucide-react'
import { COMPANY_INFO, getSignatureHtml, getMemberById } from '@/lib/signatures'
import { getBannerHtml, type EmailBanner } from '@/lib/email-formatting'

interface EmailPreviewProps {
  subject: string
  body: {
    greeting?: string
    context_p1?: string
    value_p2?: string
    cta?: string
  }
  senderId: string
  recipientName?: string
  recipientEmail?: string
  banner?: EmailBanner
  onClose: () => void
}

export function EmailPreviewModal({
  subject,
  body,
  senderId,
  recipientName = 'John Doe',
  recipientEmail = 'john@example.com',
  banner,
  onClose,
}: EmailPreviewProps) {
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop')
  
  const sender = getMemberById(senderId)
  const signatureHtml = getSignatureHtml(senderId, true)
  const bannerHtml = banner ? getBannerHtml(banner) : ''
  
  const formatParagraph = (text: string) => {
    if (!text) return ''
    // First normalize all line break formats to \n, then convert to <br>
    return text
      .replace(/<br\s*\/?>/gi, '\n')  // Convert <br>, <br/>, <br /> to \n first
      .replace(/&amp;/g, '&')          // Fix escaped ampersands
      .split(/\n\n+/)
      .filter(p => p.trim())
      .map(p => `<p style="margin: 0 0 16px 0; line-height: 1.6; text-align: justify;">${p.replace(/\n/g, '<br>')}</p>`)
      .join('')
  }
  
  const fullEmailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
  </style>
</head>
<body>
  <div style="background-color: #f5f5f5; padding: 20px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      ${bannerHtml}
      <tr>
        <td style="padding: 30px 25px; text-align: justify;">
          ${formatParagraph(body.greeting || `Dear ${recipientName},`)}
          ${formatParagraph(body.context_p1 || '')}
          ${formatParagraph(body.value_p2 || '')}
          ${formatParagraph(body.cta || '')}
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eeeeee;">
            ${signatureHtml}
          </div>
        </td>
      </tr>
    </table>
    
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 20px auto 0 auto;">
      <tr>
        <td style="padding: 20px; text-align: center; font-size: 11px; color: #999999;">
          <p style="margin: 0;">
            ${COMPANY_INFO.name}<br>
            ${COMPANY_INFO.address}, ${COMPANY_INFO.city}, ${COMPANY_INFO.country}
          </p>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Eye className="h-5 w-5 text-brand-600" />
            <h2 className="text-lg font-semibold">Email Preview</h2>
          </div>
          
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('desktop')}
                className={`p-2 rounded-md transition-colors ${viewMode === 'desktop' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                title="Desktop view"
              >
                <Monitor className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('mobile')}
                className={`p-2 rounded-md transition-colors ${viewMode === 'mobile' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                title="Mobile view"
              >
                <Smartphone className="h-4 w-4" />
              </button>
            </div>
            
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        {/* Email metadata */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 text-sm">
          <div className="flex items-center gap-2 mb-1">
            <Mail className="h-4 w-4 text-gray-400" />
            <span className="text-gray-600">From:</span>
            <span className="font-medium">{sender?.name} &lt;{sender?.email}&gt;</span>
          </div>
          <div className="flex items-center gap-2 mb-1 ml-6">
            <span className="text-gray-600">To:</span>
            <span>{recipientName} &lt;{recipientEmail}&gt;</span>
          </div>
          <div className="flex items-center gap-2 ml-6">
            <span className="text-gray-600">Subject:</span>
            <span className="font-medium">{subject}</span>
          </div>
        </div>
        
        {/* Email content */}
        <div className="flex-1 overflow-auto p-4 bg-gray-100">
          <div 
            className={`mx-auto transition-all ${viewMode === 'mobile' ? 'max-w-[375px]' : 'max-w-[650px]'}`}
          >
            <iframe
              srcDoc={fullEmailHtml}
              className="w-full bg-white rounded-lg shadow-sm"
              style={{ 
                height: viewMode === 'mobile' ? '600px' : '500px',
                border: viewMode === 'mobile' ? '8px solid #1a1a1a' : 'none',
                borderRadius: viewMode === 'mobile' ? '24px' : '8px'
              }}
              title="Email Preview"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// Inline preview component (for composer)
export function EmailPreviewInline({
  body,
  senderId,
  banner,
}: {
  body: {
    greeting?: string
    context_p1?: string
    value_p2?: string
    cta?: string
  }
  senderId: string
  banner?: EmailBanner
}) {
  const signatureHtml = getSignatureHtml(senderId, false) // Use relative URL for inline
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
      {banner?.enabled && banner.imageUrl && (
        <div className="rounded-lg overflow-hidden">
          <img 
            src={banner.imageUrl} 
            alt={banner.altText} 
            className="w-full h-auto max-h-32 object-cover"
          />
        </div>
      )}
      
      <div className="space-y-4 text-gray-700" style={{ fontFamily: 'Arial, sans-serif' }}>
        {body.greeting && <p className="mb-4">{body.greeting}</p>}
        {body.context_p1 && (
          <div 
            className="mb-4" 
            dangerouslySetInnerHTML={{ __html: body.context_p1.replace(/<br\s*\/?>/gi, '\n').replace(/&amp;/g, '&').replace(/\n/g, '<br/>') }} 
          />
        )}
        {body.value_p2 && (
          <div 
            className="mb-4" 
            dangerouslySetInnerHTML={{ __html: body.value_p2.replace(/<br\s*\/?>/gi, '\n').replace(/&amp;/g, '&').replace(/\n/g, '<br/>') }} 
          />
        )}
        {body.cta && (
          <div 
            className="mb-4" 
            dangerouslySetInnerHTML={{ __html: body.cta.replace(/<br\s*\/?>/gi, '\n').replace(/&amp;/g, '&').replace(/\n/g, '<br/>') }} 
          />
        )}
      </div>
      
      <div 
        className="border-t pt-4 mt-4"
        dangerouslySetInnerHTML={{ __html: signatureHtml }}
      />
    </div>
  )
}
