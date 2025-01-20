import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface NotificationState {
  isOpen: boolean
  title: string
  message: string
  type: 'success' | 'error'
}

export function useNotification() {
  const [notification, setNotification] = useState<NotificationState>({
    isOpen: false,
    title: '',
    message: '',
    type: 'success'
  })

  const showNotification = (title: string, message: string, type: 'success' | 'error' = 'success') => {
    setNotification({
      isOpen: true,
      title,
      message,
      type
    })
  }

  const hideNotification = () => {
    setNotification(prev => ({ ...prev, isOpen: false }))
  }

  const NotificationDialog = () => (
    <AlertDialog open={notification.isOpen} onOpenChange={hideNotification}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className={notification.type === 'error' ? 'text-red-600' : 'text-green-600'}>
            {notification.title}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {notification.message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={hideNotification}>
            OK
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return {
    showNotification,
    hideNotification,
    NotificationDialog
  }
} 