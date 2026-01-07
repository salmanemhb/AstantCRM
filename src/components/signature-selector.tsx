'use client'

import { useState } from 'react'
import { ChevronDown, User, Check } from 'lucide-react'
import { TEAM_MEMBERS, COMPANY_INFO, getSignatureText, type TeamMember } from '@/lib/signatures'

interface SignatureSelectorProps {
  selectedMemberId: string
  onSelect: (memberId: string) => void
  showPreview?: boolean
}

export default function SignatureSelector({ 
  selectedMemberId, 
  onSelect,
  showPreview = true 
}: SignatureSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  
  const selectedMember = TEAM_MEMBERS.find(m => m.id === selectedMemberId)

  return (
    <div className="relative">
      {/* Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center">
            <User className="h-4 w-4 text-brand-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-gray-900">
              {selectedMember?.name || 'Select Sender'}
            </p>
            <p className="text-xs text-gray-500">
              {selectedMember?.title || 'Choose who will send this email'}
            </p>
          </div>
        </div>
        <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-20 mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {TEAM_MEMBERS.map((member) => (
            <button
              key={member.id}
              onClick={() => {
                onSelect(member.id)
                setIsOpen(false)
              }}
              className={`w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors ${
                member.id === selectedMemberId ? 'bg-brand-50' : ''
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  member.id === selectedMemberId ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {member.firstName[0]}
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">{member.name}</p>
                  <p className="text-xs text-gray-500">{member.title}</p>
                  <p className="text-xs text-gray-400">{member.email}</p>
                </div>
              </div>
              {member.id === selectedMemberId && (
                <Check className="h-5 w-5 text-brand-600" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Signature Preview */}
      {showPreview && selectedMember && (
        <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Signature Preview</p>
          <div className="flex items-start space-x-4">
            <img 
              src={COMPANY_INFO.logoUrl} 
              alt="Astant Global Management" 
              className="w-16 h-16 object-contain"
            />
            <div className="text-sm">
              <p className="font-semibold text-gray-900">{selectedMember.name}</p>
              <p className="text-gray-600">{selectedMember.title}</p>
              <p className="text-gray-700 font-medium mt-1">{COMPANY_INFO.name}</p>
              <p className="text-gray-500 text-xs">{COMPANY_INFO.address}</p>
              <p className="text-gray-500 text-xs">{COMPANY_INFO.city}, {COMPANY_INFO.country}</p>
              <div className="mt-1 flex items-center space-x-2 text-xs">
                <a href={`mailto:${selectedMember.email}`} className="text-brand-600 hover:underline">
                  {selectedMember.email}
                </a>
                <span className="text-gray-300">|</span>
                <a href={`https://${COMPANY_INFO.website}`} className="text-brand-600 hover:underline">
                  {COMPANY_INFO.website}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Compact inline signature for email composer
export function InlineSignature({ memberId }: { memberId: string }) {
  const member = TEAM_MEMBERS.find(m => m.id === memberId)
  if (!member) return null

  return (
    <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
      <img 
        src={COMPANY_INFO.logoUrl} 
        alt="Astant" 
        className="w-12 h-12 object-contain"
      />
      <div className="text-sm leading-relaxed">
        <p className="font-semibold text-gray-900">{member.name}</p>
        <p className="text-gray-600 text-xs">{member.title}</p>
        <p className="text-gray-700 font-medium text-xs mt-1">{COMPANY_INFO.name}</p>
        <p className="text-gray-500 text-xs">{COMPANY_INFO.address}</p>
        <p className="text-gray-500 text-xs">{COMPANY_INFO.city}, {COMPANY_INFO.country}</p>
        <p className="text-xs mt-1">
          <a href={`mailto:${member.email}`} className="text-brand-600">{member.email}</a>
          {' | '}
          <a href={`https://${COMPANY_INFO.website}`} className="text-brand-600">{COMPANY_INFO.website}</a>
        </p>
      </div>
    </div>
  )
}
