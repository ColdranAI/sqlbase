"use client"

import { useState, useEffect } from "react"
import { apiClient, type Organization, type OrganizationUsage, type UpdatedProject } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  Database, 
  Plus,
  Brain,
  FolderOpen,
  Users,
  Calendar,
  Settings,
  Activity,
  Crown,
  ChevronDown,
  Building,
  Zap,
  History,
  AlertTriangle,
  TrendingUp
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CreateProjectDialog } from "./create-project-dialog"
import { CreateOrganizationDialog } from "./create-organization-dialog"
import { InviteMemberDialog } from "./invite-member-dialog"
import { OrganizationMembersDialog } from "./organization-members-dialog"
import Link from "next/link"

interface OrganizationDashboardProps {
  userId: string
  userName: string
}

export function OrganizationDashboard({ userId, userName }: OrganizationDashboardProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null)
  const [projects, setProjects] = useState<UpdatedProject[]>([])
  const [usage, setUsage] = useState<OrganizationUsage | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOrgDialogOpen, setIsCreateOrgDialogOpen] = useState(false)
  const [isCreateProjectDialogOpen, setIsCreateProjectDialogOpen] = useState(false)
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false)
  const [isMembersDialogOpen, setIsMembersDialogOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadOrganizations()
  }, [userId])

  useEffect(() => {
    if (currentOrg) {
      loadOrganizationData(currentOrg.id)
    }
  }, [currentOrg, userId])

  const loadOrganizations = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // For now, mock the data since backend might not be ready
      // TODO: Replace with real API calls
      const mockOrganizations: Organization[] = [
        {
          id: 'org-1',
          name: 'Personal',
          slug: 'personal',
          description: 'Your personal workspace',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          member_count: 1,
          project_count: 0,
          plan: 'free'
        }
      ]

      setOrganizations(mockOrganizations)
      
      // Set current org from localStorage or first org
      const savedOrgId = localStorage.getItem(`current-org-${userId}`)
      const targetOrg = savedOrgId 
        ? mockOrganizations.find(org => org.id === savedOrgId) || mockOrganizations[0]
        : mockOrganizations[0]
      
      if (targetOrg) {
        setCurrentOrg(targetOrg)
      }
    } catch (error) {
      console.error("Failed to load organizations:", error)
      setError(error instanceof Error ? error.message : "Failed to load organizations")
    } finally {
      setIsLoading(false)
    }
  }

  const loadOrganizationData = async (orgId: string) => {
    try {
      // Mock SQLBase-specific usage data based on plan
      const mockProjects: UpdatedProject[] = []
      const orgPlan = currentOrg?.plan || 'free'
      
      // Define limits based on plan
      const planLimits = {
        free: {
          ai_queries_limit: 40,
          projects_limit: 2,
          members_limit: 3,
          database_connections_limit: 2,
          query_history_limit_days: 7
        },
        pro: {
          ai_queries_limit: 1000,
          projects_limit: 25,
          members_limit: 25,
          database_connections_limit: 25,
          query_history_limit_days: 90
        },
        enterprise: {
          ai_queries_limit: 10000,
          projects_limit: 100,
          members_limit: 100,
          database_connections_limit: 100,
          query_history_limit_days: 365
        }
      }

      const limits = planLimits[orgPlan as keyof typeof planLimits]
      
      const mockUsage: OrganizationUsage = {
        organization_id: orgId,
        plan: orgPlan as 'free' | 'pro' | 'enterprise',
        billing_cycle_start: new Date().toISOString(),
        billing_cycle_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        ai_queries_used: Math.floor(Math.random() * (limits.ai_queries_limit * 0.7)), // Random usage up to 70%
        ai_queries_limit: limits.ai_queries_limit,
        projects_count: 0,
        projects_limit: limits.projects_limit,
        members_count: currentOrg?.member_count || 1,
        members_limit: limits.members_limit,
        database_connections: 0,
        database_connections_limit: limits.database_connections_limit,
        query_history_days: 0,
        query_history_limit_days: limits.query_history_limit_days
      }

      setProjects(mockProjects)
      setUsage(mockUsage)
    } catch (error) {
      console.error("Failed to load organization data:", error)
      setError(error instanceof Error ? error.message : "Failed to load organization data")
    }
  }

  const handleOrganizationChange = (org: Organization) => {
    setCurrentOrg(org)
    localStorage.setItem(`current-org-${userId}`, org.id)
  }

  const handleOrganizationCreated = (newOrg: Organization) => {
    setOrganizations(prev => [...prev, newOrg])
    setCurrentOrg(newOrg)
    localStorage.setItem(`current-org-${userId}`, newOrg.id)
    setIsCreateOrgDialogOpen(false)
  }

  const handleProjectCreated = (newProject: UpdatedProject) => {
    setProjects(prev => [...prev, newProject])
    setIsCreateProjectDialogOpen(false)
    if (currentOrg) {
      loadOrganizationData(currentOrg.id)
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const getUsagePercentage = (used: number, limit: number) => {
    return limit > 0 ? (used / limit) * 100 : 0
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getPlanBadgeColor = (plan: string) => {
    switch (plan) {
      case 'pro': return 'bg-blue-600 text-white'
      case 'enterprise': return 'bg-purple-600 text-white'
      default: return 'bg-neutral-700 text-neutral-300'
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64 bg-neutral-800" />
          <Skeleton className="h-10 w-32 bg-neutral-800" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full bg-neutral-800" />
          ))}
        </div>
      </div>
    )
  }

  // Show onboarding when user has no organizations
  if (!isLoading && organizations.length === 0) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="max-w-2xl mx-auto text-center space-y-8">
          {/* Hero Section */}
          <div className="space-y-4">
            <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-blue-500/20">
              <Building className="h-10 w-10 text-blue-400" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-neutral-100">
                Welcome to SQLBase, {userName}!
              </h1>
              <p className="text-lg text-neutral-400 max-w-lg mx-auto">
                Get started by creating your first organization to manage database projects and collaborate with your team.
              </p>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-12">
            <Card className="border border-neutral-800 bg-neutral-900/20 p-6">
              <div className="space-y-3 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Users className="h-6 w-6 text-green-400" />
                </div>
                <h3 className="font-semibold text-neutral-100">Team Collaboration</h3>
                <p className="text-sm text-neutral-400">
                  Invite team members and work together on database projects with role-based permissions.
                </p>
              </div>
            </Card>

            <Card className="border border-neutral-800 bg-neutral-900/20 p-6">
              <div className="space-y-3 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Database className="h-6 w-6 text-blue-400" />
                </div>
                <h3 className="font-semibold text-neutral-100">Database Management</h3>
                <p className="text-sm text-neutral-400">
                  Connect, visualize, and query your PostgreSQL databases with our secure playground.
                </p>
              </div>
            </Card>

            <Card className="border border-neutral-800 bg-neutral-900/20 p-6">
              <div className="space-y-3 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <FolderOpen className="h-6 w-6 text-purple-400" />
                </div>
                <h3 className="font-semibold text-neutral-100">Project Organization</h3>
                <p className="text-sm text-neutral-400">
                  Organize your databases into projects and track usage across your organization.
                </p>
              </div>
            </Card>
          </div>

          {/* Call to Action */}
          <div className="space-y-4">
            <Button 
              onClick={() => setIsCreateOrgDialogOpen(true)}
              size="lg"
              className="bg-white text-neutral-900 hover:bg-neutral-100 px-8 py-3 text-base font-medium"
            >
              <Building className="h-5 w-5 mr-2" />
              Create Your First Organization
            </Button>
            
            <p className="text-sm text-neutral-500">
              You can create multiple organizations and switch between them anytime
            </p>
          </div>

          {/* Quick Start Steps */}
          <div className="mt-12 p-6 border border-neutral-800 bg-neutral-900/10 rounded-lg">
            <h3 className="text-lg font-semibold text-neutral-200 mb-4">Quick Start Guide</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <h4 className="font-medium text-neutral-200">Create Organization</h4>
                  <p className="text-sm text-neutral-400">Set up your workspace and invite team members</p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <h4 className="font-medium text-neutral-200">Create Project</h4>
                  <p className="text-sm text-neutral-400">Start a new project and connect your database</p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <h4 className="font-medium text-neutral-200">Start Querying</h4>
                  <p className="text-sm text-neutral-400">Explore your data with our SQL playground</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header with Organization Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Organization Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2 border-neutral-700 bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-200">
                <Building className="h-4 w-4" />
                {currentOrg?.name || 'Select Organization'}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 bg-neutral-900 border-neutral-700">
              {organizations.map((org) => (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => handleOrganizationChange(org)}
                  className="flex items-center justify-between hover:bg-neutral-800 text-neutral-200"
                >
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    <div>
                      <p className="font-medium">{org.name}</p>
                      <p className="text-xs text-neutral-400">{org.member_count} members</p>
                    </div>
                  </div>
                  <Badge className={getPlanBadgeColor(org.plan)}>
                    {org.plan.charAt(0).toUpperCase() + org.plan.slice(1)}
                  </Badge>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="bg-neutral-700" />
              <DropdownMenuItem
                onClick={() => setIsCreateOrgDialogOpen(true)}
                className="hover:bg-neutral-800 text-neutral-200"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create organization
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div>
            <h1 className="text-3xl font-bold text-neutral-100">
              {currentOrg?.name || userName}'s workspace
            </h1>
            <p className="text-neutral-400 mt-1">
              {currentOrg?.description || "Manage your databases and applications"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentOrg && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMembersDialogOpen(true)}
                className="border-neutral-700 bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-200"
              >
                <Users className="h-4 w-4 mr-2" />
                Members ({currentOrg.member_count})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsInviteDialogOpen(true)}
                className="border-neutral-700 bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-200"
              >
                <Plus className="h-4 w-4 mr-2" />
                Invite
              </Button>
            </>
          )}
          {usage && usage.projects_count >= usage.projects_limit ? (
            <Button
              size="sm"
              variant="outline"
              className="border-orange-600/50 bg-orange-900/20 text-orange-400 hover:bg-orange-900/30"
              disabled
            >
              <AlertTriangle className="h-4 w-4 mr-1" />
              Project Limit Reached
            </Button>
          ) : (
            <Button 
              onClick={() => setIsCreateProjectDialogOpen(true)} 
              className="bg-white text-neutral-900 hover:bg-neutral-100"
              disabled={!currentOrg}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create project
            </Button>
          )}
        </div>
      </div>

      {currentOrg && (
        <>
          {/* Organization Usage */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-neutral-200">Usage & Limits</h2>
              {usage && usage.plan === 'free' && (
                <Button 
                  size="sm" 
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  <Crown className="h-4 w-4 mr-1" />
                  Upgrade to Pro
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* AI Queries */}
              <Card className="border border-neutral-800 bg-neutral-900/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Brain className="h-5 w-5 text-purple-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-neutral-400">AI Queries</p>
                      {usage ? (
                        <>
                          <p className="text-lg font-bold text-neutral-100">
                            {usage.ai_queries_used} / {usage.ai_queries_limit}
                          </p>
                          <Progress 
                            value={getUsagePercentage(usage.ai_queries_used, usage.ai_queries_limit)} 
                            className="h-2 mt-2"
                            style={{
                              '--progress-background': getUsagePercentage(usage.ai_queries_used, usage.ai_queries_limit) > 80 
                                ? '#ef4444' 
                                : getUsagePercentage(usage.ai_queries_used, usage.ai_queries_limit) > 60 
                                  ? '#f59e0b' 
                                  : '#8b5cf6'
                            } as React.CSSProperties}
                          />
                          {getUsagePercentage(usage.ai_queries_used, usage.ai_queries_limit) > 80 && (
                            <div className="flex items-center gap-1 mt-1">
                              <AlertTriangle className="h-3 w-3 text-red-400" />
                              <span className="text-xs text-red-400">Approaching limit</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <Skeleton className="h-6 w-16 bg-neutral-800" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Projects */}
              <Card className="border border-neutral-800 bg-neutral-900/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <FolderOpen className="h-5 w-5 text-cyan-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-neutral-400">Projects</p>
                      {usage ? (
                        <>
                          <p className="text-lg font-bold text-neutral-100">
                            {usage.projects_count} / {usage.projects_limit}
                          </p>
                          <Progress 
                            value={getUsagePercentage(usage.projects_count, usage.projects_limit)} 
                            className="h-2 mt-2"
                            style={{
                              '--progress-background': getUsagePercentage(usage.projects_count, usage.projects_limit) > 80 
                                ? '#ef4444' 
                                : '#06b6d4'
                            } as React.CSSProperties}
                          />
                          {getUsagePercentage(usage.projects_count, usage.projects_limit) > 80 && (
                            <div className="flex items-center gap-1 mt-1">
                              <AlertTriangle className="h-3 w-3 text-red-400" />
                              <span className="text-xs text-red-400">Approaching limit</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <Skeleton className="h-6 w-8 bg-neutral-800" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Database Connections */}
              <Card className="border border-neutral-800 bg-neutral-900/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Database className="h-5 w-5 text-green-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-neutral-400">DB Connections</p>
                      {usage ? (
                        <>
                          <p className="text-lg font-bold text-neutral-100">
                            {usage.database_connections} / {usage.database_connections_limit}
                          </p>
                          <Progress 
                            value={getUsagePercentage(usage.database_connections, usage.database_connections_limit)} 
                            className="h-2 mt-2"
                            style={{
                              '--progress-background': getUsagePercentage(usage.database_connections, usage.database_connections_limit) > 80 
                                ? '#ef4444' 
                                : '#10b981'
                            } as React.CSSProperties}
                          />
                        </>
                      ) : (
                        <Skeleton className="h-6 w-8 bg-neutral-800" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Team Members */}
              <Card className="border border-neutral-800 bg-neutral-900/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Users className="h-5 w-5 text-pink-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-neutral-400">Team Members</p>
                      {usage ? (
                        <>
                          <p className="text-lg font-bold text-neutral-100">
                            {usage.members_count} / {usage.members_limit}
                          </p>
                          <Progress 
                            value={getUsagePercentage(usage.members_count, usage.members_limit)} 
                            className="h-2 mt-2"
                            style={{
                              '--progress-background': getUsagePercentage(usage.members_count, usage.members_limit) > 80 
                                ? '#ef4444' 
                                : '#ec4899'
                            } as React.CSSProperties}
                          />
                        </>
                      ) : (
                        <Skeleton className="h-6 w-8 bg-neutral-800" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Plan Info and Billing Cycle */}
            {usage && (
              <div className="mt-4 flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <span className="text-neutral-400">
                    Plan: <Badge className={getPlanBadgeColor(usage.plan)}>{usage.plan.charAt(0).toUpperCase() + usage.plan.slice(1)}</Badge>
                  </span>
                  <span className="text-neutral-400">
                    Query History: {usage.query_history_limit_days} days
                  </span>
                </div>
                <span className="text-neutral-500">
                  Billing cycle resets {formatDate(usage.billing_cycle_end)}
                </span>
              </div>
            )}

            {/* Upgrade Prompt for Free Tier */}
            {usage && usage.plan === 'free' && (
              <Card className="mt-4 border border-blue-800/30 bg-blue-900/10">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-5 w-5 text-blue-400" />
                    <div className="flex-1">
                      <h3 className="font-medium text-blue-100">Need more resources?</h3>
                      <p className="text-sm text-blue-200/80 mt-1">
                        Upgrade to Pro for 1,000 AI queries, 25 projects, and 90-day query history.
                      </p>
                    </div>
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                      Upgrade Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Projects */}
          <div>
            {error ? (
              <Card className="border border-red-800 bg-red-900/20">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <Database className="h-5 w-5 text-red-400" />
                    <div>
                      <h4 className="font-medium text-red-400">Failed to load projects</h4>
                      <p className="text-sm text-red-300 mt-1">{error}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : projects.length === 0 ? (
              /* Empty State */
              <div className="text-center py-12">
                <div className="mx-auto w-16 h-16 rounded-full bg-neutral-800/50 flex items-center justify-center mb-6">
                  <Database className="h-8 w-8 text-neutral-400" />
                </div>
                <h3 className="text-xl font-semibold text-neutral-100 mb-2">
                  No projects in {currentOrg.name}
                </h3>
                <p className="text-neutral-400 max-w-md mx-auto mb-6">
                  Create a project to start building on your application and managing your data efficiently.
                </p>
                <div className="flex items-center justify-center gap-3">
                  {usage && usage.projects_count >= usage.projects_limit ? (
                    <div className="text-center">
                      <Button 
                        variant="outline"
                        className="border-orange-600/50 bg-orange-900/20 text-orange-400 hover:bg-orange-900/30"
                        disabled
                      >
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        Project Limit Reached
                      </Button>
                      <p className="text-sm text-neutral-500 mt-2">
                        You've reached your {usage.plan} plan limit of {usage.projects_limit} projects.
                      </p>
                      {usage.plan === 'free' && (
                        <Button 
                          size="sm" 
                          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 mt-2"
                        >
                          <Crown className="h-4 w-4 mr-1" />
                          Upgrade to Pro
                        </Button>
                      )}
                    </div>
                  ) : (
                    <>
                      <Button 
                        onClick={() => setIsCreateProjectDialogOpen(true)} 
                        className="bg-white text-neutral-900 hover:bg-neutral-100"
                      >
                        Create project
                      </Button>
                      <Button 
                        variant="outline" 
                        className="border-neutral-700 bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-200"
                      >
                        Import database
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              /* Projects Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((project) => (
                  <Link key={project.id} href={`/dashboard/organizations/${currentOrg.id}/projects/${project.id}`}>
                    <Card className="border border-neutral-800 bg-neutral-900/20 hover:bg-neutral-800/30 transition-colors cursor-pointer">
                      <CardContent className="p-6">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-neutral-100 truncate">{project.name}</h3>
                            <Badge 
                              variant={project.database_connected ? "default" : "secondary"}
                              className={project.database_connected ? "bg-green-600 text-white" : "bg-neutral-700 text-neutral-300"}
                            >
                              {project.database_connected ? "Connected" : "No Database"}
                            </Badge>
                          </div>
                          
                          {project.description && (
                            <p className="text-sm text-neutral-400 line-clamp-2">{project.description}</p>
                          )}
                          
                          <div className="flex items-center justify-between text-xs text-neutral-500">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>Created {formatDate(project.created_at)}</span>
                            </div>
                            {project.last_activity && (
                              <div className="flex items-center gap-1">
                                <Activity className="h-3 w-3" />
                                <span>{formatDate(project.last_activity)}</span>
                              </div>
                            )}
                          </div>
                          
                          {project.database_type && (
                            <div className="flex items-center gap-2">
                              <Database className="h-4 w-4 text-neutral-400" />
                              <span className="text-sm text-neutral-400 capitalize">{project.database_type}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Dialogs */}
      <CreateOrganizationDialog
        open={isCreateOrgDialogOpen}
        onOpenChange={setIsCreateOrgDialogOpen}
        onOrganizationCreated={handleOrganizationCreated}
        userId={userId}
      />

      {currentOrg && (
        <>
          <CreateProjectDialog
            open={isCreateProjectDialogOpen}
            onOpenChange={setIsCreateProjectDialogOpen}
            onProjectCreated={handleProjectCreated}
            userId={userId}
            organizationId={currentOrg.id}
          />

          <InviteMemberDialog
            open={isInviteDialogOpen}
            onOpenChange={setIsInviteDialogOpen}
            organization={currentOrg}
            userId={userId}
          />

          <OrganizationMembersDialog
            open={isMembersDialogOpen}
            onOpenChange={setIsMembersDialogOpen}
            organization={currentOrg}
            userId={userId}
          />
        </>
      )}
    </div>
  )
} 