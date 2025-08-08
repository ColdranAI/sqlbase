"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { apiClient, type UpdatedProject, type Organization } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  Database, 
  Users, 
  Settings, 
  Activity, 
  Calendar, 
  Plus,
  ArrowLeft,
  AlertTriangle,
  Globe,
  Lock,
  UserPlus
} from "lucide-react"
import { DatabaseConnection } from "./database-connection"
import { DatabaseOverview } from "./database-overview"
import { SqlPlayground } from "./sql-playground"
import { InviteMemberDialog } from "./invite-member-dialog"

interface ProjectDashboardProps {
  userId: string
  organizationId: string
  projectId: string
}

export function ProjectDashboard({ userId, organizationId, projectId }: ProjectDashboardProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [project, setProject] = useState<UpdatedProject | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false)

  useEffect(() => {
    loadData()
  }, [userId, organizationId, projectId])

  const loadData = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      // Load project details
      const projectResponse = await apiClient.getProject(userId, organizationId, projectId)
      if (projectResponse.error) {
        throw new Error(projectResponse.error)
      }
      
      // Load organization details
      const orgResponse = await apiClient.getOrganization(userId, organizationId)
      if (orgResponse.error) {
        throw new Error(orgResponse.error)
      }

      setProject(projectResponse.data)
      setOrganization(orgResponse.data)
    } catch (error) {
      console.error("Failed to load project data:", error)
      setError(error instanceof Error ? error.message : "Failed to load project")
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return dateString
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded bg-neutral-800" />
            <div>
              <Skeleton className="h-8 w-64 bg-neutral-800" />
              <Skeleton className="h-4 w-48 bg-neutral-800 mt-2" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24 bg-neutral-800" />
            <Skeleton className="h-10 w-32 bg-neutral-800" />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-neutral-800 bg-neutral-900/20">
              <CardContent className="p-4">
                <Skeleton className="h-4 w-20 bg-neutral-800 mb-2" />
                <Skeleton className="h-6 w-16 bg-neutral-800" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error || !project || !organization) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="mx-auto w-16 h-16 rounded-full bg-red-900/20 flex items-center justify-center mb-4">
          <AlertTriangle className="h-8 w-8 text-red-400" />
        </div>
        <h3 className="text-xl font-semibold text-red-100 mb-2">Failed to load project</h3>
        <p className="text-red-300 mb-4">{error || "Project not found"}</p>
        <Button 
          onClick={() => router.push(`/dashboard/organizations/${organizationId}`)}
          variant="outline"
          className="border-neutral-700 text-neutral-300"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Organization
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/dashboard/organizations/${organizationId}`)}
            className="text-neutral-400 hover:text-neutral-200"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {organization.name}
          </Button>
          
          <div className="border-l border-neutral-700 pl-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
                <Database className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-neutral-100">{project.name}</h1>
                {project.description && (
                  <p className="text-neutral-400">{project.description}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsInviteDialogOpen(true)}
            className="border-neutral-700 bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-200"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Invite to Project
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-neutral-700 bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-200"
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Project Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Database Status */}
        <Card className="border border-neutral-800 bg-neutral-900/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-blue-400" />
              <div>
                <p className="text-sm text-neutral-400">Database</p>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={project.database_connected ? "default" : "secondary"}
                    className={project.database_connected ? "bg-green-600 text-white" : "bg-neutral-700 text-neutral-300"}
                  >
                    {project.database_connected ? "Connected" : "Not Connected"}
                  </Badge>
                  {project.database_type && (
                    <span className="text-sm text-neutral-300 capitalize">{project.database_type}</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Project Visibility */}
        <Card className="border border-neutral-800 bg-neutral-900/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              {project.is_public ? (
                <Globe className="h-5 w-5 text-green-400" />
              ) : (
                <Lock className="h-5 w-5 text-yellow-400" />
              )}
              <div>
                <p className="text-sm text-neutral-400">Visibility</p>
                <p className="text-sm font-medium text-neutral-200">
                  {project.is_public ? "Public" : "Private"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Created Date */}
        <Card className="border border-neutral-800 bg-neutral-900/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-purple-400" />
              <div>
                <p className="text-sm text-neutral-400">Created</p>
                <p className="text-sm font-medium text-neutral-200">
                  {formatDate(project.created_at)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Last Activity */}
        <Card className="border border-neutral-800 bg-neutral-900/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-orange-400" />
              <div>
                <p className="text-sm text-neutral-400">Last Activity</p>
                <p className="text-sm font-medium text-neutral-200">
                  {project.last_activity ? formatDate(project.last_activity) : "No activity"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="space-y-8">
        {/* Database Connection Section */}
        {!project.database_connected && (
          <Card className="border border-neutral-800 bg-neutral-900/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-neutral-100">
                <Database className="h-5 w-5" />
                Connect Database
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DatabaseConnection
                userId={userId}
                organizationId={organizationId}
                projectId={projectId}
                onConnectionSuccess={loadData}
              />
            </CardContent>
          </Card>
        )}

        {/* Database Overview */}
        {project.database_connected && (
          <Card className="border border-neutral-800 bg-neutral-900/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-neutral-100">
                <Database className="h-5 w-5" />
                Database Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DatabaseOverview
                userId={userId}
                organizationId={organizationId}
                projectId={projectId}
              />
            </CardContent>
          </Card>
        )}

        {/* SQL Playground */}
        {project.database_connected && (
          <Card className="border border-neutral-800 bg-neutral-900/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-neutral-100">
                <Activity className="h-5 w-5" />
                SQL Playground
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SqlPlayground
                userId={userId}
                organizationId={organizationId}
                projectId={projectId}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Invite Dialog */}
      <InviteMemberDialog
        open={isInviteDialogOpen}
        onOpenChange={setIsInviteDialogOpen}
        organization={organization}
        userId={userId}
        projectId={projectId}
        projectName={project.name}
      />
    </div>
  )
} 