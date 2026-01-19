import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import fs from 'fs'
import path from 'path'

// ============================================
// UPLOAD LOGO TO SUPABASE FOR PUBLIC ACCESS
// Run this once to upload the logo
// ============================================

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Read the logo file from public folder
    const logoPath = path.join(process.cwd(), 'public', 'astant-logo.jpg')
    
    if (!fs.existsSync(logoPath)) {
      return NextResponse.json({ error: 'Logo file not found' }, { status: 404 })
    }
    
    const logoBuffer = fs.readFileSync(logoPath)
    
    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('public-assets')
      .upload('astant-logo.jpg', logoBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      })
    
    if (error) {
      console.error('Upload error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    // Get the public URL
    const { data: publicUrl } = supabase.storage
      .from('public-assets')
      .getPublicUrl('astant-logo.jpg')
    
    return NextResponse.json({
      success: true,
      path: data.path,
      publicUrl: publicUrl.publicUrl,
      message: 'Logo uploaded. Update COMPANY_INFO.logoUrlAbsolute with this URL.',
    })
    
  } catch (error: any) {
    console.error('Logo upload error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint to upload the logo to Supabase storage',
    usage: 'curl -X POST http://localhost:3000/api/upload-logo',
  })
}
