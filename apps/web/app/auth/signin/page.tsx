"use client"

import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Github, Database, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function SignInPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      // Get callback URL from query params (set by middleware)
      const searchParams = new URLSearchParams(window.location.search)
      const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'

      const { data, error } = await authClient.signIn.email({
        email,
        password,
        callbackURL: callbackUrl,
      })

      if (error) {
        setError(error.message || "Sign in failed")
      } else {
        router.push(callbackUrl)
      }
    } catch (err) {
      setError("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGitHubSignIn = async () => {
    setIsLoading(true)
    try {
      // Get callback URL from query params (set by middleware)
      const searchParams = new URLSearchParams(window.location.search)
      const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'

      await authClient.signIn.social({
        provider: "github",
        callbackURL: callbackUrl,
      })
    } catch (err) {
      setError("Failed to sign in with GitHub")
      setIsLoading(false)
    }
  }

  return (
    <div className="dark bg-neutral-950 flex flex-col">

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Logo/Branding */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-semibold text-neutral-100 mb-2">
              Welcome back
            </h1>
            <p className="text-neutral-400">
              Sign in to your database playground
            </p>
          </div>

          {/* Auth Card */}
          <Card className="border-neutral-800 bg-neutral-900/50 backdrop-blur-sm shadow-2xl">
            <CardContent className="p-6 space-y-6">
              <Button
                variant="outline"
                className="w-full border-neutral-700 bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-200"
                onClick={handleGitHubSignIn}
                disabled={isLoading}
              >
                <Github className="mr-2 h-4 w-4" />
                Continue with GitHub
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-neutral-800" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-neutral-900 px-3 text-neutral-500">Or continue with email</span>
                </div>
              </div>

              <form onSubmit={handleEmailSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-neutral-300">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border-neutral-700 bg-neutral-800/50 text-neutral-200 placeholder:text-neutral-500 focus:border-neutral-600"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-neutral-300">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="border-neutral-700 bg-neutral-800/50 text-neutral-200 placeholder:text-neutral-500 focus:border-neutral-600"
                    required
                  />
                </div>
                {error && (
                  <div className="text-sm text-red-400 bg-red-950/20 border border-red-900/20 rounded-md p-3">
                    {error}
                  </div>
                )}
                <Button 
                  type="submit" 
                  className="w-full bg-neutral-200 text-neutral-900 hover:bg-neutral-100 font-medium" 
                  disabled={isLoading}
                >
                  {isLoading ? "Signing in..." : "Sign in"}
                </Button>
              </form>

              <div className="text-center text-sm text-neutral-400">
                Don't have an account?{" "}
                <Link href="/auth/signup" className="font-medium text-neutral-200 hover:text-neutral-100 underline underline-offset-4">
                  Create account
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="mt-8 text-center text-xs text-neutral-500">
            By signing in, you agree to our{" "}
            <Link href="/terms" className="underline hover:text-neutral-400">Terms</Link>
            {" "}and{" "}
            <Link href="/privacy" className="underline hover:text-neutral-400">Privacy Policy</Link>
          </div>
        </div>
      </div>
    </div>
  )
} 