"use client"

import { useState, useEffect } from "react"
import { apiClient } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  Database, 
  Table, 
  Columns, 
  BarChart3, 
  Clock,
  Activity,
  Server,
  Eye,
  TrendingUp
} from "lucide-react"

interface TableInfo {
  name: string
  schema: string
  columns: Array<{
    name: string
    type: string
    nullable: boolean
    is_primary_key: boolean
    is_foreign_key: boolean
  }>
  row_count?: number
}

interface SchemaInfo {
  tables: TableInfo[]
  views?: TableInfo[]
}

interface DatabaseOverviewProps {
  userId?: string
  isOrganizationProject?: boolean
  organizationId?: string
  projectId?: string
}

export function DatabaseOverview({ 
  userId, 
  isOrganizationProject = false,
  organizationId,
  projectId
}: DatabaseOverviewProps) {
  const [schema, setSchema] = useState<SchemaInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(userId || null)

  useEffect(() => {
    const initializeAndLoad = async () => {
      if (!currentUserId) {
        try {
          const { authClient } = await import("@/lib/auth-client")
          const session = await authClient.getSession()
          if (session.data?.user?.id) {
            setCurrentUserId(session.data.user.id)
          } else {
            setError("User not authenticated")
            setIsLoading(false)
            return
          }
        } catch (error) {
          setError("Failed to get user session")
          setIsLoading(false)
          return
        }
      }
      
      loadDatabaseInfo()
    }

    initializeAndLoad()
  }, [currentUserId, userId, organizationId, projectId])

  const loadDatabaseInfo = async () => {
    if (!currentUserId) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      let result
      if (isOrganizationProject && organizationId && projectId) {
        result = await apiClient.getOrgProjectDatabaseSchema(currentUserId, organizationId, projectId)
      } else {
        result = await apiClient.getDatabaseSchema(currentUserId)
      }
      
      if (result.error) {
        setError(result.error)
      } else {
        console.log("Database schema response:", result.data)
        setSchema(result.data)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to load database information")
    } finally {
      setIsLoading(false)
    }
  }

  const getStatistics = () => {
    if (!schema || !schema.tables) return null

    const totalTables = schema.tables?.length || 0
    const totalViews = schema.views?.length || 0
    const totalColumns = schema.tables?.reduce((sum, table) => sum + (table.columns?.length || 0), 0) || 0
    const totalRows = schema.tables?.reduce((sum, table) => sum + (table.row_count || 0), 0) || 0
    const tablesWithData = schema.tables?.filter(table => (table.row_count || 0) > 0).length || 0
    const primaryKeys = schema.tables?.reduce((sum, table) => 
      sum + (table.columns?.filter(col => col.is_primary_key).length || 0), 0
    ) || 0
    const foreignKeys = schema.tables?.reduce((sum, table) => 
      sum + (table.columns?.filter(col => col.is_foreign_key).length || 0), 0
    ) || 0

    return {
      totalTables,
      totalViews,
      totalColumns,
      totalRows,
      tablesWithData,
      primaryKeys,
      foreignKeys,
      dataPercentage: totalTables > 0 ? (tablesWithData / totalTables) * 100 : 0
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toLocaleString()
  }

  const stats = isLoading ? null : getStatistics()
  const topTables = isLoading ? [] : (schema?.tables
    ?.filter(table => table.row_count && table.row_count > 0)
    ?.sort((a, b) => (b.row_count || 0) - (a.row_count || 0))
    ?.slice(0, 5) || [])

  return (
    <div className="space-y-4">
      {/* Show error if needed */}
      {error && (
        <Card className="border border-red-800 bg-red-900/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-red-400" />
              <div>
                <h4 className="font-medium text-red-400">Failed to load database information</h4>
                <p className="text-sm text-red-300 mt-1">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Compact Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border border-neutral-800 bg-neutral-900/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Table className="h-5 w-5 text-blue-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-neutral-400">Tables</p>
                {isLoading ? (
                  <>
                    <Skeleton className="h-6 w-8 bg-neutral-800 mb-1" />
                    <Skeleton className="h-3 w-16 bg-neutral-800" />
                  </>
                ) : stats ? (
                  <>
                    <p className="text-lg font-bold text-neutral-100">{stats.totalTables}</p>
                    <p className="text-xs text-neutral-500">{stats.tablesWithData} with data</p>
                  </>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-neutral-800 bg-neutral-900/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Columns className="h-5 w-5 text-green-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-neutral-400">Columns</p>
                {isLoading ? (
                  <>
                    <Skeleton className="h-6 w-8 bg-neutral-800 mb-1" />
                    <Skeleton className="h-3 w-20 bg-neutral-800" />
                  </>
                ) : stats ? (
                  <>
                    <p className="text-lg font-bold text-neutral-100">{stats.totalColumns}</p>
                    <p className="text-xs text-neutral-500">{stats.primaryKeys} PK, {stats.foreignKeys} FK</p>
                  </>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-neutral-800 bg-neutral-900/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-purple-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-neutral-400">Rows</p>
                {isLoading ? (
                  <>
                    <Skeleton className="h-6 w-12 bg-neutral-800 mb-1" />
                    <Skeleton className="h-3 w-24 bg-neutral-800" />
                  </>
                ) : stats ? (
                  <>
                    <p className="text-lg font-bold text-neutral-100">{formatNumber(stats.totalRows)}</p>
                    <p className="text-xs text-neutral-500">{stats.dataPercentage.toFixed(1)}% populated</p>
                  </>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-neutral-800 bg-neutral-900/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5 text-orange-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-neutral-400">Views</p>
                {isLoading ? (
                  <>
                    <Skeleton className="h-6 w-8 bg-neutral-800 mb-1" />
                    <Skeleton className="h-3 w-16 bg-neutral-800" />
                  </>
                ) : stats ? (
                  <>
                    <p className="text-lg font-bold text-neutral-100">{stats.totalViews}</p>
                    <p className="text-xs text-neutral-500">Objects</p>
                  </>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compact Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border border-neutral-800 bg-neutral-900/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-200 flex items-center gap-2">
              <Server className="h-4 w-4" />
              Health
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-neutral-400">Data Coverage</span>
                {isLoading ? (
                  <Skeleton className="h-3 w-8 bg-neutral-800" />
                ) : stats ? (
                  <span className="text-neutral-300">{stats.tablesWithData}/{stats.totalTables}</span>
                ) : null}
              </div>
              {isLoading ? (
                <Skeleton className="h-1.5 w-full bg-neutral-800" />
              ) : stats ? (
                <Progress value={stats.dataPercentage} className="h-1.5" />
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div>
                {isLoading ? (
                  <>
                    <Skeleton className="h-6 w-8 bg-neutral-800 mb-1 mx-auto" />
                    <p className="text-xs text-neutral-400">Primary Keys</p>
                  </>
                ) : stats ? (
                  <>
                    <p className="text-lg font-bold text-neutral-100">{stats.primaryKeys}</p>
                    <p className="text-xs text-neutral-400">Primary Keys</p>
                  </>
                ) : null}
              </div>
              <div>
                {isLoading ? (
                  <>
                    <Skeleton className="h-6 w-8 bg-neutral-800 mb-1 mx-auto" />
                    <p className="text-xs text-neutral-400">Foreign Keys</p>
                  </>
                ) : stats ? (
                  <>
                    <p className="text-lg font-bold text-neutral-100">{stats.foreignKeys}</p>
                    <p className="text-xs text-neutral-400">Foreign Keys</p>
                  </>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-neutral-800 bg-neutral-900/20 lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-200 flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Largest Tables
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded bg-neutral-800 flex items-center justify-center text-xs text-neutral-400 flex-shrink-0">
                        {i + 1}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <Skeleton className="h-4 w-24 bg-neutral-800" />
                        <Skeleton className="h-3 w-16 bg-neutral-800" />
                      </div>
                    </div>
                    <Skeleton className="h-5 w-12 bg-neutral-800" />
                  </div>
                ))}
              </div>
            ) : topTables.length > 0 ? (
              <div className="space-y-2">
                {topTables.slice(0, 3).map((table, index) => (
                  <div key={`${table.schema}.${table.name}`} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded bg-neutral-800 flex items-center justify-center text-xs text-neutral-400 flex-shrink-0">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-200 truncate">{table.name}</p>
                        <p className="text-xs text-neutral-400">{table.schema}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs ml-2 flex-shrink-0">
                      {formatNumber(table.row_count || 0)}
                    </Badge>
                  </div>
                ))}
                {topTables.length > 3 && (
                  <p className="text-xs text-neutral-500 text-center pt-1">
                    +{topTables.length - 3} more tables
                  </p>
                )}
              </div>
            ) : !error ? (
              <div className="text-center py-3">
                <Table className="h-6 w-6 mx-auto text-neutral-400 mb-1" />
                <p className="text-xs text-neutral-400">No table data available</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 