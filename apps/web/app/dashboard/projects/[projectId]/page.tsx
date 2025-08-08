"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { apiClient, type Project } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, Database, Settings, Calendar } from "lucide-react"
import Link from "next/link"
import { DatabaseConnection } from "@/components/database-connection"
import { SQLPlayground } from "@/components/sql-playground"
import { DatabaseOverview } from "@/components/database-overview"

interface UserSession {
  user: {
    id: string
    name: string
    email: string
    image?: string
    emailVerified: boolean
  }
}

export default function ProjectPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string
  
  const [session, setSession] = useState<UserSession | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [hasDbConnection, setHasDbConnection] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: sessionData } = await authClient.getSession()
        if (!sessionData) {
          router.push("/auth/signin")
          return
        }

        setSession(sessionData as UserSession)
        
        // For now, create mock project data
        // TODO: Replace with real API call
        const mockProject: Project = {
          id: projectId,
          name: `Project ${projectId}`,
          description: "A sample project for database management",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          database_connected: false,
          last_activity: new Date().toISOString()
        }
        
        setProject(mockProject)
        setHasDbConnection(mockProject.database_connected)
      } catch (error) {
        console.error("Failed to fetch project data:", error)
        setError("Failed to load project")
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [projectId, router])

  const handleDatabaseConnected = () => {
    setHasDbConnection(true)
    if (project) {
      setProject({ ...project, database_connected: true })
    }
  }

  const handleDisconnectDatabase = async () => {
    setHasDbConnection(false)
    if (project) {
      setProject({ ...project, database_connected: false })
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (isLoading) {
    return (
      <div className="dark bg-neutral-950 min-h-screen">
        <div className="p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-32 bg-neutral-800" />
              <Skeleton className="h-8 w-48 bg-neutral-800" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-32 w-full bg-neutral-800" />
              <Skeleton className="h-64 w-full bg-neutral-800" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !project || !session) {
    return (
      <div className="dark bg-neutral-950 min-h-screen">
        <div className="p-6">
          <div className="max-w-7xl mx-auto">
            <Card className="border border-red-800 bg-red-900/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <Database className="h-5 w-5 text-red-400" />
                  <div>
                    <h4 className="font-medium text-red-400">Failed to load project</h4>
                    <p className="text-sm text-red-300 mt-1">{error || "Project not found"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dark bg-neutral-950 min-h-screen">
      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="outline" size="sm" className="border-neutral-700 bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-200">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Projects
                </Button>
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold text-neutral-100">{project.name}</h1>
                  <Badge 
                    variant={hasDbConnection ? "default" : "secondary"}
                    className={hasDbConnection ? "bg-green-600 text-white" : "bg-neutral-700 text-neutral-300"}
                  >
                    {hasDbConnection ? "Database Connected" : "No Database"}
                  </Badge>
                </div>
                {project.description && (
                  <p className="text-neutral-400 mt-1">{project.description}</p>
                )}
                <div className="flex items-center gap-4 mt-2 text-sm text-neutral-500">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>Created {formatDate(project.created_at)}</span>
                  </div>
                  {project.database_type && (
                    <div className="flex items-center gap-1">
                      <Database className="h-4 w-4" />
                      <span className="capitalize">{project.database_type}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <Button variant="outline" size="sm" className="border-neutral-700 bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-200">
              <Settings className="h-4 w-4 mr-2" />
              Project Settings
            </Button>
          </div>

          {/* Content */}
          {hasDbConnection ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 border border-green-800 bg-green-900/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <Database className="h-6 w-6 text-green-500" />
                  <div>
                    <h3 className="font-medium text-green-400">Database Connected</h3>
                    <p className="text-sm text-green-300">Your database is ready for queries and management</p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleDisconnectDatabase}
                  className="border-green-700 bg-green-800/50 hover:bg-green-700/50 text-green-200"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Database Settings
                </Button>
              </div>
              
              {/* Database Overview - for project-specific database */}
              <DatabaseOverview userId={session.user.id} />
              
              {/* SQL Playground - for project-specific database */}
              <div className="pt-6">
                <SQLPlayground />
              </div>
            </div>
          ) : (
            <DatabaseConnection onConnectionSuccess={handleDatabaseConnected} />
          )}
        </div>
      </div>
    </div>
  )
} 