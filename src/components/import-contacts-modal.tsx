'use client'

import { useState, useCallback, useRef } from 'react'
import { 
  Upload, 
  FileSpreadsheet, 
  X, 
  Check, 
  AlertCircle,
  ChevronDown,
  Loader2,
  ArrowRight,
  ArrowLeft
} from 'lucide-react'
import { 
  parseSpreadsheet, 
  autoDetectMapping, 
  validateMapping,
  extractContact,
  formatHeader,
  formatCellValue,
  extractFilterColumns,
  type ParsedSpreadsheet,
  type ColumnMapping 
} from '@/lib/spreadsheet-parser'
import { createClient } from '@/lib/supabase/client'

interface ImportContactsModalProps {
  onClose: () => void
  onImported: () => void
}

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'done'

export default function ImportContactsModal({ onClose, onImported }: ImportContactsModalProps) {
  const [step, setStep] = useState<ImportStep>('upload')
  const [dragActive, setDragActive] = useState(false)
  const [parsedData, setParsedData] = useState<ParsedSpreadsheet | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [listName, setListName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [importProgress, setImportProgress] = useState(0)
  const [importedCount, setImportedCount] = useState(0)
  const [skippedCount, setSkippedCount] = useState(0)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Handle file selection
  const handleFile = useCallback(async (file: File) => {
    setError(null)
    
    try {
      console.log('File selected:', file.name, 'Size:', file.size, 'bytes')
      const data = await parseSpreadsheet(file)
      console.log('PARSED DATA:', {
        headers: data.headers.length,
        rows: data.rows.length,
        rowCount: data.rowCount,
        firstRow: data.rows[0],
        lastRow: data.rows[data.rows.length - 1]
      })
      setParsedData(data)
      setListName(file.name.replace(/\.[^/.]+$/, '')) // Remove extension
      
      // Auto-detect column mappings
      const detectedMapping = autoDetectMapping(data.headers)
      setMapping(detectedMapping)
      
      setStep('mapping')
    } catch (err: any) {
      setError(err.message)
    }
  }, [])

  // Drag and drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  // Update mapping
  const updateMapping = (field: keyof ColumnMapping, header: string | undefined) => {
    setMapping(prev => ({
      ...prev,
      [field]: header,
    }))
  }

  // Proceed to preview
  const handleContinueToPreview = () => {
    const validation = validateMapping(mapping)
    if (!validation.valid) {
      setError(validation.errors.join('. '))
      return
    }
    setError(null)
    setStep('preview')
  }

  // Import contacts
  const handleImport = async () => {
    if (!parsedData) return
    
    setStep('importing')
    setImportProgress(0)
    setImportedCount(0)
    setSkippedCount(0)
    setError(null)

    try {
      // Extract filter columns from the spreadsheet data for filtering UI
      const filterColumns = extractFilterColumns(parsedData.rows, parsedData.headers)
      console.log('Extracted filter columns:', Object.keys(filterColumns).length, 'columns')
      
      // Create contact list with filter_columns
      const { data: contactList, error: listError } = await supabase
        .from('contact_lists')
        .insert({
          name: listName,
          file_name: parsedData.fileName,
          file_type: parsedData.fileType,
          column_mapping: mapping,
          original_headers: parsedData.headers,
          row_count: parsedData.rowCount,
          filter_columns: filterColumns, // Add filter columns for filtering UI
        })
        .select()
        .single()

      if (listError) throw listError

      // Import contacts in batches with rate limiting
      const batchSize = 100 // Increased batch size
      const delayBetweenBatches = 200 // ms delay to avoid rate limits
      let imported = 0
      let skipped = 0
      let batchNumber = 0
      const totalBatches = Math.ceil(parsedData.rows.length / batchSize)

      console.log(`Starting import: ${parsedData.rows.length} rows in ${totalBatches} batches`)

      for (let i = 0; i < parsedData.rows.length; i += batchSize) {
        batchNumber++
        const batch = parsedData.rows.slice(i, i + batchSize)
        
        const contacts = batch
          .map(row => {
            const contact = extractContact(row, mapping)
            // Skip rows with invalid/missing emails (extractContact returns null)
            if (!contact) return null
            return {
              ...contact,
              contact_list_id: contactList.id,
            }
          })
          .filter(Boolean)

        if (contacts.length > 0) {
          // Retry logic for rate limits
          let retries = 3
          let success = false
          
          while (retries > 0 && !success) {
            // Don't use .select() - Supabase has 1000 row return limit
            // Just count what we sent and check for errors
            const { error: insertError } = await supabase
              .from('contacts')
              .upsert(contacts, { 
                onConflict: 'email',
                ignoreDuplicates: false // Allow updates to existing
              })

            if (insertError) {
              console.error(`Batch ${batchNumber}/${totalBatches} error:`, insertError)
              if (insertError.message?.includes('rate') || insertError.code === '429') {
                retries--
                console.log(`Rate limited, retrying in 2s... (${retries} retries left)`)
                await new Promise(r => setTimeout(r, 2000))
              } else {
                skipped += contacts.length
                break
              }
            } else {
              imported += contacts.length
              success = true
            }
          }
          
          if (!success && retries === 0) {
            skipped += contacts.length
          }
        }

        skipped += batch.length - contacts.length
        setImportProgress(Math.round(((i + batch.length) / parsedData.rows.length) * 100))
        setImportedCount(imported)
        setSkippedCount(skipped)
        
        // Small delay between batches to avoid overwhelming Supabase
        if (i + batchSize < parsedData.rows.length) {
          await new Promise(r => setTimeout(r, delayBetweenBatches))
        }
        
        console.log(`Batch ${batchNumber}/${totalBatches}: imported ${imported}, skipped ${skipped}`)
      }

      // Update row count
      await supabase
        .from('contact_lists')
        .update({ row_count: imported })
        .eq('id', contactList.id)

      setImportedCount(imported)
      setSkippedCount(skipped)
      setStep('done')
    } catch (err: any) {
      setError(err.message)
      setStep('preview')
    }
  }

  // Render based on step
  const renderStep = () => {
    switch (step) {
      case 'upload':
        return renderUploadStep()
      case 'mapping':
        return renderMappingStep()
      case 'preview':
        return renderPreviewStep()
      case 'importing':
        return renderImportingStep()
      case 'done':
        return renderDoneStep()
    }
  }

  const renderUploadStep = () => (
    <>
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Import Contacts</h2>
        <p className="text-sm text-gray-500 mt-1">
          Upload a CSV or Excel file with your contacts
        </p>
      </div>

      <div className="p-6">
        <div
          className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
            dragActive 
              ? 'border-brand-500 bg-brand-50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileInput}
            className="hidden"
          />
          
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileSpreadsheet className="h-8 w-8 text-gray-400" />
          </div>
          
          <p className="text-gray-900 font-medium mb-2">
            Drag and drop your file here
          </p>
          <p className="text-gray-500 text-sm mb-4">
            or
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
          >
            Browse Files
          </button>
          <p className="text-xs text-gray-400 mt-4">
            Supports CSV, XLSX, and XLS files
          </p>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>
    </>
  )

  const renderMappingStep = () => {
    if (!parsedData) return null

    const fields: { key: keyof ColumnMapping; label: string; required?: boolean }[] = [
      { key: 'email', label: 'Email', required: true },
      { key: 'first_name', label: 'First Name', required: true },
      { key: 'last_name', label: 'Last Name' },
      { key: 'firm', label: 'Firm / Company' },
      { key: 'role', label: 'Role / Title' },
      { key: 'geography', label: 'Geography / Location' },
      { key: 'investment_focus', label: 'Investment Focus' },
      { key: 'notes_private', label: 'Notes' },
    ]

    return (
      <>
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Map Columns</h2>
          <p className="text-sm text-gray-500 mt-1">
            Match your spreadsheet columns to contact fields
          </p>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {/* List name */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              List Name
            </label>
            <input
              type="text"
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              placeholder="e.g., Q1 2026 VC List"
            />
          </div>

          {/* File info */}
          <div className="mb-6 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="font-medium">{parsedData.fileName}</span>
              <span className="text-gray-400">•</span>
              <span>{parsedData.rowCount} rows</span>
              <span className="text-gray-400">•</span>
              <span>{parsedData.headers.length} columns</span>
            </div>
          </div>

          {/* Column mappings */}
          <div className="space-y-4">
            {fields.map(({ key, label, required }) => (
              <div key={key} className="flex items-center space-x-4">
                <div className="w-40 flex-shrink-0">
                  <span className="text-sm font-medium text-gray-700">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                  </span>
                </div>
                <div className="flex-1">
                  <select
                    value={mapping[key] || ''}
                    onChange={(e) => updateMapping(key, e.target.value || undefined)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 ${
                      mapping[key] ? 'border-green-300 bg-green-50' : 'border-gray-300'
                    }`}
                  >
                    <option value="">-- Select column --</option>
                    {parsedData.headers.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>
                {mapping[key] && (
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-between">
          <button
            onClick={() => {
              setStep('upload')
              setParsedData(null)
              setMapping({})
            }}
            className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>
          <button
            onClick={handleContinueToPreview}
            className="flex items-center space-x-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700"
          >
            <span>Preview</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </>
    )
  }

  const renderPreviewStep = () => {
    if (!parsedData) return null

    // Show first 5 rows as preview (filter out any with invalid emails)
    const previewRows = parsedData.rows.slice(0, 5)
      .map(row => extractContact(row, mapping))
      .filter((contact): contact is NonNullable<typeof contact> => contact !== null)

    return (
      <>
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Preview Import</h2>
          <p className="text-sm text-gray-500 mt-1">
            Review how your contacts will be imported
          </p>
        </div>

        <div className="p-6 max-h-[60vh] overflow-auto">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm text-gray-600">
              Showing first 5 of {parsedData.rowCount} contacts
            </span>
            <span className="px-2 py-1 bg-brand-100 text-brand-700 text-xs rounded-full font-medium">
              {listName}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Firm</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {previewRows.map((contact, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {contact.first_name} {contact.last_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{contact.email || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{contact.firm || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{contact.role || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{contact.geography || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-between">
          <button
            onClick={() => setStep('mapping')}
            className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>
          <button
            onClick={handleImport}
            className="flex items-center space-x-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700"
          >
            <Upload className="h-4 w-4" />
            <span>Import {parsedData.rowCount} Contacts</span>
          </button>
        </div>
      </>
    )
  }

  const renderImportingStep = () => (
    <>
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Importing...</h2>
      </div>

      <div className="p-12 flex flex-col items-center">
        <Loader2 className="h-12 w-12 text-brand-600 animate-spin mb-6" />
        <p className="text-gray-900 font-medium mb-2">Importing contacts...</p>
        <p className="text-gray-500 text-sm mb-4">Processing {parsedData?.rowCount.toLocaleString() || 0} contacts in batches</p>
        
        <div className="w-full max-w-xs mb-4">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-brand-600 transition-all duration-300"
              style={{ width: `${importProgress}%` }}
            />
          </div>
          <p className="text-center text-sm text-gray-500 mt-2">{importProgress}%</p>
        </div>
        
        <div className="flex gap-6 text-sm">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{importedCount.toLocaleString()}</p>
            <p className="text-gray-500">Imported</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-500">{skippedCount.toLocaleString()}</p>
            <p className="text-gray-500">Skipped</p>
          </div>
        </div>
      </div>
    </>
  )

  const renderDoneStep = () => (
    <>
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Import Complete</h2>
      </div>

      <div className="p-12 flex flex-col items-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <p className="text-gray-900 font-medium text-lg mb-2">
          Successfully imported {importedCount} contacts
        </p>
        {skippedCount > 0 && (
          <p className="text-gray-500 text-sm">
            {skippedCount} contacts skipped (duplicates or invalid)
          </p>
        )}
        <p className="text-gray-400 text-sm mt-4">
          List: {listName}
        </p>
      </div>

      <div className="p-6 border-t border-gray-200 flex justify-end">
        <button
          onClick={() => {
            onImported()
            onClose()
          }}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700"
        >
          Done
        </button>
      </div>
    </>
  )

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Close button */}
        {step !== 'importing' && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {renderStep()}
      </div>
    </div>
  )
}
