"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { apiClient, type Organization } from "@/lib/api"
import { Building, Loader2 } from "lucide-react"

interface CreateOrganizationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOrganizationCreated: (organization: Organization) => void
  userId: string
}

export function CreateOrganizationDialog({
  open,
  onOpenChange,
  onOrganizationCreated,
  userId,
}: CreateOrganizationDialogProps) {
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  const handleNameChange = (value: string) => {
    setName(value)
    if (!slug || slug === generateSlug(name)) {
      setSlug(generateSlug(value))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError("Organization name is required")
      return
    }

    if (!slug.trim()) {
      setError("Organization slug is required")
      return
    }

    if (slug.length < 3) {
      setError("Organization slug must be at least 3 characters")
      return
    }

    setIsCreating(true)

    try {
      // For now, create a mock organization since backend might not be ready
      const mockOrganization: Organization = {
        id: `org-${Date.now()}`,
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        member_count: 1,
        project_count: 0,
        plan: 'free'
      }

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000))

      onOrganizationCreated(mockOrganization)
      
      setName("")
      setSlug("")
      setDescription("")
    } catch (error) {
      console.error("Failed to create organization:", error)
      setError(error instanceof Error ? error.message : "Failed to create organization")
    } finally {
      setIsCreating(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isCreating) {
      onOpenChange(newOpen)
      if (!newOpen) {
        setName("")
        setSlug("")
        setDescription("")
        setError(null)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-neutral-100">
            <Building className="h-5 w-5" />
            Create Organization
          </DialogTitle>
          <DialogDescription className="text-neutral-400">
            Create a new organization to collaborate with your team on projects.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-neutral-200">
              Organization Name
            </Label>
            <Input
              id="name"
              placeholder="Acme Corp"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              disabled={isCreating}
              className="bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-400"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug" className="text-neutral-200">
              Organization Slug
            </Label>
            <Input
              id="slug"
              placeholder="acme-corp"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              disabled={isCreating}
              className="bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-400"
              required
            />
            <p className="text-xs text-neutral-500">
              This will be used in URLs and must be unique.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-neutral-200">
              Description (Optional)
            </Label>
            <Textarea
              id="description"
              placeholder="Brief description of your organization"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isCreating}
              className="bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-400 resize-none"
              rows={3}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-900/20 border border-red-800 rounded-md">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div className="flex items-center gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isCreating}
              className="flex-1 border-neutral-700 bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-200"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isCreating || !name.trim() || !slug.trim()}
              className="flex-1 bg-white text-neutral-900 hover:bg-neutral-100"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Organization"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
} 