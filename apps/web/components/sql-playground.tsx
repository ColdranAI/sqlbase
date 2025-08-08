"use client"

import { useState, useEffect } from "react"
import { apiClient } from "@/lib/api"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  Database, 
  Play, 
  History, 
  Clock, 
  BarChart3,
  Table,
  Columns,
  Eye,
  AlertTriangle
} from "lucide-react"

interface QueryResult {
  columns: string[]
  rows: any[][]
  row_count: number
  execution_time_ms: number
  explain_plan?: any[]
  warnings?: string[]
}

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
  views: TableInfo[]
}

interface SqlPlaygroundProps {
  isOrganizationProject?: boolean
  organizationId?: string
  projectId?: string
}

export function SqlPlayground({ 
  isOrganizationProject = false,
  organizationId,
  projectId
}: SqlPlaygroundProps = {}) {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [sql, setSql] = useState("SELECT 1 as hello, 'world' as message;")
  const [isExecuting, setIsExecuting] = useState(false)
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null)
  const [queryError, setQueryError] = useState<string | null>(null)
  const [schema, setSchema] = useState<SchemaInfo | null>(null)
  const [isLoadingSchema, setIsLoadingSchema] = useState(false)
  const [queryHistory, setQueryHistory] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState("editor")

  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const session = await authClient.getSession()
        if (session.data?.user) {
          setCurrentUser(session.data.user)
          loadSchema(session.data.user.id)
          loadQueryHistory(session.data.user.id)
        }
      } catch (error) {
        console.error("Failed to get current user:", error)
      }
    }
    getCurrentUser()
  }, [])

  const executeQuery = async () => {
    if (!currentUser?.id || !sql.trim()) return

    setIsExecuting(true)
    setQueryError(null)
    setQueryResult(null)

    try {
      let result
      if (isOrganizationProject && organizationId && projectId) {
        result = await apiClient.executeOrgProjectSQL(currentUser.id, organizationId, projectId, {
          sql: sql.trim(),
          options: {
            limit: 1000,
            timeout: 30,
          }
        })
      } else {
        result = await apiClient.executeSQL(currentUser.id, {
          sql: sql.trim(),
          options: {
            limit: 1000,
            timeout: 30,
          }
        })
      }

      if (result.error) {
        setQueryError(result.error)
      } else {
        setQueryResult(result.data)
        // Refresh query history after successful execution
        loadQueryHistory(currentUser.id)
      }
    } catch (error) {
      setQueryError(error instanceof Error ? error.message : "Query execution failed")
    } finally {
      setIsExecuting(false)
    }
  }

  const loadSchema = async (userId: string) => {
    setIsLoadingSchema(true)
    try {
      let result
      if (isOrganizationProject && organizationId && projectId) {
        result = await apiClient.getOrgProjectDatabaseSchema(userId, organizationId, projectId)
      } else {
        result = await apiClient.getDatabaseSchema(userId)
      }
      
      if (result.data) {
        setSchema(result.data)
      }
    } catch (error) {
      console.error("Failed to load schema:", error)
    } finally {
      setIsLoadingSchema(false)
    }
  }

  const loadQueryHistory = async (userId: string) => {
    try {
      const result = await apiClient.getQueryHistory(userId, 1, 10)
      if (result.data?.history) {
        setQueryHistory(result.data.history)
      }
    } catch (error) {
      console.error("Failed to load query history:", error)
    }
  }

  const formatExecutionTime = (ms: number) => {
    if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`
    if (ms < 1000) return `${ms.toFixed(1)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const isUserLoading = !currentUser

  return (
    <div className="w-full space-y-6">

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-neutral-900/50 border-neutral-800">
          <TabsTrigger value="editor" className="flex items-center gap-2 data-[state=active]:bg-neutral-800 data-[state=active]:text-neutral-100">
            <Play className="h-4 w-4" />
            Query Editor
          </TabsTrigger>
          <TabsTrigger value="schema" className="flex items-center gap-2 data-[state=active]:bg-neutral-800 data-[state=active]:text-neutral-100">
            <Table className="h-4 w-4" />
            Schema
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2 data-[state=active]:bg-neutral-800 data-[state=active]:text-neutral-100">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
          <TabsTrigger value="results" className="flex items-center gap-2 data-[state=active]:bg-neutral-800 data-[state=active]:text-neutral-100">
            <BarChart3 className="h-4 w-4" />
            Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="space-y-4">
          <Card className="border border-neutral-800 bg-neutral-900/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-neutral-100">
                <Database className="h-5 w-5" />
                SQL Query Editor
              </CardTitle>
              <CardDescription className="text-neutral-400">
                Write and execute SQL queries on your connected database
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isUserLoading ? (
                <Skeleton className="h-48 w-full bg-neutral-800" />
              ) : (
                <Textarea
                  value={sql}
                  onChange={(e) => setSql(e.target.value)}
                  placeholder="Enter your SQL query here..."
                  className="font-mono text-sm min-h-[200px] resize-none bg-neutral-950/50 border-neutral-700 text-neutral-100 placeholder:text-neutral-500"
                  rows={8}
                />
              )}
              
              <div className="flex justify-between items-center">
                <div className="text-sm text-neutral-400">
                  {isUserLoading ? (
                    <Skeleton className="h-4 w-24 bg-neutral-800" />
                  ) : (
                    `${sql.trim().length} characters`
                  )}
                </div>
                {isUserLoading ? (
                  <Skeleton className="h-10 w-32 bg-neutral-800" />
                ) : (
                  <Button 
                    onClick={executeQuery}
                    disabled={isExecuting || !sql.trim()}
                    className="flex items-center gap-2 bg-white text-neutral-900 hover:bg-neutral-100"
                  >
                    <Play className="h-4 w-4" />
                    {isExecuting ? "Executing..." : "Execute Query"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Query Error */}
          {queryError && (
            <Card className="border border-red-800 bg-red-900/20">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-red-400">Query Error</h4>
                    <p className="text-sm text-red-300 mt-1 font-mono">
                      {queryError}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="schema" className="space-y-4">
          <Card className="border border-neutral-800 bg-neutral-900/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-neutral-100">
                <Table className="h-5 w-5" />
                Database Schema
              </CardTitle>
              <CardDescription className="text-neutral-400">
                Explore your database tables and structure
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSchema ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="border border-neutral-700 bg-neutral-950/30 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <Skeleton className="h-5 w-32 bg-neutral-800" />
                        <Skeleton className="h-5 w-16 bg-neutral-800" />
                      </div>
                      <div className="space-y-2">
                        {[...Array(4)].map((_, j) => (
                          <Skeleton key={j} className="h-4 w-full bg-neutral-800" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : schema ? (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {schema.tables.map((table) => (
                      <div key={`${table.schema}.${table.name}`} className="border border-neutral-700 bg-neutral-950/30 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Table className="h-4 w-4 text-neutral-400" />
                            <span className="font-medium text-neutral-100">{table.name}</span>
                            <Badge variant="outline" className="text-xs border-neutral-600 text-neutral-300">
                              {table.schema}
                            </Badge>
                          </div>
                          {table.row_count !== undefined && (
                            <Badge variant="secondary" className="text-xs bg-neutral-800 text-neutral-200">
                              {table.row_count.toLocaleString()} rows
                            </Badge>
                          )}
                        </div>
                        
                        <div className="space-y-1">
                          {table.columns.map((column) => (
                            <div key={column.name} className="flex items-center justify-between text-sm py-1 px-2 hover:bg-neutral-800/50 rounded">
                              <div className="flex items-center gap-2">
                                <Columns className="h-3 w-3 text-neutral-400" />
                                <span className="font-mono text-neutral-200">{column.name}</span>
                                {column.is_primary_key && (
                                  <Badge variant="default" className="text-xs px-1 py-0 bg-blue-600 text-white">PK</Badge>
                                )}
                                {column.is_foreign_key && (
                                  <Badge variant="outline" className="text-xs px-1 py-0 border-orange-600 text-orange-400">FK</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-neutral-400">
                                <span className="font-mono text-xs">{column.type}</span>
                                {!column.nullable && (
                                  <span className="text-xs">NOT NULL</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8">
                  <Database className="h-12 w-12 mx-auto text-neutral-400 mb-4" />
                  <p className="text-neutral-400">No database schema available</p>
                  <p className="text-sm text-neutral-500 mt-1">
                    Make sure your database is connected and accessible
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card className="border border-neutral-800 bg-neutral-900/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-neutral-100">
                <History className="h-5 w-5" />
                Query History
              </CardTitle>
              <CardDescription className="text-neutral-400">
                Recent SQL queries and their execution results
              </CardDescription>
            </CardHeader>
            <CardContent>
              {queryHistory.length > 0 ? (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {queryHistory.map((query, index) => (
                      <div key={index} className="border border-neutral-700 bg-neutral-950/30 rounded-lg p-4 hover:bg-neutral-800/30 cursor-pointer"
                           onClick={() => setSql(query.sql)}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-neutral-400" />
                            <span className="text-sm text-neutral-400">
                              {new Date(query.executed_at).toLocaleString()}
                            </span>
                          </div>
                          <Badge variant="secondary" className="text-xs bg-neutral-800 text-neutral-200">
                            {formatExecutionTime(query.execution_time)}
                          </Badge>
                        </div>
                        <div className="font-mono text-sm text-neutral-200 bg-neutral-950/50 rounded p-2">
                          {query.sql.length > 100 ? `${query.sql.substring(0, 100)}...` : query.sql}
                        </div>
                        <div className="text-xs text-neutral-400 mt-2">
                          {query.row_count} rows returned
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8">
                  <History className="h-12 w-12 mx-auto text-neutral-400 mb-4" />
                  <p className="text-neutral-400">No query history available</p>
                  <p className="text-sm text-neutral-500 mt-1">
                    Execute some queries to see them here
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          {queryResult ? (
            <Card className="border border-neutral-800 bg-neutral-900/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-neutral-100">
                  <BarChart3 className="h-5 w-5" />
                  Query Results
                </CardTitle>
                <CardDescription className="flex items-center gap-4 text-neutral-400">
                  <span>{queryResult.row_count} rows returned</span>
                  <Separator orientation="vertical" className="h-4" />
                  <span>Executed in {formatExecutionTime(queryResult.execution_time_ms)}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                {queryResult.rows.length > 0 ? (
                  <ScrollArea className="h-[500px]">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-neutral-700">
                        <thead>
                          <tr className="bg-neutral-800">
                            {queryResult.columns.map((column, index) => (
                              <th key={index} className="border border-neutral-700 px-3 py-2 text-left font-medium text-neutral-100">
                                {column}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {queryResult.rows.map((row, rowIndex) => (
                            <tr key={rowIndex} className="hover:bg-neutral-800/30">
                              {row.map((cell, cellIndex) => (
                                <td key={cellIndex} className="border border-neutral-700 px-3 py-2 font-mono text-sm text-neutral-200">
                                  {cell === null ? (
                                    <span className="text-neutral-400 italic">NULL</span>
                                  ) : (
                                    String(cell)
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8">
                    <Eye className="h-12 w-12 mx-auto text-neutral-400 mb-4" />
                    <p className="text-neutral-400">No results to display</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border border-neutral-800 bg-neutral-900/20">
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 mx-auto text-neutral-400 mb-4" />
                  <p className="text-neutral-400">Execute a query to see results</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
} 