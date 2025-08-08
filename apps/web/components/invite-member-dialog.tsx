"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { apiClient, type Organization, type UpdatedProject } from "@/lib/api"
import { UserPlus, Loader2, Mail, X, FolderOpen, Database } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface InviteMemberDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organization: Organization
  userId: string
  // If projectId is provided, it's a project-specific invitation
  projectId?: string
  projectName?: string
}

export function InviteMemberDialog({
  open,
  onOpenChange,
  organization,
  userId,
  projectId,
  projectName
}: InviteMemberDialogProps) {
  const [emails, setEmails] = useState<string[]>([])
  const [currentEmail, setCurrentEmail] = useState("")
  const [role, setRole] = useState<"admin" | "member">("member")
  const [message, setMessage] = useState("")
  const [projectAccessType, setProjectAccessType] = useState<"all" | "specific">("all")
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [projects, setProjects] = useState<UpdatedProject[]>([])
  const [isSending, setIsSending] = useState(false)
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Load projects when dialog opens (only for organization-level invites)
  useEffect(() => {
    if (open && !projectId) {
      loadProjects()
    }
  }, [open, projectId])

  // Reset form when project changes
  useEffect(() => {
    if (projectId) {
      setProjectAccessType("specific")
      setSelectedProjects([projectId])
    }
  }, [projectId])

  const loadProjects = async () => {
    setIsLoadingProjects(true)
    try {
      const response = await apiClient.getOrganizationProjects(userId, organization.id)
      if (response.data) {
        setProjects(response.data)
      }
    } catch (error) {
      console.error("Failed to load projects:", error)
    } finally {
      setIsLoadingProjects(false)
    }
  }

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleAddEmail = () => {
    const email = currentEmail.trim().toLowerCase()
    
    if (!email) return
    
    if (!validateEmail(email)) {
      setError("Please enter a valid email address")
      return
    }
    
    if (emails.includes(email)) {
      setError("This email has already been added")
      return
    }
    
    setEmails([...emails, email])
    setCurrentEmail("")
    setError(null)
  }

  const handleRemoveEmail = (emailToRemove: string) => {
    setEmails(emails.filter(email => email !== emailToRemove))
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddEmail()
    }
  }

  const handleProjectSelection = (projectId: string, checked: boolean) => {
    setSelectedProjects(prev =>
      checked 
        ? [...prev, projectId]
        : prev.filter(id => id !== projectId)
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (emails.length === 0) {
      setError("Please add at least one email address")
      return
    }

    if (!projectId && projectAccessType === "specific" && selectedProjects.length === 0) {
      setError("Please select at least one project for specific access")
      return
    }

    setIsSending(true)

    try {
      const invitations = []
      
      for (const email of emails) {
        let response
        
        if (projectId) {
          // Project-specific invitation
          response = await apiClient.inviteToProject(userId, organization.id, projectId, {
            email,
            role,
            message
          })
        } else {
          // Organization-level invitation
          response = await apiClient.inviteToOrganization(userId, organization.id, {
            email,
            role,
            message,
            project_access_type: projectAccessType,
            specific_projects: projectAccessType === 'specific' ? selectedProjects : undefined
          })
        }

        if (response.error) {
          throw new Error(`Failed to invite ${email}: ${response.error}`)
        }

        invitations.push(response.data)
      }

      setSuccess(`Successfully sent ${invitations.length} invitation${invitations.length > 1 ? 's' : ''}`)
      
      // Reset form after successful send
      setTimeout(() => {
        setEmails([])
        setCurrentEmail("")
        setMessage("")
        setRole("member")
        setProjectAccessType("all")
        setSelectedProjects([])
        setSuccess(null)
        onOpenChange(false)
      }, 2000)
    } catch (error) {
      console.error("Failed to send invitations:", error)
      setError(error instanceof Error ? error.message : "Failed to send invitations")
    } finally {
      setIsSending(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isSending) {
      onOpenChange(newOpen)
      if (!newOpen) {
        setEmails([])
        setCurrentEmail("")
        setMessage("")
        setRole("member")
        setProjectAccessType("all")
        setSelectedProjects([])
        setError(null)
        setSuccess(null)
      }
    }
  }

  const getDefaultMessage = () => {
    if (projectId && projectName) {
      return `Hi there!\n\nYou've been invited to collaborate on the "${projectName}" project in ${organization.name} on SQLBase.\n\nClick the link below to accept the invitation and get started.`
    }
    return `Hi there!\n\nYou've been invited to join ${organization.name} on SQLBase. You'll be able to collaborate on database projects and manage your data together.\n\nClick the link below to accept the invitation and get started.`
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-neutral-100">
            {projectId ? <Database className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
            {projectId ? `Invite to "${projectName}"` : "Invite Members"}
          </DialogTitle>
          <DialogDescription className="text-neutral-400">
            {projectId 
              ? `Invite team members to collaborate on the "${projectName}" project. They'll have access to this specific project within ${organization.name}.`
              : `Invite team members to join ${organization.name}. They'll receive an email with an invitation link.`
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-neutral-200">
              Email Addresses
            </Label>
            <div className="flex gap-2">
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={currentEmail}
                onChange={(e) => setCurrentEmail(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isSending}
                className="bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-400"
              />
              <Button
                type="button"
                onClick={handleAddEmail}
                disabled={isSending || !currentEmail.trim()}
                variant="outline"
                size="sm"
                className="border-neutral-700 bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-200"
              >
                Add
              </Button>
            </div>
            
            {emails.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {emails.map((email) => (
                  <Badge
                    key={email}
                    variant="secondary"
                    className="bg-neutral-700 text-neutral-200 hover:bg-neutral-600"
                  >
                    <Mail className="h-3 w-3 mr-1" />
                    {email}
                    <button
                      type="button"
                      onClick={() => handleRemoveEmail(email)}
                      disabled={isSending}
                      className="ml-2 hover:text-red-400"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role" className="text-neutral-200">
              Role
            </Label>
            <Select value={role} onValueChange={(value: "admin" | "member") => setRole(value)} disabled={isSending}>
              <SelectTrigger className="bg-neutral-800 border-neutral-700 text-neutral-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-neutral-800 border-neutral-700">
                <SelectItem value="member" className="text-neutral-100 hover:bg-neutral-700">
                  Member - Can access projects and query databases
                </SelectItem>
                <SelectItem value="admin" className="text-neutral-100 hover:bg-neutral-700">
                  Admin - Can manage team members and organization settings
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Project Access Selection (only for organization-level invites) */}
          {!projectId && (
            <div className="space-y-3">
              <Label className="text-neutral-200">Project Access</Label>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="all-projects"
                    name="projectAccess"
                    value="all"
                    checked={projectAccessType === "all"}
                    onChange={() => {
                      setProjectAccessType("all")
                      setSelectedProjects([])
                    }}
                    disabled={isSending}
                    className="text-blue-600"
                  />
                  <Label htmlFor="all-projects" className="text-neutral-300 cursor-pointer">
                    All projects (current and future)
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="specific-projects"
                    name="projectAccess"
                    value="specific"
                    checked={projectAccessType === "specific"}
                    onChange={() => setProjectAccessType("specific")}
                    disabled={isSending}
                    className="text-blue-600"
                  />
                  <Label htmlFor="specific-projects" className="text-neutral-300 cursor-pointer">
                    Specific projects only
                  </Label>
                </div>

                {/* Project Selection */}
                {projectAccessType === "specific" && (
                  <Card className="border-neutral-700 bg-neutral-800/50">
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-neutral-400">Select Projects</Label>
                        {isLoadingProjects ? (
                          <div className="flex items-center gap-2 text-neutral-400">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading projects...
                          </div>
                        ) : projects.length === 0 ? (
                          <p className="text-sm text-neutral-500">No projects found. Create a project first.</p>
                        ) : (
                          <div className="space-y-2 max-h-32 overflow-y-auto">
                            {projects.map((project) => (
                              <div key={project.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`project-${project.id}`}
                                  checked={selectedProjects.includes(project.id)}
                                  onCheckedChange={(checked) => handleProjectSelection(project.id, !!checked)}
                                  disabled={isSending}
                                />
                                <Label 
                                  htmlFor={`project-${project.id}`} 
                                  className="text-neutral-300 cursor-pointer flex items-center gap-2"
                                >
                                  <FolderOpen className="h-4 w-4" />
                                  {project.name}
                                </Label>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="message" className="text-neutral-200">
              Personal Message (Optional)
            </Label>
            <Textarea
              id="message"
              placeholder={getDefaultMessage()}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isSending}
              className="bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-400 resize-none"
              rows={4}
            />
            <p className="text-xs text-neutral-500">
              {message.trim() ? "Your custom message will be included in the invitation email." : "A default invitation message will be sent."}
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-900/20 border border-red-800 rounded-md">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-900/20 border border-green-800 rounded-md">
              <p className="text-sm text-green-400">{success}</p>
            </div>
          )}

          <div className="flex items-center gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSending}
              className="flex-1 border-neutral-700 bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-200"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isSending || 
                emails.length === 0 || 
                (projectAccessType === "specific" && selectedProjects.length === 0 && !projectId)
              }
              className="flex-1 bg-white text-neutral-900 hover:bg-neutral-100"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                `Send ${emails.length > 0 ? emails.length : ''} Invitation${emails.length !== 1 ? 's' : ''}`
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
} 