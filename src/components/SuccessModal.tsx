import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, Calendar, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SuccessModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  showCalendarButton?: boolean;
  onAddToCalendar?: () => void;
}

export function SuccessModal({
  open,
  onClose,
  title,
  description,
  primaryAction,
  secondaryAction,
  showCalendarButton,
  onAddToCalendar,
}: SuccessModalProps) {
  // Count how many buttons will render
  const hasCalendar = showCalendarButton && onAddToCalendar;
  const hasSecondary = !!secondaryAction;
  const hasPrimary = !!primaryAction;
  
  const buttonCount = (hasCalendar ? 1 : 0) + (hasSecondary ? 1 : 0) + (hasPrimary ? 1 : 1); // always at least Done button

  // Determine grid columns based on button count
  const gridClass = cn(
    "grid gap-3 mt-6",
    buttonCount === 1 && "grid-cols-1",
    buttonCount === 2 && "grid-cols-1 sm:grid-cols-2",
    buttonCount >= 3 && "grid-cols-1 sm:grid-cols-3"
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-success/15 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-success" />
          </div>
          <DialogTitle className="text-xl text-center">{title}</DialogTitle>
          <DialogDescription className="text-center">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className={gridClass}>
          {hasCalendar && (
            <Button
              variant="outline"
              onClick={onAddToCalendar}
              className="w-full gap-2 whitespace-normal text-center leading-snug min-h-[2.5rem] h-auto py-2"
            >
              <Calendar className="w-4 h-4 shrink-0" />
              Add to Calendar
            </Button>
          )}
          
          {hasSecondary && (
            <Button
              variant="outline"
              onClick={secondaryAction.onClick}
              className="w-full whitespace-normal text-center leading-snug min-h-[2.5rem] h-auto py-2"
            >
              {secondaryAction.label}
            </Button>
          )}
          
          {hasPrimary ? (
            <Button
              onClick={primaryAction.onClick}
              className="w-full gap-2 whitespace-normal text-center leading-snug min-h-[2.5rem] h-auto py-2"
            >
              {primaryAction.label}
              <ArrowRight className="w-4 h-4 shrink-0" />
            </Button>
          ) : (
            <Button 
              onClick={onClose} 
              className="w-full whitespace-normal text-center leading-snug min-h-[2.5rem] h-auto py-2"
            >
              Done
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
