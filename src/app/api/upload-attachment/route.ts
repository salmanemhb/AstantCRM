import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const emailId = formData.get('email_id') as string

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'File size exceeds 10MB limit' },
        { status: 400 }
      )
    }

    // Allowed file types
    const allowedTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
    ]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: `File type ${file.type} not allowed` },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Generate unique path
    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const storagePath = emailId 
      ? `${emailId}/${timestamp}_${sanitizedName}`
      : `temp/${timestamp}_${sanitizedName}`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('email-attachments')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json(
        { success: false, error: uploadError.message },
        { status: 500 }
      )
    }

    // Get public URL if needed
    const { data: urlData } = supabase.storage
      .from('email-attachments')
      .getPublicUrl(storagePath)

    // If email_id provided, save attachment record to database
    let attachmentId: string | undefined

    if (emailId) {
      const { data: attachment, error: dbError } = await supabase
        .from('email_attachments')
        .insert({
          email_id: emailId,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          storage_path: storagePath,
          public_url: urlData?.publicUrl,
        })
        .select()
        .single()

      if (dbError) {
        console.error('DB error:', dbError)
        // Clean up uploaded file
        await supabase.storage.from('email-attachments').remove([storagePath])
        return NextResponse.json(
          { success: false, error: 'Failed to save attachment record' },
          { status: 500 }
        )
      }

      attachmentId = attachment?.id
    }

    return NextResponse.json({
      success: true,
      attachment: {
        id: attachmentId,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        storage_path: storagePath,
        public_url: urlData?.publicUrl,
      }
    })

  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Upload failed' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { attachment_id, storage_path } = await request.json()

    if (!attachment_id && !storage_path) {
      return NextResponse.json(
        { success: false, error: 'attachment_id or storage_path required' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    let pathToDelete = storage_path

    // If attachment_id provided, get the storage path and delete record
    if (attachment_id) {
      const { data: attachment } = await supabase
        .from('email_attachments')
        .select('storage_path')
        .eq('id', attachment_id)
        .single()

      if (attachment) {
        pathToDelete = attachment.storage_path
        await supabase.from('email_attachments').delete().eq('id', attachment_id)
      }
    }

    // Delete from storage
    if (pathToDelete) {
      const { error } = await supabase.storage
        .from('email-attachments')
        .remove([pathToDelete])

      if (error) {
        console.error('Storage delete error:', error)
      }
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Delete error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Delete failed' },
      { status: 500 }
    )
  }
}
