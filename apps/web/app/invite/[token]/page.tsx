"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { apiClient, type OrganizationInvitation } from "@/lib/api"
import { Building, Users, Mail, Calendar, Shield, User, Crown, Loader2, AlertCircle } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import Link from "next/link"

export default function InvitePage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [invitation, setInvitation] = useState<OrganizationInvitation | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAccepting, setIsAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    loadInvitationDetails()
    checkAuthStatus()
  }, [token])

  const checkAuthStatus = async () => {
    try {
      const { data } = await authClient.getSession()
      setIsAuthenticated(!!data)
    } catch (error) {
      setIsAuthenticated(false)
    }
  }

  const loadInvitationDetails = async () => {
    if (!token) return

    setIsLoading(true)
    setError(null)

    try {
      // For now, use mock invitation data since backend might not be ready
      const mockInvitation: OrganizationInvitation = {
        id: 'inv-1',
        organization_id: 'org-1',
        email: 'invited@example.com',
        role: 'member',
        status: 'pending',
        invited_by: 'user-1',
        invited_at: new Date(Date.now() - 86400000).toISOString(),
        expires_at: new Date(Date.now() + 6 * 86400000).toISOString(),
        token: token,
        inviter: {
          name: 'John Doe',
          email: 'john@example.com'
        },
        organization: {
          name: 'Acme Corp',
          slug: 'acme-corp'
        }
      }

      setInvitation(mockInvitation)
    } catch (error) {
      console.error("Failed to load invitation:", error)
      setError(error instanceof Error ? error.message : "Failed to load invitation")
    } finally {
      setIsLoading(false)
    }
  }

  const handleAcceptInvitation = async () => {
    if (!invitation) return

    setIsAccepting(true)
    setError(null)

    try {
      // For now, simulate accepting the invitation
      await new Promise(resolve => setTimeout(resolve, 2000))

      setSuccess(true)
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } catch (error) {
      console.error("Failed to accept invitation:", error)
      setError(error instanceof Error ? error.message : "Failed to accept invitation")
    } finally {
      setIsAccepting(false)
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
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const isExpired = invitation && new Date(invitation.expires_at) < new Date()
  const isAlreadyAccepted = invitation?.status === 'accepted'

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-neutral-900/50 border-neutral-800">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center mb-4">
              <Skeleton className="w-6 h-6 bg-neutral-700" />
            </div>
            <Skeleton className="h-6 w-48 bg-neutral-800 mx-auto mb-2" />
            <Skeleton className="h-4 w-64 bg-neutral-800 mx-auto" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-16 w-full bg-neutral-800" />
            <Skeleton className="h-10 w-full bg-neutral-800" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-neutral-900/50 border-neutral-800">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-900/20 flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6 text-red-400" />
            </div>
            <CardTitle className="text-neutral-100">Invalid Invitation</CardTitle>
            <CardDescription className="text-neutral-400">
              {error || "This invitation link is invalid or has expired."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full bg-white text-neutral-900 hover:bg-neutral-100">
              <Link href="/">Go to Homepage</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-neutral-900/50 border-neutral-800">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-900/20 flex items-center justify-center mb-4">
              <Building className="w-6 h-6 text-green-400" />
            </div>
            <CardTitle className="text-neutral-100">Welcome to {invitation.organization?.name}!</CardTitle>
            <CardDescription className="text-neutral-400">
              You've successfully joined the organization. Redirecting to your dashboard...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg bg-neutral-900/50 border-neutral-800">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-blue-900/20 flex items-center justify-center mb-4">
            <Building className="w-6 h-6 text-blue-400" />
          </div>
          <CardTitle className="text-neutral-100">
            You're invited to join {invitation.organization?.name}
          </CardTitle>
          <CardDescription className="text-neutral-400">
            {invitation.inviter?.name} ({invitation.inviter?.email}) has invited you to collaborate on projects.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Organization Details */}
          <div className="p-4 bg-neutral-800/50 rounded-lg border border-neutral-800">
            <div className="flex items-center gap-3 mb-3">
              <Building className="h-5 w-5 text-blue-400" />
              <div>
                <h3 className="font-medium text-neutral-100">{invitation.organization?.name}</h3>
                <p className="text-sm text-neutral-400">@{invitation.organization?.slug}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                {getRoleIcon(invitation.role)}
                <span className="text-neutral-300">Your role:</span>
                <Badge className={getRoleBadgeColor(invitation.role)}>
                  {invitation.role.charAt(0).toUpperCase() + invitation.role.slice(1)}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-neutral-400" />
                <span className="text-neutral-300">Invited:</span>
                <span className="text-neutral-400">{invitation.email}</span>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-neutral-400" />
                <span className="text-neutral-300">Sent:</span>
                <span className="text-neutral-400">{formatDate(invitation.invited_at)}</span>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-neutral-400" />
                <span className="text-neutral-300">Expires:</span>
                <span className="text-neutral-400">{formatDate(invitation.expires_at)}</span>
              </div>
            </div>
          </div>

          {/* Status Messages */}
          {isExpired && (
            <div className="p-3 bg-red-900/20 border border-red-800 rounded-md">
              <p className="text-sm text-red-400">This invitation has expired.</p>
            </div>
          )}

          {isAlreadyAccepted && (
            <div className="p-3 bg-yellow-900/20 border border-yellow-800 rounded-md">
              <p className="text-sm text-yellow-400">This invitation has already been accepted.</p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            {!isAuthenticated ? (
              <div className="space-y-2">
                <p className="text-sm text-neutral-400 text-center">
                  You need to sign in to accept this invitation
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button asChild variant="outline" className="border-neutral-700 bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-200">
                    <Link href={`/auth/signin?callbackUrl=/invite/${token}`}>
                      Sign In
                    </Link>
                  </Button>
                  <Button asChild className="bg-white text-neutral-900 hover:bg-neutral-100">
                    <Link href={`/auth/signup?callbackUrl=/invite/${token}`}>
                      Sign Up
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                onClick={handleAcceptInvitation}
                disabled={isAccepting || isExpired || isAlreadyAccepted}
                className="w-full bg-white text-neutral-900 hover:bg-neutral-100"
              >
                {isAccepting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Accepting invitation...
                  </>
                ) : (
                  <>
                    <Users className="h-4 w-4 mr-2" />
                    Accept invitation
                  </>
                )}
              </Button>
            )}

            <Button 
              asChild 
              variant="outline" 
              className="w-full border-neutral-700 bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-200"
            >
              <Link href="/">Maybe later</Link>
            </Button>
          </div>

          {error && (
            <div className="p-3 bg-red-900/20 border border-red-800 rounded-md">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 