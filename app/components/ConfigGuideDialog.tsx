import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import Image from 'next/image'

const GUIDE_STEPS = [
  {
    title: "Welcome to Vault Configuration",
    description: "This interface allows you to manage your Euler Earn vault. You can configure roles, manage strategies, and perform vault operations. The vault follows a modular design where different roles have specific permissions, ensuring secure and flexible management of deposited assets."
  },
  {
    title: "Understanding Roles",
    description: `Roles provide granular control over vault management. Each role serves a specific purpose:

• Default Admin: Manages all admin roles
• Strategy Operator: Can add/remove strategies
• Euler Earn Manager: Controls fees and rewards
• Withdrawal Queue Manager: Orders strategies for withdrawals
• Guardian: Sets caps, adjusts points, handles emergencies
• Rebalancer: Executes rebalance operations

To grant or revoke a role, you must hold that role's admin role:
• For regular roles (e.g. GUARDIAN), you need the corresponding admin role (GUARDIAN_ADMIN)
• For admin roles (e.g. GUARDIAN_ADMIN), you need the DEFAULT_ADMIN_ROLE

Use the "Manage Role Owners" section to grant or revoke these roles.`
  },
  {
    title: "Managing Strategies",
    description: "The Strategies section displays all strategies integrated with the vault. Each strategy can be in one of three states: Active (currently managing assets), Emergency (withdrawals only), or Inactive. The allocation points system determines how assets are distributed among active strategies - a strategy's percentage allocation is calculated by dividing its points by the total points of all active strategies. Each strategy also has a cap amount that limits the maximum assets it can manage."
  },
  {
    title: "Vault Operations",
    description: `Key operations to manage your vault:

• Rebalance: Allocates assets across strategies based on allocation points. The order of selected strategies matters as it determines the rebalancing sequence.
• Harvest: Collects yield from all strategies, applies fees, and handles any losses.
• Gulp: Distributes harvested yield to depositors over the smearing period, preventing sudden exchange rate changes.`
  }
]

export function ConfigGuideDialog() {
  const [open, setOpen] = useState(true)
  const [currentStep, setCurrentStep] = useState(0)
  const [dontShowAgain, setDontShowAgain] = useState(false)

  useEffect(() => {
    const shouldShow = localStorage.getItem('hideConfigGuide') !== 'true'
    setOpen(shouldShow)
  }, [])

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem('hideConfigGuide', 'true')
    }
    setOpen(false)
  }

  const handleNext = () => {
    if (currentStep < GUIDE_STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleClose()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const getImageForStep = (step: number) => {
    switch (step) {
      case 1:
        return "/understanding-roles.png";
      case 2:
        return "/managing-strategies-screenshot.png";
      case 3:
        return "/vault-operations.png";
      default:
        return "/config-page-screenshot.png";
    }
  };

  const getImageHeight = (step: number) => {
    switch (step) {
      case 1: // Understanding Roles
      case 2: // Managing Strategies
        return "h-[150px]";
      default:
        return "h-[300px]";
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
        <DialogHeader className="pb-2">
          <DialogTitle>{GUIDE_STEPS[currentStep].title}</DialogTitle>
          <DialogDescription className="pt-2 whitespace-pre-line">
            {GUIDE_STEPS[currentStep].description}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1">
          {/* Image shown based on current step */}
          <div className={cn(
            "relative w-full mb-4 rounded-lg overflow-hidden",
            getImageHeight(currentStep)
          )}>
            <Image
              src={getImageForStep(currentStep)}
              alt="Configuration Guide Screenshot"
              fill
              className="object-contain"
              priority
            />
          </div>

          {/* Step indicators */}
          <div className="flex justify-center space-x-2 mb-4">
            {GUIDE_STEPS.map((_, index) => (
              <div
                key={index}
                className={cn(
                  "h-2 w-2 rounded-full",
                  index === currentStep ? "bg-primary" : "bg-gray-200"
                )}
              />
            ))}
          </div>

          {/* Don't show again checkbox */}
          <div className="flex items-center space-x-2 mb-4">
            <Checkbox
              id="dontShowAgain"
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(checked as boolean)}
            />
            <label
              htmlFor="dontShowAgain"
              className="text-sm text-muted-foreground"
            >
              Don't show this guide again
            </label>
          </div>
        </div>

        {/* Navigation buttons */}
        <div className="pt-4 border-t">
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handleClose}
            >
              Skip
            </Button>
            <div className="space-x-2">
              {currentStep > 0 && (
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                >
                  Previous
                </Button>
              )}
              <Button onClick={handleNext}>
                {currentStep === GUIDE_STEPS.length - 1 ? "Finish" : "Next"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 