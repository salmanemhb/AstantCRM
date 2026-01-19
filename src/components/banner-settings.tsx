'use client'

import { useState, useRef } from 'react'
import { Upload, X, Image as ImageIcon, Link, ToggleLeft, ToggleRight, Eye } from 'lucide-react'
import type { EmailBanner } from '@/lib/email-formatting'

interface BannerSettingsProps {
  banner: EmailBanner
  onChange: (banner: EmailBanner) => void
}

export function BannerSettings({ banner, onChange }: BannerSettingsProps) {
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const handleToggle = () => {
    onChange({ ...banner, enabled: !banner.enabled })
  }
  
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }
    
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be less than 2MB')
      return
    }
    
    setUploading(true)
    
    try {
      // Convert to base64 for preview (you can also upload to Supabase storage here)
      const reader = new FileReader()
      reader.onload = (event) => {
        const imageUrl = event.target?.result as string
        onChange({ ...banner, imageUrl, enabled: true })
        setUploading(false)
      }
      reader.readAsDataURL(file)
      
      // TODO: Upload to Supabase storage for production
      // const formData = new FormData()
      // formData.append('file', file)
      // const response = await fetch('/api/upload-banner', { method: 'POST', body: formData })
      // const { url } = await response.json()
      // onChange({ ...banner, imageUrl: url, enabled: true })
      
    } catch (error) {
      console.error('Upload error:', error)
      setUploading(false)
    }
  }
  
  const handleRemoveBanner = () => {
    onChange({ ...banner, imageUrl: '', enabled: false })
  }
  
  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-gray-500" />
          <span className="font-medium text-gray-900">Email Banner</span>
        </div>
        
        <button
          onClick={handleToggle}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            banner.enabled 
              ? 'bg-brand-100 text-brand-700' 
              : 'bg-gray-200 text-gray-600'
          }`}
        >
          {banner.enabled ? (
            <>
              <ToggleRight className="h-4 w-4" />
              On
            </>
          ) : (
            <>
              <ToggleLeft className="h-4 w-4" />
              Off
            </>
          )}
        </button>
      </div>
      
      {banner.enabled && (
        <div className="space-y-4">
          {/* Banner preview */}
          {banner.imageUrl ? (
            <div className="relative group">
              <img 
                src={banner.imageUrl} 
                alt="Banner preview" 
                className="w-full rounded-lg border border-gray-200 max-h-32 object-cover"
              />
              <button
                onClick={handleRemoveBanner}
                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove banner"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-brand-500 hover:bg-brand-50 transition-colors"
            >
              <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-600">
                {uploading ? 'Uploading...' : 'Click to upload banner image'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Recommended: 600x120px, max 2MB
              </p>
            </div>
          )}
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          {/* Banner link */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Link className="h-4 w-4 inline mr-1" />
              Banner Link (optional)
            </label>
            <input
              type="url"
              value={banner.linkUrl || ''}
              onChange={(e) => onChange({ ...banner, linkUrl: e.target.value })}
              placeholder="https://www.astantglobal.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          
          {/* Alt text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Alt Text
            </label>
            <input
              type="text"
              value={banner.altText}
              onChange={(e) => onChange({ ...banner, altText: e.target.value })}
              placeholder="Astant Global Management"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>
      )}
    </div>
  )
}
