"use client"

import { useState, useEffect } from "react"
import { apiClient, type DatabaseConfig } from "@/lib/api"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Database, Server, Shield, Link as LinkIcon, Copy, Check } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface DatabaseConnectionProps {
  onConnectionSuccess?: () => void
  onConnectionChange?: (connected: boolean) => void
  isOrganizationProject?: boolean
  organizationId?: string
  projectId?: string
}

export function DatabaseConnection({ 
  onConnectionSuccess, 
  onConnectionChange,
  isOrganizationProject = false,
  organizationId,
  projectId
}: DatabaseConnectionProps) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("database-url")
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">("idle")
  const [statusMessage, setStatusMessage] = useState("")
  const [copiedStates, setCopiedStates] = useState<{[key: string]: boolean}>({})
  
  // Test connection state management
  const [isCurrentConfigTested, setIsCurrentConfigTested] = useState(false)
  const [testedConfig, setTestedConfig] = useState<string>("")

  // Database URL form state
  const [databaseUrl, setDatabaseUrl] = useState("")

  // SSH form state
  const [sshHost, setSshHost] = useState("")
  const [sshPort, setSshPort] = useState("22")
  const [sshUser, setSshUser] = useState("")
  const [sshKeyPath, setSshKeyPath] = useState("")

  // Wireguard form state
  const [localDbUrl, setLocalDbUrl] = useState("")
  const [customWireguardConfig, setCustomWireguardConfig] = useState("")

  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const session = await authClient.getSession()
        if (session.data?.user) {
          setCurrentUser(session.data.user)
        }
      } catch (error) {
        console.error("Failed to get current user:", error)
      }
    }
    getCurrentUser()
  }, [])

  // Generate a hash of the current configuration for comparison
  const getCurrentConfigHash = () => {
    switch (activeTab) {
      case "database-url":
        return `database-url:${databaseUrl}`
      case "ssh":
        return `ssh:${sshHost}:${sshPort}:${sshUser}:${sshKeyPath}:${databaseUrl}`
      case "wireguard-config":
        return `wireguard:${customWireguardConfig}:${localDbUrl}`
      default:
        return ""
    }
  }

  // Reset test connection state when configuration changes
  const resetTestState = () => {
    const currentConfig = getCurrentConfigHash()
    if (currentConfig !== testedConfig) {
      setIsCurrentConfigTested(false)
      setTestedConfig("")
      if (connectionStatus === "success") {
        setConnectionStatus("idle")
        setStatusMessage("")
      }
    }
  }

  // Reset test state when any input changes
  useEffect(() => {
    resetTestState()
  }, [databaseUrl, sshHost, sshPort, sshUser, sshKeyPath, localDbUrl, customWireguardConfig, activeTab])

  // Handle input changes with test state reset
  const handleDatabaseUrlChange = (value: string) => {
    setDatabaseUrl(value)
    // resetTestState will be called by useEffect
  }

  const handleSshHostChange = (value: string) => {
    setSshHost(value)
  }

  const handleSshPortChange = (value: string) => {
    setSshPort(value)
  }

  const handleSshUserChange = (value: string) => {
    setSshUser(value)
  }

  const handleSshKeyPathChange = (value: string) => {
    setSshKeyPath(value)
  }

  const handleLocalDbUrlChange = (value: string) => {
    setLocalDbUrl(value)
  }

  const handleCustomWireguardConfigChange = (value: string) => {
    setCustomWireguardConfig(value)
  }

  const saveDatabaseConfig = async () => {
    if (!currentUser?.id) {
      setStatusMessage("User not authenticated")
      setConnectionStatus("error")
      return
    }

    setIsLoading(true)
    setConnectionStatus("idle")

    try {
      let config: DatabaseConfig

      switch (activeTab) {
        case "database-url":
          if (!databaseUrl) {
            throw new Error("Database URL is required")
          }
          config = {
            connection_type: "postgresql",
            database_url: databaseUrl,
          }
          break

        case "ssh":
          if (!sshHost || !sshUser || !databaseUrl) {
            throw new Error("SSH host, user, and database URL are required")
          }
          config = {
            connection_type: "ssh",
            database_url: databaseUrl,
            ssh_config: {
              host: sshHost,
              port: sshPort,
              user: sshUser,
              key_path: sshKeyPath,
            },
          }
          break

        case "wireguard-config":
          if (!customWireguardConfig || !localDbUrl) {
            throw new Error("WireGuard config and database URL are required")
          }
          config = {
            connection_type: "wireguard",
            database_url: "",
            wireguard_config: {
              config: customWireguardConfig,
              internal_db_url: localDbUrl,
            },
          }
          break

        default:
          throw new Error("Invalid connection type")
      }

      let result
      if (isOrganizationProject && organizationId && projectId) {
        result = await apiClient.createOrgProjectDatabaseConfig(currentUser.id, organizationId, projectId, config)
      } else {
        result = await apiClient.createDatabaseConfig(currentUser.id, config)
      }
      
      if (result.error) {
        throw new Error(result.error)
      }

      setStatusMessage("Database configuration saved successfully!")
      setConnectionStatus("success")
      
      // Notify parent components about the connection
      onConnectionChange?.(true)
      
      setTimeout(() => {
        handleDialogOpenChange(false)
        // Call the success callback to notify parent component
        onConnectionSuccess?.()
      }, 2000)

    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save configuration"
      setStatusMessage(message)
      setConnectionStatus("error")
    } finally {
      setIsLoading(false)
    }
  }

  const testConnection = async () => {
    if (!currentUser?.id) {
      setStatusMessage("User not authenticated")
      setConnectionStatus("error")
      return
    }

    setIsTestingConnection(true)
    setConnectionStatus("idle")

    try {
      // Build the configuration from current form state
      let config: DatabaseConfig

      switch (activeTab) {
        case "database-url":
          if (!databaseUrl) {
            throw new Error("Database URL is required")
          }
          config = {
            connection_type: "postgresql",
            database_url: databaseUrl,
          }
          break

        case "ssh":
          if (!sshHost || !sshUser || !databaseUrl) {
            throw new Error("SSH host, user, and database URL are required")
          }
          config = {
            connection_type: "ssh",
            database_url: databaseUrl,
            ssh_config: {
              host: sshHost,
              port: sshPort,
              user: sshUser,
              key_path: sshKeyPath,
            },
          }
          break

        case "wireguard-config":
          if (!customWireguardConfig || !localDbUrl) {
            throw new Error("WireGuard config and database URL are required")
          }
          config = {
            connection_type: "wireguard",
            database_url: "",
            wireguard_config: {
              config: customWireguardConfig,
              internal_db_url: localDbUrl,
            },
          }
          break

        default:
          throw new Error("Invalid connection type")
      }

      // Test the URL without saving it
      const result = await apiClient.testDatabaseURL(currentUser.id, config)
      
      if (result.error) {
        throw new Error(result.error)
      }

      // Mark current configuration as tested successfully
      const currentConfigHash = getCurrentConfigHash()
      setIsCurrentConfigTested(true)
      setTestedConfig(currentConfigHash)
      
      setStatusMessage("Database connection successful! You can now save the configuration.")
      setConnectionStatus("success")

    } catch (error) {
      // Reset test state on error
      setIsCurrentConfigTested(false)
      setTestedConfig("")
      
      const message = error instanceof Error ? error.message : "Connection test failed"
      setStatusMessage(message)
      setConnectionStatus("error")
    } finally {
      setIsTestingConnection(false)
    }
  }

  // Get the appropriate button text and style based on test state
  const getTestButtonProps = () => {
    if (isTestingConnection) {
      return {
        text: "Testing...",
        className: "border-neutral-700 bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-200"
      }
    }
    
    if (isCurrentConfigTested) {
      return {
        text: "✓ Connection Tested",
        className: "border-neutral-700 bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-200"
      }
    }
    
    return {
      text: "Test Connection",
      className: "border-neutral-700 bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-200"
    }
  }

  // Get the appropriate connect button text and style based on test state
  const getConnectButtonProps = () => {
    if (isLoading) {
      return {
        text: "Connecting...",
        className: "bg-white text-neutral-900 hover:bg-neutral-100"
      }
    }
    
    if (isCurrentConfigTested) {
      return {
        text: "Save Configuration",
        className: "bg-white text-neutral-900 hover:bg-neutral-100"
      }
    }
    
    return {
      text: "Save Configuration",
      className: "bg-white text-neutral-900 hover:bg-neutral-100"
    }
  }

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedStates(prev => ({ ...prev, [key]: true }))
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [key]: false }))
      }, 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  const exampleUrl = "postgresql://username:password@localhost:5432/database_name"
  const sshCommand = "ssh -i ~/.ssh/your-key.pem user@your-server.com"
  const wireguardConfig = `[Interface]
PrivateKey = 8c23b...yourprivatekey...==
Address = 100.100.10.1/32
DNS = 100.100.0.1
MTU = 1420

[Peer]
PublicKey = LfnsT...peerpublickey...==
AllowedIPs = 100.100.0.0/16
Endpoint = fly-production-wireguard.fly.dev:51820
PersistentKeepalive = 25`

  // Reset dialog state when opening/closing
  const handleDialogOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) {
      // Reset states when closing dialog
      setConnectionStatus("idle")
      setStatusMessage("")
      setIsCurrentConfigTested(false)
      setTestedConfig("")
    }
  }

  return (
    <div className="h-full flex items-center justify-center">
      <Card className="border border-neutral-800 bg-neutral-900/20 backdrop-blur-sm transition-colors max-w-2xl w-full">
        <div className="w-full h-full flex flex-col overflow-y-auto">
        <CardContent className="flex flex-col items-center justify-center py-16 px-8 text-center">
          <div className="w-16 h-16 rounded-full bg-neutral-800/50 flex items-center justify-center mb-6">
            <Database className="w-8 h-8 text-neutral-400" />
          </div>
          
          <h3 className="text-xl font-semibold text-neutral-200 mb-2">
            Connect Your PostgreSQL Database
          </h3>
          
          <p className="text-neutral-400 mb-8">
            Get started with Database URL, SSH, or Wireguard Config.
          </p>

          <Dialog open={open} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
              <Button 
                size="lg" 
                className="bg-white text-neutral-900 hover:bg-neutral-100 px-8 py-3 text-base font-medium"
              >
                <Database className="w-5 h-5 mr-2" />
                Connect PostgreSQL
              </Button>
            </DialogTrigger>
            
            <DialogContent className="sm:max-w-4xl flex flex-col max-h-[85vh] p-0 overflow-hidden">
              
              {/* Top bar - Sticky Header */}
              <div className="sticky top-0 z-10 bg-neutral-950 border-b border-neutral-800 px-6 py-4">
                <DialogHeader>
                  <DialogTitle className="text-2xl text-neutral-100">Connect PostgreSQL Database</DialogTitle>
                  <DialogDescription className="text-neutral-400">
                    Choose your preferred connection method to get started with PostgreSQL.
                  </DialogDescription>
                  <div className="mt-2 flex items-center space-x-2">
                    <Shield className="w-4 h-4 text-green-400" />
                    <p className="text-xs text-green-400">
                      All configurations are encrypted with enterprise-grade AES-256-GCM encryption
                    </p>
                  </div>
                </DialogHeader>
              </div>

              {/* Scrollable content area */}
              <div className="flex-1 overflow-y-auto">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col flex-1">
                  
                  <div className="sticky top-0 z-10 px-6 py-4 bg-neutral-950 border-b border-neutral-800">
                    <TabsList className="grid w-full grid-cols-3 bg-neutral-900/50">
                      <TabsTrigger 
                        value="database-url" 
                        className="data-[state=active]:bg-neutral-800 data-[state=active]:text-neutral-100"
                      >
                        <LinkIcon className="w-4 h-4 mr-2" />
                        Database URL
                      </TabsTrigger>
                      <TabsTrigger 
                        value="ssh" 
                        className="data-[state=active]:bg-neutral-800 data-[state=active]:text-neutral-100"
                      >
                        <Server className="w-4 h-4 mr-2" />
                        SSH
                      </TabsTrigger>
                      <TabsTrigger 
                        value="wireguard-config" 
                        className="data-[state=active]:bg-neutral-800 data-[state=active]:text-neutral-100"
                      >
                        <Shield className="w-4 h-4 mr-2" />
                        Wireguard Config
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <div className="flex-1 px-6 py-4">

                <TabsContent value="database-url" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="database-url" className="text-neutral-200 text-base font-medium">
                        PostgreSQL Connection URL
                      </Label>
                      <p className="text-sm text-neutral-400 mt-1 mb-3">
                        Enter your PostgreSQL connection string.
                      </p>
                      <div className="relative">
                        <Input
                          id="database-url"
                          placeholder={exampleUrl}
                          value={databaseUrl}
                          onChange={(e) => handleDatabaseUrlChange(e.target.value)}
                          className="bg-neutral-900/50 border-neutral-700 text-neutral-200 placeholder:text-neutral-500 pr-12"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-neutral-800"
                          onClick={() => copyToClipboard(exampleUrl, "db-url")}
                        >
                          {copiedStates["db-url"] ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4 text-neutral-400" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="bg-neutral-900/30 rounded-lg p-4 border border-neutral-800">
                      <h4 className="text-neutral-200 font-medium mb-2">Connection URL Format</h4>
                      <code className="text-sm text-neutral-400 font-mono">
                        postgresql://[username]:[password]@[host]:[port]/[database]
                      </code>
                      <div className="mt-3 flex items-center space-x-2">
                        <Shield className="w-4 h-4 text-green-400" />
                        <p className="text-xs text-green-400">
                          Your database credentials are encrypted with AES-256-GCM before storage
                        </p>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="ssh" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="ssh-host" className="text-neutral-200 text-base font-medium">
                        SSH Connection Details
                      </Label>
                      <p className="text-sm text-neutral-400 mt-1 mb-3">
                        Connect to your remote PostgreSQL server via SSH tunnel.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="ssh-host" className="text-neutral-300">Host</Label>
                        <Input
                          id="ssh-host"
                          placeholder="your-server.com"
                          value={sshHost}
                          onChange={(e) => handleSshHostChange(e.target.value)}
                          className="bg-neutral-900/50 border-neutral-700 text-neutral-200 placeholder:text-neutral-500 mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="ssh-port" className="text-neutral-300">Port</Label>
                        <Input
                          id="ssh-port"
                          placeholder="22"
                          value={sshPort}
                          onChange={(e) => handleSshPortChange(e.target.value)}
                          className="bg-neutral-900/50 border-neutral-700 text-neutral-200 placeholder:text-neutral-500 mt-1"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="ssh-user" className="text-neutral-300">Username</Label>
                        <Input
                          id="ssh-user"
                          placeholder="ubuntu"
                          value={sshUser}
                          onChange={(e) => handleSshUserChange(e.target.value)}
                          className="bg-neutral-900/50 border-neutral-700 text-neutral-200 placeholder:text-neutral-500 mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="ssh-key" className="text-neutral-300">Private Key Path</Label>
                        <Input
                          id="ssh-key"
                          placeholder="~/.ssh/id_rsa"
                          value={sshKeyPath}
                          onChange={(e) => handleSshKeyPathChange(e.target.value)}
                          className="bg-neutral-900/50 border-neutral-700 text-neutral-200 placeholder:text-neutral-500 mt-1"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="postgres-url" className="text-neutral-300">PostgreSQL URL (via SSH)</Label>
                      <Input
                        id="postgres-url"
                        placeholder="postgresql://postgres:password@localhost:5432/mydb"
                        value={activeTab === "ssh" ? databaseUrl : ""}
                        onChange={(e) => activeTab === "ssh" && handleDatabaseUrlChange(e.target.value)}
                        className="bg-neutral-900/50 border-neutral-700 text-neutral-200 placeholder:text-neutral-500 mt-1"
                      />
                    </div>

                    <div className="bg-neutral-900/30 rounded-lg p-4 border border-neutral-800">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-neutral-200 font-medium">SSH Command</Label>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(sshCommand, "ssh-cmd")}
                          className="h-8 px-2 hover:bg-neutral-800"
                        >
                          {copiedStates["ssh-cmd"] ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4 text-neutral-400" />
                          )}
                        </Button>
                      </div>
                      <code className="text-sm text-neutral-400 font-mono">
                        {sshCommand}
                      </code>
                      <div className="mt-3 flex items-center space-x-2">
                        <Shield className="w-4 h-4 text-green-400" />
                        <p className="text-xs text-green-400">
                          SSH credentials and keys are encrypted with AES-256-GCM before storage
                        </p>
                      </div>
                    </div>


                  </div>
                </TabsContent>

                <TabsContent value="wireguard-config" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-neutral-200 text-base font-medium">
                        Wireguard VPN Configuration
                      </Label>
                      <p className="text-sm text-neutral-400 mt-1 mb-3">
                        Configure Wireguard to securely access your PostgreSQL database.
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="local-db-url" className="text-neutral-200 text-base font-medium">
                        PostgreSQL URL (Inside VPN Network)
                      </Label>
                      <p className="text-sm text-neutral-400 mt-1 mb-3">
                        The PostgreSQL database URL accessible within the Wireguard network.
                      </p>
                      <div className="relative">
                        <Input
                          id="local-db-url"
                          placeholder="postgresql://postgres:password@10.0.0.10:5432/mydb"
                          value={localDbUrl}
                          onChange={(e) => handleLocalDbUrlChange(e.target.value)}
                          className="bg-neutral-900/50 border-neutral-700 text-neutral-200 placeholder:text-neutral-500 pr-12"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-neutral-800"
                          onClick={() => copyToClipboard("postgresql://postgres:password@10.0.0.10:5432/mydb", "local-db-url")}
                        >
                          {copiedStates["local-db-url"] ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4 text-neutral-400" />
                          )}
                      </Button>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <Label htmlFor="wireguard-config" className="text-neutral-300">Custom Wireguard Configuration</Label>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCustomWireguardConfigChange(wireguardConfig)}
                          className="border-neutral-700 bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-200 text-xs"
                        >
                          Load Example
                        </Button>
                      </div>
                      <p className="text-sm text-neutral-400 mt-1 mb-3">
                        Paste your Wireguard configuration file content here.
                      </p>
                      <Textarea
                        id="wireguard-config"
                        placeholder={wireguardConfig}
                        value={customWireguardConfig}
                        onChange={(e) => handleCustomWireguardConfigChange(e.target.value)}
                        className="bg-neutral-900/50 border-neutral-700 text-neutral-200 placeholder:text-neutral-500 font-mono text-sm min-h-[200px] resize-none"
                        rows={12}
                      />
                    </div>



                    <div className="bg-blue-950/20 border border-blue-800/30 rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Shield className="w-3 h-3 text-blue-500" />
                        </div>
                        <div>
                          <h4 className="text-blue-400 font-medium text-sm">Security Note</h4>
                          <p className="text-blue-300/80 text-sm mt-1">
                            Wireguard creates a secure tunnel to your PostgreSQL database. Your VPN configuration and credentials are encrypted with AES-256-GCM before storage for maximum security.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                  </div>
                </Tabs>
              </div>

              {/* Sticky Footer */}
              <div className="sticky bottom-0 z-10 p-6 border-t border-neutral-800 bg-neutral-950">
                {/* Status Message */}
                {statusMessage && (
                  <div className={`mb-4 p-3 rounded-lg text-sm ${
                    connectionStatus === "success" 
                      ? "bg-green-900/20 border border-green-800 text-green-400"
                      : connectionStatus === "error"
                      ? "bg-red-900/20 border border-red-800 text-red-400"
                      : "bg-blue-900/20 border border-blue-800 text-blue-400"
                  }`}>
                    {statusMessage}
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      handleDialogOpenChange(false)
                    }} 
                    disabled={isLoading || isTestingConnection}
                    className="border-neutral-700 bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-200"
                  >
                    Cancel
                  </Button>
                  <div className="flex space-x-3">
                    <Button 
                      variant="outline" 
                      onClick={testConnection}
                      disabled={isLoading || isTestingConnection || !currentUser?.id}
                      className={getTestButtonProps().className}
                    >
                      {getTestButtonProps().text}
                    </Button>
                    <Button 
                      onClick={saveDatabaseConfig}
                      disabled={isLoading || isTestingConnection || !currentUser?.id}
                      className={getConnectButtonProps().className}
                    >
                      {getConnectButtonProps().text}
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
        </div>
      </Card>
    </div>
  )
} 