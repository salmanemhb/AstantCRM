/**
 * Unsubscribe API Route
 * Handles email unsubscribe requests
 * 
 * GET - Show unsubscribe confirmation page
 * POST - Process unsubscribe request
 */

import { NextRequest, NextResponse } from 'next/server'
import { processUnsubscribe, verifyUnsubscribeToken } from '@/lib/unsubscribe'
import { createLogger } from '@/lib/logger'
import { withRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit'

const logger = createLogger('unsubscribe-api')

/**
 * GET /api/unsubscribe?token=xxx
 * Displays unsubscribe confirmation page
 */
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID()
  logger.info('Unsubscribe page request', { requestId })
  
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const campaignId = searchParams.get('campaign')
    
    if (!token) {
      logger.warn('Missing token', { requestId })
      return new NextResponse(generateErrorPage('Missing unsubscribe token'), {
        status: 400,
        headers: { 'Content-Type': 'text/html' },
      })
    }
    
    // Verify token is valid
    const tokenResult = verifyUnsubscribeToken(token)
    
    if (!tokenResult.valid) {
      logger.warn('Invalid token', { requestId, error: tokenResult.error })
      return new NextResponse(generateErrorPage('Invalid or expired unsubscribe link'), {
        status: 400,
        headers: { 'Content-Type': 'text/html' },
      })
    }
    
    // Show confirmation page
    logger.info('Showing unsubscribe page', { requestId, contactId: tokenResult.contactId })
    
    return new NextResponse(
      generateUnsubscribePage(token, campaignId), 
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }
    )
    
  } catch (error) {
    logger.error('Unsubscribe page error', { requestId, error })
    return new NextResponse(generateErrorPage('An error occurred'), {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    })
  }
}

/**
 * POST /api/unsubscribe
 * Process unsubscribe request
 */
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  logger.info('Unsubscribe request', { requestId })
  
  // Rate limiting
  const rateLimitResult = withRateLimit(request, RATE_LIMIT_CONFIGS.general)
  
  if (!rateLimitResult.allowed) {
    return rateLimitResult.response!
  }
  
  try {
    const body = await request.json()
    const { token, reason, unsubscribeAll = true, campaignId } = body
    
    if (!token) {
      return NextResponse.json(
        { error: 'Missing token' },
        { status: 400 }
      )
    }
    
    // Process unsubscribe
    const result = await processUnsubscribe(token, {
      campaignId,
      unsubscribeAll,
      reason,
    })
    
    if (!result.success) {
      logger.warn('Unsubscribe failed', { 
        requestId, 
        error: result.error,
        contactId: result.contactId 
      })
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }
    
    logger.info('Unsubscribe successful', { 
      requestId, 
      contactId: result.contactId,
      unsubscribeAll,
      campaignId 
    })
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    logger.error('Unsubscribe processing error', { requestId, error })
    return NextResponse.json(
      { error: 'Failed to process unsubscribe request' },
      { status: 500 }
    )
  }
}

// ============================================
// HTML PAGE GENERATORS
// ============================================

function generateUnsubscribePage(token: string, campaignId: string | null): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribe - Astant</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      padding: 48px;
      max-width: 480px;
      width: 100%;
      text-align: center;
    }
    .logo {
      font-size: 32px;
      font-weight: 700;
      color: #667eea;
      margin-bottom: 24px;
    }
    h1 {
      color: #1a202c;
      font-size: 24px;
      margin-bottom: 16px;
    }
    p {
      color: #4a5568;
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .options {
      margin-bottom: 24px;
    }
    .option {
      display: flex;
      align-items: center;
      padding: 16px;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      margin-bottom: 12px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .option:hover {
      border-color: #667eea;
      background: #f7fafc;
    }
    .option.selected {
      border-color: #667eea;
      background: #eef2ff;
    }
    .option input[type="radio"] {
      width: 20px;
      height: 20px;
      margin-right: 12px;
      accent-color: #667eea;
    }
    .option-content {
      text-align: left;
    }
    .option-title {
      font-weight: 600;
      color: #1a202c;
      margin-bottom: 4px;
    }
    .option-desc {
      font-size: 14px;
      color: #718096;
    }
    .reason-input {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      font-size: 14px;
      margin-bottom: 24px;
      resize: vertical;
      min-height: 80px;
    }
    .reason-input:focus {
      outline: none;
      border-color: #667eea;
    }
    .btn {
      display: inline-block;
      padding: 14px 32px;
      font-size: 16px;
      font-weight: 600;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s;
      width: 100%;
      margin-bottom: 12px;
    }
    .btn-primary {
      background: #667eea;
      color: white;
    }
    .btn-primary:hover {
      background: #5a67d8;
    }
    .btn-secondary {
      background: white;
      color: #4a5568;
      border: 2px solid #e2e8f0;
    }
    .btn-secondary:hover {
      background: #f7fafc;
    }
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .success-message {
      display: none;
    }
    .success-message.show {
      display: block;
    }
    .success-icon {
      width: 64px;
      height: 64px;
      background: #48bb78;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }
    .success-icon svg {
      width: 32px;
      height: 32px;
      color: white;
    }
    .error-message {
      background: #fed7d7;
      color: #c53030;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 16px;
      display: none;
    }
    .error-message.show {
      display: block;
    }
    .form-section {
      display: block;
    }
    .form-section.hide {
      display: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Astant</div>
    
    <div class="form-section" id="form-section">
      <h1>Unsubscribe from Emails</h1>
      <p>We're sorry to see you go. Please let us know your preference below.</p>
      
      <div class="error-message" id="error-message"></div>
      
      <div class="options">
        <label class="option selected" id="option-all">
          <input type="radio" name="unsubscribe" value="all" checked>
          <div class="option-content">
            <div class="option-title">Unsubscribe from all emails</div>
            <div class="option-desc">You won't receive any more emails from us</div>
          </div>
        </label>
        
        ${campaignId ? `
        <label class="option" id="option-campaign">
          <input type="radio" name="unsubscribe" value="campaign">
          <div class="option-content">
            <div class="option-title">Unsubscribe from this campaign only</div>
            <div class="option-desc">You may still receive other emails from us</div>
          </div>
        </label>
        ` : ''}
      </div>
      
      <textarea 
        class="reason-input" 
        id="reason" 
        placeholder="(Optional) Let us know why you're unsubscribing..."
      ></textarea>
      
      <button class="btn btn-primary" id="submit-btn" onclick="handleSubmit()">
        Confirm Unsubscribe
      </button>
      
      <button class="btn btn-secondary" onclick="window.close()">
        Cancel
      </button>
    </div>
    
    <div class="success-message" id="success-section">
      <div class="success-icon">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1>You've been unsubscribed</h1>
      <p>You will no longer receive emails from us. If you change your mind, you can always reach out to us directly.</p>
      <button class="btn btn-secondary" onclick="window.close()">Close</button>
    </div>
  </div>
  
  <script>
    const token = '${token}';
    const campaignId = ${campaignId ? `'${campaignId}'` : 'null'};
    
    // Handle option selection styling
    document.querySelectorAll('.option').forEach(option => {
      option.addEventListener('click', () => {
        document.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
      });
    });
    
    async function handleSubmit() {
      const submitBtn = document.getElementById('submit-btn');
      const errorEl = document.getElementById('error-message');
      
      submitBtn.disabled = true;
      submitBtn.textContent = 'Processing...';
      errorEl.classList.remove('show');
      
      const selectedOption = document.querySelector('input[name="unsubscribe"]:checked').value;
      const reason = document.getElementById('reason').value;
      
      try {
        const response = await fetch('/api/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            unsubscribeAll: selectedOption === 'all',
            campaignId: selectedOption === 'campaign' ? campaignId : null,
            reason: reason || undefined,
          }),
        });
        
        const data = await response.json();
        
        if (!response.ok || data.error) {
          throw new Error(data.error || 'Failed to unsubscribe');
        }
        
        // Show success
        document.getElementById('form-section').classList.add('hide');
        document.getElementById('success-section').classList.add('show');
        
      } catch (error) {
        errorEl.textContent = error.message || 'An error occurred. Please try again.';
        errorEl.classList.add('show');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Confirm Unsubscribe';
      }
    }
  </script>
</body>
</html>
  `.trim()
}

function generateErrorPage(message: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error - Astant</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      padding: 48px;
      max-width: 480px;
      width: 100%;
      text-align: center;
    }
    .logo { font-size: 32px; font-weight: 700; color: #667eea; margin-bottom: 24px; }
    .error-icon {
      width: 64px; height: 64px;
      background: #fc8181;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 24px;
    }
    .error-icon svg { width: 32px; height: 32px; color: white; }
    h1 { color: #1a202c; font-size: 24px; margin-bottom: 16px; }
    p { color: #4a5568; font-size: 16px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Astant</div>
    <div class="error-icon">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </div>
    <h1>Something went wrong</h1>
    <p>${message}</p>
  </div>
</body>
</html>
  `.trim()
}
