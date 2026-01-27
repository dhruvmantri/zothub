import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface NotificationPreferences {
  application_updates: boolean;
  event_reminders: boolean;
  new_messages: boolean;
  deadline_reminders: boolean;
  team_invitations: boolean;
}

interface NotificationPreferencesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preferences: NotificationPreferences;
  onPreferenceChange: (key: keyof NotificationPreferences, value: boolean) => void;
}

export function NotificationPreferencesDialog({
  open,
  onOpenChange,
  preferences,
  onPreferenceChange,
}: NotificationPreferencesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Notification Preferences</DialogTitle>
          <DialogDescription>
            Choose which notifications you want to receive.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Application Updates</Label>
              <p className="text-sm text-muted-foreground">
                Notify when application status changes
              </p>
            </div>
            <Switch
              checked={preferences.application_updates}
              onCheckedChange={(checked) =>
                onPreferenceChange("application_updates", checked)
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Event Reminders</Label>
              <p className="text-sm text-muted-foreground">Remind before upcoming events</p>
            </div>
            <Switch
              checked={preferences.event_reminders}
              onCheckedChange={(checked) =>
                onPreferenceChange("event_reminders", checked)
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>New Messages</Label>
              <p className="text-sm text-muted-foreground">
                Notify when you receive a message
              </p>
            </div>
            <Switch
              checked={preferences.new_messages}
              onCheckedChange={(checked) =>
                onPreferenceChange("new_messages", checked)
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Deadline Reminders</Label>
              <p className="text-sm text-muted-foreground">
                Remind about approaching deadlines
              </p>
            </div>
            <Switch
              checked={preferences.deadline_reminders}
              onCheckedChange={(checked) =>
                onPreferenceChange("deadline_reminders", checked)
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Team Invitations</Label>
              <p className="text-sm text-muted-foreground">
                Notify when invited to join a club team
              </p>
            </div>
            <Switch
              checked={preferences.team_invitations}
              onCheckedChange={(checked) =>
                onPreferenceChange("team_invitations", checked)
              }
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
