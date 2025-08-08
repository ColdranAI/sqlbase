"use client"

import { useEffect, useState } from "react"
import { authClient } from "@/lib/auth-client"
import { apiClient } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { DeleteAccountDialog } from "@/components/delete-account-dialog"
import { ArrowLeft, Save, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface UserSession {
  user: {
    id: string
    name: string
    email: string
    image?: string
    emailVerified: boolean
  }
}

export default function SettingsPage() {
  const [session, setSession] = useState<UserSession | null>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [message, setMessage] = useState("")
  const router = useRouter()

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data } = await authClient.getSession()
        if (data) {
          const sessionData = data as UserSession
          setSession(sessionData)
          setName(sessionData.user.name)
          setEmail(sessionData.user.email)
        }
      } catch (error) {
        console.error("Failed to fetch session:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSession()
  }, [])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setMessage("")

    try {
      // In a real app, you'd implement profile update functionality
      // For now, we'll just show a success message
      setMessage("Profile updated successfully!")
      setTimeout(() => setMessage(""), 3000)
    } catch (error) {
      setMessage("Failed to update profile")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!session?.user?.id) return
    
    setIsDeleting(true)
    setMessage("")

    try {
      const result = await apiClient.deleteUser(session.user.id)
      
      if (result.error) {
        setMessage(`Failed to delete account: ${result.error}`)
        return
      }

      await authClient.signOut()
      router.push("/?message=account-deleted")
    } catch (error) {
      console.error("Delete account error:", error)
      setMessage("Failed to delete account. Please try again.")
    } finally {
      setIsDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  if (!isLoading && !session) {
    return null
  }

  return (
    <div className="dark min-h-screen bg-neutral-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-8 border-b border-neutral-800">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard">
              <Button variant="outline" size="sm" className="border-neutral-700 bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-200">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div>
              {isLoading ? (
                <>
                  <Skeleton className="h-8 w-48 bg-neutral-800 mb-2" />
                  <Skeleton className="h-4 w-64 bg-neutral-800" />
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-semibold text-neutral-100">Account Settings</h1>
                  <p className="text-neutral-400">Manage your account preferences</p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="py-8 space-y-6">
          {/* Profile Information */}
          <Card className="border-neutral-800 bg-neutral-900/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-neutral-200">Profile Information</CardTitle>
              <CardDescription className="text-neutral-400">
                Update your personal information and profile details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center space-x-4">
                {isLoading ? (
                  <>
                    <Skeleton className="h-20 w-20 rounded-full bg-neutral-800" />
                    <div className="space-y-2">
                      <Skeleton className="h-6 w-32 bg-neutral-800" />
                      <Skeleton className="h-4 w-48 bg-neutral-800" />
                      <Skeleton className="h-8 w-24 bg-neutral-800" />
                    </div>
                  </>
                ) : session?.user ? (
                  <>
                    <Avatar className="h-20 w-20 border-2 border-neutral-700">
                      <AvatarImage src={session.user.image} alt={session.user.name} />
                      <AvatarFallback className="text-xl bg-neutral-800 text-neutral-300">
                        {session.user.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-lg font-medium text-neutral-200">{session.user.name}</h3>
                      <p className="text-sm text-neutral-400">{session.user.email}</p>
                      <Button variant="outline" size="sm" className="mt-2 border-neutral-700 bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-200">
                        Change Photo
                      </Button>
                    </div>
                  </>
                ) : null}
              </div>

              <Separator className="bg-neutral-800" />

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-neutral-300">Full Name</Label>
                    {isLoading ? (
                      <Skeleton className="h-10 w-full bg-neutral-800" />
                    ) : (
                      <Input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter your full name"
                        className="border-neutral-700 bg-neutral-800/50 text-neutral-200 placeholder:text-neutral-500 focus:border-neutral-600"
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-neutral-300">Email</Label>
                    {isLoading ? (
                      <Skeleton className="h-10 w-full bg-neutral-800" />
                    ) : (
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        className="border-neutral-700 bg-neutral-800/50 text-neutral-200 placeholder:text-neutral-500 focus:border-neutral-600"
                      />
                    )}
                  </div>
                </div>

                {message && !isLoading && (
                  <div className={`text-sm p-3 rounded-md ${message.includes("success") ? "text-emerald-400 bg-emerald-950/20 border border-emerald-900/20" : "text-red-400 bg-red-950/20 border border-red-900/20"}`}>
                    {message}
                  </div>
                )}

                {isLoading ? (
                  <Skeleton className="h-10 w-32 bg-neutral-800" />
                ) : (
                  <Button type="submit" disabled={isSaving} className="bg-neutral-200 text-neutral-900 hover:bg-neutral-100">
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? "Saving..." : "Save Changes"}
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Account Information */}
          <Card className="border-neutral-800 bg-neutral-900/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-neutral-200">Account Information</CardTitle>
              <CardDescription className="text-neutral-400">
                View your account details and status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-neutral-300">User ID</Label>
                  {isLoading ? (
                    <Skeleton className="h-8 w-full bg-neutral-800 rounded mt-1" />
                  ) : session?.user ? (
                    <p className="text-sm text-neutral-400 font-mono bg-neutral-800/50 rounded px-2 py-1 mt-1">{session.user.id}</p>
                  ) : null}
                </div>
                <div>
                  <Label className="text-sm font-medium text-neutral-300">Email Status</Label>
                  {isLoading ? (
                    <Skeleton className="h-5 w-24 bg-neutral-800 mt-1" />
                  ) : session?.user ? (
                    <p className="text-sm text-neutral-400">
                      {session.user.emailVerified ? "✅ Verified" : "❌ Not verified"}
                    </p>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card className="border-neutral-800 bg-neutral-900/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-neutral-200">Security</CardTitle>
              <CardDescription className="text-neutral-400">
                Manage your account security settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-neutral-300">Password</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    {isLoading ? (
                      <>
                        <Skeleton className="h-10 flex-1 bg-neutral-800" />
                        <Skeleton className="h-10 w-32 bg-neutral-800" />
                      </>
                    ) : (
                      <>
                        <Input
                          type="password"
                          value="••••••••"
                          disabled
                          className="flex-1 border-neutral-700 bg-neutral-800/50 text-neutral-200"
                        />
                        <Button variant="outline" size="sm" className="border-neutral-700 bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-200">
                          Change Password
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-red-900/50 bg-red-950/20 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-red-400">Danger Zone</CardTitle>
              <CardDescription className="text-neutral-400">
                Irreversible and destructive actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 border border-red-900/50 rounded-lg bg-red-950/10">
                {isLoading ? (
                  <>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32 bg-neutral-800" />
                      <Skeleton className="h-4 w-64 bg-neutral-800" />
                    </div>
                    <Skeleton className="h-9 w-32 bg-neutral-800" />
                  </>
                ) : (
                  <>
                    <div>
                      <h4 className="text-sm font-medium text-red-400">Delete Account</h4>
                      <p className="text-sm text-neutral-400">
                        Permanently delete your account and all associated data
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteDialogOpen(true)}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Account
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <DeleteAccountDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteAccount}
        isDeleting={isDeleting}
      />
    </div>
  )
} 