'use client'

import { createClient } from '@/lib/supabase/client'
import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, X, FileText } from 'lucide-react'

interface FileUploadProps {
  bucket: string
  folder?: string
  accept?: string
  label?: string
  value?: string | null
  onUpload: (url: string) => void
}

export function FileUpload({ bucket, folder, accept = '.pdf,.xml', label = 'Subir archivo', value, onUpload }: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const upload = useCallback(async (file: File) => {
    setUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const path = `${folder ? folder + '/' : ''}${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from(bucket).upload(path, file)
      if (error) throw error
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path)
      setFileName(file.name)
      onUpload(urlData.publicUrl)
    } catch (err) {
      console.error('Upload error:', err)
    } finally {
      setUploading(false)
    }
  }, [bucket, folder, onUpload])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }, [upload])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) upload(file)
  }, [upload])

  if (value || fileName) {
    return (
      <div className="flex items-center gap-2 rounded-md border p-2 bg-muted/50">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm truncate flex-1">{fileName || 'Archivo subido'}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setFileName(null)
            onUpload('')
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div
      className={`relative flex flex-col items-center justify-center rounded-md border-2 border-dashed p-4 transition-colors cursor-pointer ${
        dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept={accept}
        className="absolute inset-0 opacity-0 cursor-pointer"
        onChange={handleFileSelect}
        disabled={uploading}
      />
      <Upload className="h-6 w-6 text-muted-foreground mb-1" />
      <span className="text-sm text-muted-foreground">
        {uploading ? 'Subiendo...' : label}
      </span>
    </div>
  )
}
