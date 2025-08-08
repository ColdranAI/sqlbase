import { authClient } from "./auth-client"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"

interface DatabaseConfig {
  connection_type: "postgresql" | "ssh" | "wireguard"
  database_url: string
  ssh_config?: {
    host: string
    port: string
    user: string
    key_path: string
  }
  wireguard_config?: {
    config: string
    internal_db_url: string
  }
}

interface ApiResponse<T = any> {
  data?: T
  message?: string
  error?: string
}

export interface Project {
  id: string
  name: string
  description?: string
  created_at: string
  updated_at: string
  database_connected: boolean
  database_type?: 'postgresql' | 'mysql' | 'sqlite'
  last_activity?: string
}

export interface ProjectUsage {
  storage_gb: number
  storage_limit_gb: number
  compute_hours: number
  compute_limit_hours: number
  branch_compute_hours: number
  branch_compute_limit_hours: number
  data_transfer_gb: number
  data_transfer_limit_gb: number
  projects_count: number
  projects_limit: number
}

export interface Organization {
  id: string
  name: string
  slug: string
  description?: string
  created_at: string
  updated_at: string
  member_count: number
  project_count: number
  plan: 'free' | 'pro' | 'enterprise'
  logo_url?: string
}

export interface OrganizationMember {
  id: string
  organization_id: string
  user_id: string
  email: string
  role: 'owner' | 'admin' | 'member'
  status: 'active' | 'pending' | 'suspended'
  joined_at: string
  invited_at: string
  invited_by: string
  user?: {
    id: string
    name: string
    email: string
    image?: string
  }
}

export interface OrganizationInvitation {
  id: string
  organization_id: string
  email: string
  role: 'admin' | 'member'
  status: 'pending' | 'accepted' | 'expired' | 'cancelled'
  invited_by: string
  invited_at: string
  expires_at: string
  token: string
  project_access_type: 'all' | 'specific' | null
  specific_projects?: string[] // project IDs if project_access_type is 'specific'
  inviter?: {
    name: string
    email: string
  }
  organization?: {
    name: string
    slug: string
  }
  projects?: Array<{
    id: string
    name: string
  }>
}

export interface UpdatedProject extends Project {
  organization_id: string
  organization?: {
    name: string
    slug: string
  }
}

export interface SQLBaseUsage {
  ai_queries_used: number
  ai_queries_limit: number
  projects_count: number
  projects_limit: number
  members_count: number
  members_limit: number
  database_connections: number
  database_connections_limit: number
  query_history_days: number
  query_history_limit_days: number
}

export interface OrganizationUsage extends SQLBaseUsage {
  organization_id: string
  plan: 'free' | 'pro' | 'enterprise'
  billing_cycle_start: string
  billing_cycle_end: string
}

class ApiClient {
  private async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      // Check if user has a valid session
      const session = await authClient.getSession()
      if (!session.data?.user) {
        return {
          error: "Authentication required. Please sign in.",
        }
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        credentials: 'include', // This is crucial - tells browser to send cookies
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          error: data.error || `HTTP ${response.status}: ${response.statusText}`,
        }
      }

      return { data }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }
    }
  }

  // Health check (public endpoint)
  async healthCheck(): Promise<ApiResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        credentials: 'include', // Include cookies even for health check
      })
      const data = await response.json()
      return { data }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Health check failed",
      }
    }
  }

  // User management
  async createUser(userData: { user_id: string; email: string; role?: string }): Promise<ApiResponse> {
    return this.request("/api/v1/users", {
      method: "POST",
      body: JSON.stringify(userData),
    })
  }

  async getUser(userId: string): Promise<ApiResponse> {
    return this.request(`/api/v1/users/${userId}`)
  }

  async updateUser(userId: string, userData: { email?: string; role?: string }): Promise<ApiResponse> {
    return this.request(`/api/v1/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify(userData),
    })
  }

  async deleteUser(userId: string): Promise<ApiResponse> {
    return this.request(`/api/v1/users/${userId}`, {
      method: "DELETE",
    })
  }

  // Database configuration
  async createDatabaseConfig(userId: string, config: DatabaseConfig): Promise<ApiResponse> {
    return this.request(`/api/v1/users/${userId}/database-config`, {
      method: "POST",
      body: JSON.stringify(config),
    })
  }

  async testDatabaseConnection(userId: string): Promise<ApiResponse> {
    return this.request(`/api/v1/users/${userId}/database-config/test`, {
      method: "POST",
    })
  }

  // Test database URL without saving the configuration
  async testDatabaseURL(userId: string, config: DatabaseConfig): Promise<ApiResponse> {
    return this.request(`/api/v1/users/${userId}/database-config/test-url`, {
      method: "POST",
      body: JSON.stringify(config),
    })
  }

  async getDatabaseConfig(userId: string): Promise<ApiResponse> {
    return this.request(`/api/v1/users/${userId}/database-config`)
  }

  async deleteDatabaseConfig(userId: string): Promise<ApiResponse> {
    return this.request(`/api/v1/users/${userId}/database-config`, {
      method: "DELETE",
    })
  }

  async getUserResources(userId: string, page = 1, limit = 10): Promise<ApiResponse> {
    return this.request(`/api/v1/users/${userId}/resources?page=${page}&limit=${limit}`)
  }

  // Metrics
  async createMetric(metricData: {
    metric_type: string
    metric_value?: number
    metadata?: any
  }): Promise<ApiResponse> {
    return this.request("/api/v1/metrics", {
      method: "POST",
      body: JSON.stringify(metricData),
    })
  }

  async getMetrics(page = 1, limit = 10, metricType?: string, userId?: string): Promise<ApiResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    })
    
    if (metricType) params.append("metric_type", metricType)
    if (userId) params.append("user_id", userId)

    return this.request(`/api/v1/metrics?${params.toString()}`)
  }

  async getMetricsSummary(): Promise<ApiResponse> {
    return this.request("/api/v1/metrics/summary")
  }

  // SQL Playground
  async executeSQL(userId: string, queryData: {
    sql: string
    params?: any[]
    options?: {
      limit?: number
      timeout?: number
      explain_plan?: boolean
      dry_run?: boolean
    }
  }): Promise<ApiResponse> {
    return this.request(`/api/v1/users/${userId}/sql/execute`, {
      method: "POST",
      body: JSON.stringify(queryData),
    })
  }

  async getDatabaseSchema(userId: string): Promise<ApiResponse> {
    return this.request(`/api/v1/users/${userId}/sql/schema`)
  }

  async getQueryHistory(userId: string, page = 1, limit = 10): Promise<ApiResponse> {
    return this.request(`/api/v1/users/${userId}/sql/history?page=${page}&limit=${limit}`)
  }

  // Public endpoints
  async createPublicMetric(metricData: {
    metric_type: string
    metric_value?: number
    metadata?: any
  }): Promise<ApiResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/public/metrics`, {
        method: "POST",
        credentials: 'include', // Include cookies for public endpoints too
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metricData),
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          error: data.error || `HTTP ${response.status}: ${response.statusText}`,
        }
      }

      return { data }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }
    }
  }

  // Project management
  async getProjects(userId: string): Promise<ApiResponse<Project[]>> {
    return this.request(`/api/v1/users/${userId}/projects`)
  }

  async createProject(userId: string, projectData: {
    name: string
    description?: string
  }): Promise<ApiResponse<Project>> {
    return this.request(`/api/v1/users/${userId}/projects`, {
      method: "POST",
      body: JSON.stringify(projectData),
    })
  }

  async getProject(userId: string, projectId: string): Promise<ApiResponse<Project>> {
    return this.request(`/api/v1/users/${userId}/projects/${projectId}`)
  }

  async updateProject(userId: string, projectId: string, projectData: {
    name?: string
    description?: string
  }): Promise<ApiResponse<Project>> {
    return this.request(`/api/v1/users/${userId}/projects/${projectId}`, {
      method: "PUT",
      body: JSON.stringify(projectData),
    })
  }

  async deleteProject(userId: string, projectId: string): Promise<ApiResponse> {
    return this.request(`/api/v1/users/${userId}/projects/${projectId}`, {
      method: "DELETE",
    })
  }

  async getProjectUsage(userId: string): Promise<ApiResponse<ProjectUsage>> {
    return this.request(`/api/v1/users/${userId}/usage`)
  }

  // Project-specific database configuration
  async createProjectDatabaseConfig(userId: string, projectId: string, config: DatabaseConfig): Promise<ApiResponse> {
    return this.request(`/api/v1/users/${userId}/projects/${projectId}/database-config`, {
      method: "POST",
      body: JSON.stringify(config),
    })
  }

  async getProjectDatabaseConfig(userId: string, projectId: string): Promise<ApiResponse> {
    return this.request(`/api/v1/users/${userId}/projects/${projectId}/database-config`)
  }

  async deleteProjectDatabaseConfig(userId: string, projectId: string): Promise<ApiResponse> {
    return this.request(`/api/v1/users/${userId}/projects/${projectId}/database-config`, {
      method: "DELETE",
    })
  }

  async getProjectDatabaseSchema(userId: string, projectId: string): Promise<ApiResponse> {
    return this.request(`/api/v1/users/${userId}/projects/${projectId}/sql/schema`)
  }

  async executeProjectSQL(userId: string, projectId: string, queryData: {
    sql: string
    params?: any[]
    options?: {
      limit?: number
      timeout?: number
      explain_plan?: boolean
      dry_run?: boolean
    }
  }): Promise<ApiResponse> {
    return this.request(`/api/v1/users/${userId}/projects/${projectId}/sql/execute`, {
      method: "POST",
      body: JSON.stringify(queryData),
    })
  }

  // Organization management
  async getOrganizations(userId: string): Promise<ApiResponse<Organization[]>> {
    return this.request(`/api/v1/users/${userId}/organizations`)
  }

  async createOrganization(userId: string, orgData: {
    name: string
    slug: string
    description?: string
  }): Promise<ApiResponse<Organization>> {
    return this.request(`/api/v1/users/${userId}/organizations`, {
      method: "POST",
      body: JSON.stringify(orgData),
    })
  }

  async getOrganization(userId: string, orgId: string): Promise<ApiResponse<Organization>> {
    return this.request(`/api/v1/users/${userId}/organizations/${orgId}`)
  }

  async updateOrganization(userId: string, orgId: string, orgData: {
    name?: string
    slug?: string
    description?: string
    logo_url?: string
  }): Promise<ApiResponse<Organization>> {
    return this.request(`/api/v1/users/${userId}/organizations/${orgId}`, {
      method: "PUT",
      body: JSON.stringify(orgData),
    })
  }

  async deleteOrganization(userId: string, orgId: string): Promise<ApiResponse> {
    return this.request(`/api/v1/users/${userId}/organizations/${orgId}`, {
      method: "DELETE",
    })
  }

  // Organization members
  async getOrganizationMembers(userId: string, orgId: string): Promise<ApiResponse<OrganizationMember[]>> {
    return this.request(`/api/v1/users/${userId}/organizations/${orgId}/members`)
  }

  async updateMemberRole(userId: string, orgId: string, memberId: string, role: 'admin' | 'member'): Promise<ApiResponse> {
    return this.request(`/api/v1/users/${userId}/organizations/${orgId}/members/${memberId}`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    })
  }

  async removeMember(userId: string, orgId: string, memberId: string): Promise<ApiResponse> {
    return this.request(`/api/v1/users/${userId}/organizations/${orgId}/members/${memberId}`, {
      method: "DELETE",
    })
  }

  // Organization invitations
  async inviteToOrganization(userId: string, orgId: string, inviteData: {
    email: string
    role: 'admin' | 'member'
    message?: string
    project_access_type?: 'all' | 'specific'
    specific_projects?: string[]
  }): Promise<ApiResponse<OrganizationInvitation>> {
    return this.request(`/api/v1/users/${userId}/organizations/${orgId}/invitations`, {
      method: "POST",
      body: JSON.stringify(inviteData),
    })
  }

  // Project-specific invitation (from project page)
  async inviteToProject(userId: string, orgId: string, projectId: string, inviteData: {
    email: string
    role: 'admin' | 'member'
    message?: string
  }): Promise<ApiResponse<OrganizationInvitation>> {
    return this.request(`/api/v1/users/${userId}/organizations/${orgId}/projects/${projectId}/invitations`, {
      method: "POST",
      body: JSON.stringify({
        ...inviteData,
        project_access_type: 'specific',
        specific_projects: [projectId]
      }),
    })
  }

  async getOrganizationInvitations(userId: string, orgId: string): Promise<ApiResponse<OrganizationInvitation[]>> {
    return this.request(`/api/v1/users/${userId}/organizations/${orgId}/invitations`)
  }

  async cancelInvitation(userId: string, orgId: string, invitationId: string): Promise<ApiResponse> {
    return this.request(`/api/v1/users/${userId}/organizations/${orgId}/invitations/${invitationId}`, {
      method: "DELETE",
    })
  }

  async resendInvitation(userId: string, orgId: string, invitationId: string): Promise<ApiResponse> {
    return this.request(`/api/v1/users/${userId}/organizations/${orgId}/invitations/${invitationId}/resend`, {
      method: "POST",
    })
  }

  // Accept invitation (public endpoint)
  async acceptInvitation(token: string): Promise<ApiResponse<{
    organization: Organization
    user_created: boolean
  }>> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/public/invitations/${token}/accept`, {
        method: "POST",
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
        },
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          error: data.error || `HTTP ${response.status}: ${response.statusText}`,
        }
      }

      return { data }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Failed to accept invitation",
      }
    }
  }

  // Get invitation details (public endpoint)
  async getInvitationDetails(token: string): Promise<ApiResponse<OrganizationInvitation>> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/public/invitations/${token}`, {
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          error: data.error || `HTTP ${response.status}: ${response.statusText}`,
        }
      }

      return { data }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Failed to get invitation details",
      }
    }
  }

  // Organization-based project management
  async getOrganizationProjects(userId: string, orgId: string): Promise<ApiResponse<UpdatedProject[]>> {
    return this.request(`/api/v1/users/${userId}/organizations/${orgId}/projects`)
  }

  async createOrganizationProject(userId: string, orgId: string, projectData: {
    name: string
    description?: string
  }): Promise<ApiResponse<UpdatedProject>> {
    return this.request(`/api/v1/users/${userId}/organizations/${orgId}/projects`, {
      method: "POST",
      body: JSON.stringify(projectData),
    })
  }

  async getOrganizationUsage(userId: string, orgId: string): Promise<ApiResponse<OrganizationUsage>> {
    return this.request(`/api/v1/users/${userId}/organizations/${orgId}/usage`)
  }

  // Organization-specific database configuration
  async createOrgProjectDatabaseConfig(userId: string, orgId: string, projectId: string, config: DatabaseConfig): Promise<ApiResponse> {
    return this.request(`/api/v1/users/${userId}/organizations/${orgId}/projects/${projectId}/database-config`, {
      method: "POST",
      body: JSON.stringify(config),
    })
  }

  async getOrgProjectDatabaseConfig(userId: string, orgId: string, projectId: string): Promise<ApiResponse> {
    return this.request(`/api/v1/users/${userId}/organizations/${orgId}/projects/${projectId}/database-config`)
  }

  async deleteOrgProjectDatabaseConfig(userId: string, orgId: string, projectId: string): Promise<ApiResponse> {
    return this.request(`/api/v1/users/${userId}/organizations/${orgId}/projects/${projectId}/database-config`, {
      method: "DELETE",
    })
  }

  async getOrgProjectDatabaseSchema(userId: string, orgId: string, projectId: string): Promise<ApiResponse> {
    return this.request(`/api/v1/users/${userId}/organizations/${orgId}/projects/${projectId}/sql/schema`)
  }

  async executeOrgProjectSQL(userId: string, orgId: string, projectId: string, queryData: {
    sql: string
    params?: any[]
    options?: {
      limit?: number
      timeout?: number
      explain_plan?: boolean
      dry_run?: boolean
    }
  }): Promise<ApiResponse> {
    return this.request(`/api/v1/users/${userId}/organizations/${orgId}/projects/${projectId}/sql/execute`, {
      method: "POST",
      body: JSON.stringify(queryData),
    })
  }
}

export const apiClient = new ApiClient()

export type { DatabaseConfig, ApiResponse } 