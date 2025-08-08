"use client"

import { useEffect, useState } from "react"
import { authClient } from "@/lib/auth-client"
import { apiClient } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"
import { Database } from "lucide-react"
import { useRouter } from "next/navigation"
import { OrganizationDashboard } from "@/components/organization-dashboard"

interface UserSession {
  user: {
    id: string
    name: string
    email: string
    image?: string
    emailVerified: boolean
  }
  session: {
    id: string
    userId: string
    expiresAt: Date
  }
}

export default function DashboardPage() {
  const [session, setSession] = useState<UserSession | null>(null)
  const [isCheckingOrganizations, setIsCheckingOrganizations] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const fetchSessionAndCheckOrganizations = async () => {
      try {
        const { data } = await authClient.getSession()
        if (data) {
          setSession(data as UserSession)
          
          // Check if user has any organizations
          const orgsResponse = await apiClient.getOrganizations(data.user.id)
          if (orgsResponse.data && orgsResponse.data.length === 0) {
            // User has no organizations, redirect to onboarding
            router.push("/onboarding")
            return
          }
        }
      } catch (error) {
        console.error("Failed to fetch session or check organizations:", error)
      } finally {
        setIsCheckingOrganizations(false)
      }
    }

    fetchSessionAndCheckOrganizations()
  }, [router])

  const handleSignOut = async () => {
    try {
      await authClient.signOut()
      router.push("/")
    } catch (error) {
      console.error("Failed to sign out:", error)
    }
  }

  return (
    <div className="dark bg-neutral-950 min-h-screen">
      {/* Content */}
      <div className="flex-1 p-6 overflow-hidden">
        <div className="h-full max-w-7xl mx-auto">
          {isCheckingOrganizations ? (
            <div className="space-y-6">
              <div className="text-center py-12">
                <Database className="h-12 w-12 mx-auto text-neutral-400 mb-4" />
                <div className="space-y-2">
                  <Skeleton className="h-6 w-48 bg-neutral-800 mx-auto" />
                  <Skeleton className="h-4 w-64 bg-neutral-800 mx-auto" />
                </div>
              </div>
            </div>
          ) : session?.user ? (
            <OrganizationDashboard userId={session.user.id} userName={session.user.name} />
          ) : (
            <div className="space-y-6">
              <div className="text-center py-12">
                <Database className="h-12 w-12 mx-auto text-neutral-400 mb-4" />
                <div className="space-y-2">
                  <Skeleton className="h-6 w-48 bg-neutral-800 mx-auto" />
                  <Skeleton className="h-4 w-64 bg-neutral-800 mx-auto" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
