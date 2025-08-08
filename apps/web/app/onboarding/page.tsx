"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { apiClient } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Building, CheckCircle, Loader2, Sparkles } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface UserSession {
  user: {
    id: string
    name: string
    email: string
    emailVerified: boolean
  }
}

export default function OnboardingPage() {
  const router = useRouter()
  const [session, setSession] = useState<UserSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    organizationName: "",
    organizationDescription: "",
    jobTitle: "",
    teamSize: "",
    useCase: ""
  })

  useEffect(() => {
    checkSession()
  }, [])

  const checkSession = async () => {
    try {
      const { data } = await authClient.getSession()
      if (!data?.user) {
        router.push("/auth/signin")
        return
      }
      
      setSession(data as UserSession)
      
      // Pre-fill name from session
      if (data.user.name) {
        const nameParts = data.user.name.split(" ")
        setFormData(prev => ({
          ...prev,
          firstName: nameParts[0] || "",
          lastName: nameParts.slice(1).join(" ") || ""
        }))
      }
    } catch (error) {
      console.error("Failed to check session:", error)
      router.push("/auth/signin")
    } finally {
      setIsLoading(false)
    }
  }

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim()
      .substring(0, 50)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session?.user) return

    setIsSubmitting(true)
    setError(null)

    try {
      // Create organization
      const orgSlug = generateSlug(formData.organizationName)
      const orgResponse = await apiClient.createOrganization(session.user.id, {
        name: formData.organizationName,
        slug: orgSlug,
        description: formData.organizationDescription
      })

      if (orgResponse.error) {
        throw new Error(orgResponse.error)
      }

      // Store onboarding data for analytics/tracking
      await apiClient.createMetric({
        metric_type: "user_onboarded",
        metadata: {
          user_id: session.user.id,
          organization_id: orgResponse.data.id,
          job_title: formData.jobTitle,
          team_size: formData.teamSize,
          use_case: formData.useCase,
          organization_name: formData.organizationName
        }
      })

      setSuccess(true)
      
      // Redirect to dashboard after success
      setTimeout(() => {
        router.push("/dashboard")
      }, 2000)

    } catch (error) {
      console.error("Onboarding failed:", error)
      setError(error instanceof Error ? error.message : "Failed to complete onboarding")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="flex items-center gap-2 text-neutral-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading...
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-green-800 bg-green-950/20">
          <CardContent className="p-8 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-600/20 flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-green-100 mb-2">Welcome to SQLBase!</h2>
            <p className="text-green-200/80 mb-4">
              Your organization has been created successfully. Redirecting to your dashboard...
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-green-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              Setting up your workspace
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 rounded-full bg-blue-600/20 flex items-center justify-center mb-4">
            <Sparkles className="h-8 w-8 text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to SQLBase</h1>
          <p className="text-neutral-400 text-lg">
            Let's set up your workspace and get you started with database visualization
          </p>
        </div>

        <Card className="border-neutral-800 bg-neutral-900/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-neutral-100">
              <Building className="h-5 w-5 text-blue-400" />
              Create Your Organization
            </CardTitle>
            <CardDescription className="text-neutral-400">
              Tell us about yourself and your team to customize your SQLBase experience
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-neutral-200">About You</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName" className="text-neutral-300">First Name</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => handleInputChange("firstName", e.target.value)}
                      className="bg-neutral-800 border-neutral-700 text-neutral-100"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName" className="text-neutral-300">Last Name</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange("lastName", e.target.value)}
                      className="bg-neutral-800 border-neutral-700 text-neutral-100"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="jobTitle" className="text-neutral-300">Job Title</Label>
                    <Input
                      id="jobTitle"
                      placeholder="e.g., Data Engineer, CTO"
                      value={formData.jobTitle}
                      onChange={(e) => handleInputChange("jobTitle", e.target.value)}
                      className="bg-neutral-800 border-neutral-700 text-neutral-100"
                    />
                  </div>
                  <div>
                    <Label htmlFor="teamSize" className="text-neutral-300">Team Size</Label>
                    <Input
                      id="teamSize"
                      placeholder="e.g., 1-5, 10-50, 100+"
                      value={formData.teamSize}
                      onChange={(e) => handleInputChange("teamSize", e.target.value)}
                      className="bg-neutral-800 border-neutral-700 text-neutral-100"
                    />
                  </div>
                </div>
              </div>

              {/* Organization Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-neutral-200">Your Organization</h3>
                <div>
                  <Label htmlFor="organizationName" className="text-neutral-300">Organization Name *</Label>
                  <Input
                    id="organizationName"
                    placeholder="e.g., Acme Corp, MyStartup"
                    value={formData.organizationName}
                    onChange={(e) => handleInputChange("organizationName", e.target.value)}
                    className="bg-neutral-800 border-neutral-700 text-neutral-100"
                    required
                  />
                  {formData.organizationName && (
                    <p className="text-xs text-neutral-500 mt-1">
                      URL will be: sqlbase.com/org/{generateSlug(formData.organizationName)}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="organizationDescription" className="text-neutral-300">Description (Optional)</Label>
                  <Textarea
                    id="organizationDescription"
                    placeholder="Brief description of your organization or team"
                    value={formData.organizationDescription}
                    onChange={(e) => handleInputChange("organizationDescription", e.target.value)}
                    className="bg-neutral-800 border-neutral-700 text-neutral-100"
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="useCase" className="text-neutral-300">Primary Use Case</Label>
                  <Input
                    id="useCase"
                    placeholder="e.g., Analytics, Data exploration, Team collaboration"
                    value={formData.useCase}
                    onChange={(e) => handleInputChange("useCase", e.target.value)}
                    className="bg-neutral-800 border-neutral-700 text-neutral-100"
                  />
                </div>
              </div>

              {error && (
                <Alert className="border-red-800 bg-red-950/50">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  <AlertDescription className="text-red-300">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={isSubmitting || !formData.organizationName || !formData.firstName}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating your workspace...
                  </div>
                ) : (
                  "Create Organization & Continue"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-neutral-500 mt-6">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  )
} 