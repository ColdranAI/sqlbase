"use client"

import { useEffect, useState } from "react"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogOut, Settings, User } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface UserSession {
  user: {
    id: string
    name: string
    email: string
    image?: string
    emailVerified: boolean
  }
}

const Vercel = () => (
  <svg
    className="-translate-y-[0.5px] h-[18px] w-[18px] fill-current"
    fill="none"
    height="22"
    viewBox="0 0 235 203"
    xmlns="http://www.w3.org/2000/svg"
  >
    <title>Vercel</title>
    <path d="M117.082 0L234.164 202.794H0L117.082 0Z" fill="currentColor" />
  </svg>
);

const SQLBase = () => (
  <svg className="-translate-y-[0.5px] hover:-translate-x-1 duration-300 fill-current" height="32" width="32" viewBox="0 0 372 243" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect className="text-[#B7B7B7]" width="106.931" height="39.1582" />
<rect className="text-[#B7B7B7]" x="132.529" width="106.931" height="39.1582" />
<rect className="text-[#B7B7B7]" x="265.07" width="106.931" height="39.1582" />
<rect x="265.07" y="67.7725" width="106.931" height="39.1582" fill="white"/>
<rect x="265.07" y="135.545" width="106.931" height="39.1582" fill="white"/>
<rect x="132.529" y="67.7725" width="106.931" height="39.1582" fill="white"/>
<rect y="67.7725" width="106.931" height="39.1582" fill="white"/>
<rect y="135.545" width="106.931" height="39.1582" fill="white"/>
<rect x="132.529" y="135.545" width="106.931" height="39.1582" fill="white"/>
<rect x="265.07" y="203.319" width="106.931" height="39.1582" fill="white"/>
<rect x="132.529" y="203.319" width="106.931" height="39.1582" fill="white"/>
<rect y="203.319" width="106.931" height="39.1582" fill="white"/>
</svg>

);

const Slash = () => (
  <svg
    height={16}
    strokeLinejoin="round"
    className="size-4 text-[#00000014]"
    viewBox="0 0 16 16"
    width={16}
  >
    <title>Slash</title>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4.01526 15.3939L4.3107 14.7046L10.3107 0.704556L10.6061 0.0151978L11.9849 0.606077L11.6894 1.29544L5.68942 15.2954L5.39398 15.9848L4.01526 15.3939Z"
      fill="var(--color-border)"
    />
  </svg>
);

const TwitterX = () => (
  <svg
    className="h-4 w-4 fill-current"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <title>X (Twitter)</title>
    <g>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </g>
  </svg>
);

export function Navbar() {
  const [session, setSession] = useState<UserSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data } = await authClient.getSession()
        if (data) {
          setSession(data as UserSession)
        }
      } catch (error) {
        console.error("Failed to fetch session:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSession()
  }, [])

  const handleSignOut = async () => {
    try {
      // Clear database connection cache on sign out
      if (session?.user?.id) {
        localStorage.removeItem(`db-connection-${session.user.id}`)
        localStorage.removeItem(`db-connection-timestamp-${session.user.id}`)
      }
      await authClient.signOut()
      setSession(null)
      router.push("/")
    } catch (error) {
      console.error("Failed to sign out:", error)
    }
  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="px-6 flex h-16 items-center justify-between">
        {/* Left side - Logo and Navigation */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <SQLBase />
            {/* <p className="font-semibold text-lg tracking-tight">SQLBase</p> */}
          </Link>
          
          <div className="hidden md:flex items-center pl-3 gap-6">
            <Link 
              href="/" 
              className="text-sm text-neutral-400 hover:text-neutral-200 font-medium transition-colors"
            >
              Products
            </Link>
            <Link 
              href="/docs" 
              className="text-sm text-neutral-400 hover:text-neutral-200 font-medium transition-colors"
            >
              Docs
            </Link>
            <Link 
              href="/pricing" 
              className="text-sm text-neutral-400 hover:text-neutral-200 font-medium transition-colors"
            >
              Pricing
            </Link>
          </div>
        </div>

        {/* Right side - Social and Auth */}
        <div className="flex items-center gap-3">
          <a
            href="https://x.com/haydenbleasel"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center p-2 rounded-md hover:bg-accent transition-colors"
            aria-label="Follow us on X (Twitter)"
          >
            <TwitterX />
          </a>
          
          {isLoading ? (
            <div className="h-8 w-16 animate-pulse rounded bg-gray-200" />
          ) : session ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={session.user.image} alt={session.user.name} />
                    <AvatarFallback>
                      {session.user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    <p className="font-medium">{session.user.name}</p>
                    <p className="w-[200px] truncate text-sm text-muted-foreground">
                      {session.user.email}
                    </p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard">
                    <User className="mr-2 h-4 w-4" />
                    Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/auth/signin">Sign In</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/auth/signup">Sign Up</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
} 