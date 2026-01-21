import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, Calendar, ArrowRight } from "lucide-react";

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
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <DialogTitle className="text-xl text-center">{title}</DialogTitle>
          <DialogDescription className="text-center">
            {description}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4">
          {showCalendarButton && onAddToCalendar && (
            <Button
              variant="outline"
              onClick={onAddToCalendar}
              className="w-full sm:w-auto gap-2"
            >
              <Calendar className="w-4 h-4" />
              Add to Calendar
            </Button>
          )}
          
          {secondaryAction && (
            <Button
              variant="outline"
              onClick={secondaryAction.onClick}
              className="w-full sm:w-auto"
            >
              {secondaryAction.label}
            </Button>
          )}
          
          {primaryAction ? (
            <Button
              onClick={primaryAction.onClick}
              className="w-full sm:w-auto gap-2"
            >
              {primaryAction.label}
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button onClick={onClose} className="w-full sm:w-auto">
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
