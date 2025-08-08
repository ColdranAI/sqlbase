"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { ProjectDashboard } from "@/components/project-dashboard"
import { Skeleton } from "@/components/ui/skeleton"

interface UserSession {
  user: {
    id: string
    name: string
    email: string
    image?: string
    emailVerified: boolean
  }
}

export default function OrganizationProjectPage() {
  const params = useParams()
  const router = useRouter()
  const orgId = params.orgId as string
  const projectId = params.projectId as string

  const [session, setSession] = useState<UserSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data } = await authClient.getSession()
        if (data?.user) {
          setSession(data as UserSession)
        } else {
          router.push("/auth/signin")
        }
      } catch (error) {
        console.error("Failed to check session:", error)
        router.push("/auth/signin")
      } finally {
        setIsLoading(false)
      }
    }

    checkSession()
  }, [router])

  if (isLoading) {
    return (
      <div className="dark bg-neutral-950 min-h-screen">
        <div className="flex-1 p-6 overflow-hidden">
          <div className="h-full max-w-7xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-8 w-8 bg-neutral-800" />
              <Skeleton className="h-8 w-64 bg-neutral-800" />
            </div>
            <Skeleton className="h-32 w-full bg-neutral-800" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Skeleton className="h-96 lg:col-span-2 bg-neutral-800" />
              <Skeleton className="h-96 bg-neutral-800" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="dark bg-neutral-950 min-h-screen">
      <div className="flex-1 p-6 overflow-hidden">
        <div className="h-full max-w-7xl mx-auto">
          <ProjectDashboard
            userId={session.user.id}
            organizationId={orgId}
            projectId={projectId}
          />
        </div>
      </div>
    </div>
  )
} 