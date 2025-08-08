"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { apiClient, type Project, type UpdatedProject } from "@/lib/api"
import { FolderOpen, Loader2 } from "lucide-react"

interface CreateProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onProjectCreated: (project: Project | UpdatedProject) => void
  userId: string
  organizationId?: string // Optional for backward compatibility
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  onProjectCreated,
  userId,
  organizationId,
}: CreateProjectDialogProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError("Project name is required")
      return
    }

    setIsCreating(true)

    try {
      if (organizationId) {
        // Organization-based project
        const mockProject: UpdatedProject = {
          id: `proj-${Date.now()}`,
          name: name.trim(),
          description: description.trim() || undefined,
          created_at: new Date().toISOString(),
          last_activity: new Date().toISOString(),
          database_connected: false,
          database_type: undefined,
          organization_id: organizationId,
          organization: {
            name: "Current Organization", // This would come from props in real implementation
            slug: "current-org"
          }
        }

        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000))

        onProjectCreated(mockProject)
      } else {
        // Personal project (legacy)
        const mockProject: Project = {
          id: `proj-${Date.now()}`,
          name: name.trim(),
          description: description.trim() || undefined,
          created_at: new Date().toISOString(),
          last_activity: new Date().toISOString(),
          database_connected: false,
          database_type: undefined
        }

        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000))

        onProjectCreated(mockProject)
      }
      
      // Reset form
      setName("")
      setDescription("")
    } catch (error) {
      console.error("Failed to create project:", error)
      setError(error instanceof Error ? error.message : "Failed to create project")
    } finally {
      setIsCreating(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isCreating) {
      onOpenChange(newOpen)
      if (!newOpen) {
        setName("")
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
            <FolderOpen className="h-5 w-5" />
            Create Project
          </DialogTitle>
          <DialogDescription className="text-neutral-400">
            {organizationId 
              ? "Create a new project in your organization for database management and collaboration."
              : "Create a new project for database management."
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-neutral-200">
              Project Name
            </Label>
            <Input
              id="name"
              placeholder="My Database Project"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isCreating}
              className="bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-400"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-neutral-200">
              Description (Optional)
            </Label>
            <Textarea
              id="description"
              placeholder="Brief description of your project"
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
              disabled={isCreating || !name.trim()}
              className="flex-1 bg-white text-neutral-900 hover:bg-neutral-100"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Project"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
} 