import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar, Download, ExternalLink } from "lucide-react";
import { downloadICS, getCalendarLinks, type CalendarEvent } from "@/lib/calendarExport";

interface AddToCalendarButtonProps {
  event: CalendarEvent;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function AddToCalendarButton({
  event,
  variant = "outline",
  size = "default",
  className,
}: AddToCalendarButtonProps) {
  const calendarLinks = getCalendarLinks(event);

  const handleDownloadICS = () => {
    downloadICS(event);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <Calendar className="w-4 h-4" />
          {size !== "icon" && <span className="ml-2">Add to Calendar</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={handleDownloadICS} className="gap-2">
          <Download className="w-4 h-4" />
          Download .ics file
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href={calendarLinks.google}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Google Calendar
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href={calendarLinks.outlook}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Outlook Calendar
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href={calendarLinks.yahoo}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Yahoo Calendar
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
