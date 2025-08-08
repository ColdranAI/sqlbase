"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AlertTriangle, Trash2 } from "lucide-react"

interface DeleteAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
  isDeleting: boolean
}

export function DeleteAccountDialog({ 
  open, 
  onOpenChange, 
  onConfirm, 
  isDeleting 
}: DeleteAccountDialogProps) {
  const [confirmText, setConfirmText] = useState("")
  const isConfirmValid = confirmText === "delete my account"

  const handleConfirm = async () => {
    if (isConfirmValid) {
      await onConfirm()
      setConfirmText("")
    }
  }

  const handleCancel = () => {
    setConfirmText("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-red-800 bg-red-950/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="h-5 w-5" />
            Delete Account
          </DialogTitle>
          <DialogDescription className="text-neutral-400">
            This action cannot be undone. This will permanently delete your account and remove all your data from our servers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-red-950/20 border border-red-900/30 rounded-lg p-4">
            <h4 className="text-sm font-medium text-red-400 mb-2">What will be deleted:</h4>
            <ul className="text-xs text-neutral-400 space-y-1">
              <li>• Your user account and profile</li>
              <li>• All database configurations</li>
              <li>• Query history and analytics</li>
              <li>• All associated data and settings</li>
            </ul>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-text" className="text-neutral-300">
              Type <span className="font-mono text-red-400">delete my account</span> to confirm:
            </Label>
            <Input
              id="confirm-text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="delete my account"
              className="bg-neutral-950/50 border-neutral-700 text-neutral-100 placeholder:text-neutral-500"
              disabled={isDeleting}
            />
          </div>
        </div>

        <DialogFooter className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={handleCancel}
            disabled={isDeleting}
            className="border-neutral-700 bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-200"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isConfirmValid || isDeleting}
            className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {isDeleting ? "Deleting..." : "Delete Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 