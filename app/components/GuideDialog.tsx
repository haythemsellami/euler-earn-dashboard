import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import Image from 'next/image'
import { Settings } from 'lucide-react'

const GUIDE_STEPS = [
  {
    title: "Welcome to Euler Earn",
    description: "This guide will help you understand how to deploy and manage your Euler Earn vault."
  },
  {
    title: "Step 1: Configure Your Vault name and symbol",
    description: "Start by selecting the network, asset for your vault, the name and symbol."
  },
  {
    title: "Step 2: Set Initial Parameters",
    description: "Set the initial allocation points for the cash reserve strategy, this allocation amount should be greater than zero.\nSet the smearing period in seconds, the period during which the harvested positive yield is smeared to depositors as interest."
  },
  {
    title: "Step 3: Deploy",
    description: "Review your settings and deploy your vault. Once deployed, it should shows up in the list of deployed vaults, you can manage it by clicking on the configure icon"
  }
]

export function GuideDialog() {
  const [open, setOpen] = useState(true)
  const [currentStep, setCurrentStep] = useState(0)
  const [dontShowAgain, setDontShowAgain] = useState(false)

  useEffect(() => {
    const shouldShow = localStorage.getItem('hideDeployGuide') !== 'true'
    setOpen(shouldShow)
  }, [])

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem('hideDeployGuide', 'true')
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>{GUIDE_STEPS[currentStep].title}</DialogTitle>
          <DialogDescription className="pt-4">
            {GUIDE_STEPS[currentStep].description}
            {currentStep === 3 && (
              <Settings className="inline-block ml-2 h-4 w-4" />
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          {/* Image shown on all steps */}
          <div className="relative w-full h-[300px] mb-6 rounded-lg overflow-hidden">
            <Image
              src="/deploy-page-screenshot.png"
              alt="Deploy Page Screenshot"
              fill
              className="object-contain"
              priority
            />
          </div>

          {/* Step indicators */}
          <div className="flex justify-center space-x-2 mb-6">
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
          <div className="flex items-center space-x-2 mb-6">
            <Checkbox
              id="dontShowAgain"
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(checked as boolean)}
            />
            <label
              htmlFor="dontShowAgain"
              className="text-sm text-muted-foreground"
            >
              Don&apos;t show this guide again
            </label>
          </div>

          {/* Navigation buttons */}
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