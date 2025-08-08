"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiClient, type Organization, type OrganizationMember, type OrganizationInvitation } from "@/lib/api"
import { 
  Users, 
  Crown, 
  Shield, 
  User, 
  MoreHorizontal, 
  UserMinus,
  Mail,
  Clock,
  X,
  RefreshCw,
  Loader2
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface OrganizationMembersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organization: Organization
  userId: string
}

export function OrganizationMembersDialog({
  open,
  onOpenChange,
  organization,
  userId,
}: OrganizationMembersDialogProps) {
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open, organization.id, userId])

  const loadData = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // For now, use mock data since backend might not be ready
      const mockMembers: OrganizationMember[] = [
        {
          id: 'member-1',
          organization_id: organization.id,
          user_id: userId,
          email: 'you@example.com',
          role: 'owner',
          status: 'active',
          joined_at: new Date().toISOString(),
          invited_at: new Date().toISOString(),
          invited_by: userId,
          user: {
            id: userId,
            name: 'You',
            email: 'you@example.com',
            image: undefined
          }
        }
      ]

      const mockInvitations: OrganizationInvitation[] = [
        {
          id: 'inv-1',
          organization_id: organization.id,
          email: 'pending@example.com',
          role: 'member',
          status: 'pending',
          invited_by: userId,
          invited_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(), // 7 days from now
          token: 'mock-token',
          inviter: {
            name: 'You',
            email: 'you@example.com'
          },
          organization: {
            name: organization.name,
            slug: organization.slug
          }
        }
      ]

      setMembers(mockMembers)
      setInvitations(mockInvitations)
    } catch (error) {
      console.error("Failed to load organization data:", error)
      setError(error instanceof Error ? error.message : "Failed to load organization data")
    } finally {
      setIsLoading(false)
    }
  }

  const handleRoleChange = async (memberId: string, newRole: 'admin' | 'member') => {
    setIsUpdating(memberId)
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setMembers(prev => prev.map(member => 
        member.id === memberId ? { ...member, role: newRole } : member
      ))
    } catch (error) {
      console.error("Failed to update member role:", error)
      setError(error instanceof Error ? error.message : "Failed to update member role")
    } finally {
      setIsUpdating(null)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    setIsUpdating(memberId)
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setMembers(prev => prev.filter(member => member.id !== memberId))
    } catch (error) {
      console.error("Failed to remove member:", error)
      setError(error instanceof Error ? error.message : "Failed to remove member")
    } finally {
      setIsUpdating(null)
    }
  }

  const handleCancelInvitation = async (invitationId: string) => {
    setIsUpdating(invitationId)
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId))
    } catch (error) {
      console.error("Failed to cancel invitation:", error)
      setError(error instanceof Error ? error.message : "Failed to cancel invitation")
    } finally {
      setIsUpdating(null)
    }
  }

  const handleResendInvitation = async (invitationId: string) => {
    setIsUpdating(invitationId)
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Update invitation timestamp
      setInvitations(prev => prev.map(inv => 
        inv.id === invitationId 
          ? { ...inv, invited_at: new Date().toISOString() }
          : inv
      ))
    } catch (error) {
      console.error("Failed to resend invitation:", error)
      setError(error instanceof Error ? error.message : "Failed to resend invitation")
    } finally {
      setIsUpdating(null)
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown className="h-4 w-4 text-yellow-500" />
      case 'admin': return <Shield className="h-4 w-4 text-blue-500" />
      default: return <User className="h-4 w-4 text-neutral-400" />
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-yellow-600 text-white'
      case 'admin': return 'bg-blue-600 text-white'
      default: return 'bg-neutral-700 text-neutral-300'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  const currentUser = members.find(m => m.user_id === userId)
  const isOwner = currentUser?.role === 'owner'
  const isAdmin = currentUser?.role === 'admin' || isOwner

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-neutral-100">
            <Users className="h-5 w-5" />
            {organization.name} Members
          </DialogTitle>
          <DialogDescription className="text-neutral-400">
            Manage members and pending invitations for your organization.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="members" className="flex-1 overflow-hidden px-6">
          <TabsList className="grid w-full grid-cols-2 bg-neutral-800">
            <TabsTrigger value="members" className="data-[state=active]:bg-neutral-700">
              Members ({members.length})
            </TabsTrigger>
            <TabsTrigger value="invitations" className="data-[state=active]:bg-neutral-700">
              Pending ({invitations.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="mt-4 overflow-y-auto flex-1">
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-neutral-800/50">
                    <div className="w-10 h-10 rounded-full bg-neutral-700 animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-neutral-700 rounded animate-pulse" />
                      <div className="h-3 bg-neutral-700 rounded w-2/3 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="p-4 bg-red-900/20 border border-red-800 rounded-md">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg bg-neutral-800/50 hover:bg-neutral-800/70 transition-colors">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.user?.image} />
                      <AvatarFallback className="bg-neutral-700 text-neutral-200">
                        {getInitials(member.user?.name || member.email)}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-neutral-100 truncate">
                          {member.user?.name || member.email}
                          {member.user_id === userId && (
                            <span className="text-neutral-400 font-normal ml-1">(You)</span>
                          )}
                        </p>
                        {getRoleIcon(member.role)}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm text-neutral-400 truncate">{member.email}</p>
                        <Badge className={getRoleBadgeColor(member.role)}>
                          {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                        </Badge>
                      </div>
                      <p className="text-xs text-neutral-500 mt-1">
                        Joined {formatDate(member.joined_at)}
                      </p>
                    </div>

                    {isAdmin && member.user_id !== userId && member.role !== 'owner' && (
                      <div className="flex items-center gap-2">
                        <Select
                          value={member.role}
                          onValueChange={(value: 'admin' | 'member') => handleRoleChange(member.id, value)}
                          disabled={isUpdating === member.id}
                        >
                          <SelectTrigger className="w-32 bg-neutral-700 border-neutral-600 text-neutral-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-neutral-800 border-neutral-700">
                            <SelectItem value="member" className="text-neutral-100">Member</SelectItem>
                            <SelectItem value="admin" className="text-neutral-100">Admin</SelectItem>
                          </SelectContent>
                        </Select>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              disabled={isUpdating === member.id}
                              className="h-8 w-8 p-0 text-neutral-400 hover:text-neutral-200"
                            >
                              {isUpdating === member.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="bg-neutral-800 border-neutral-700">
                            <DropdownMenuItem
                              onClick={() => handleRemoveMember(member.id)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                            >
                              <UserMinus className="h-4 w-4 mr-2" />
                              Remove member
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="invitations" className="mt-4 overflow-y-auto flex-1">
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-neutral-800/50">
                    <div className="w-10 h-10 rounded-full bg-neutral-700 animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-neutral-700 rounded animate-pulse" />
                      <div className="h-3 bg-neutral-700 rounded w-2/3 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : invitations.length === 0 ? (
              <div className="text-center py-8">
                <Mail className="h-12 w-12 text-neutral-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-neutral-300 mb-2">No pending invitations</h3>
                <p className="text-neutral-500">All invitations have been accepted or have expired.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {invitations.map((invitation) => (
                  <div key={invitation.id} className="flex items-center gap-3 p-3 rounded-lg bg-neutral-800/50 hover:bg-neutral-800/70 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-neutral-700 flex items-center justify-center">
                      <Mail className="h-5 w-5 text-neutral-400" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-neutral-100 truncate">{invitation.email}</p>
                        <Badge 
                          variant="secondary"
                          className="bg-yellow-600/20 text-yellow-400 border-yellow-600/30"
                        >
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={getRoleBadgeColor(invitation.role)}>
                          {invitation.role.charAt(0).toUpperCase() + invitation.role.slice(1)}
                        </Badge>
                      </div>
                      <p className="text-xs text-neutral-500 mt-1">
                        Invited {formatDate(invitation.invited_at)} • Expires {formatDate(invitation.expires_at)}
                      </p>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResendInvitation(invitation.id)}
                          disabled={isUpdating === invitation.id}
                          className="text-neutral-400 hover:text-neutral-200"
                        >
                          {isUpdating === invitation.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancelInvitation(invitation.id)}
                          disabled={isUpdating === invitation.id}
                          className="text-red-400 hover:text-red-300"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end p-6 pt-4 border-t border-neutral-800">
          <Button
            onClick={() => onOpenChange(false)}
            className="bg-white text-neutral-900 hover:bg-neutral-100"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
} 