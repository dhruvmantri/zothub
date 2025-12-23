-- Create notification_preferences table
CREATE TABLE public.notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  application_updates BOOLEAN NOT NULL DEFAULT true,
  event_reminders BOOLEAN NOT NULL DEFAULT true,
  new_messages BOOLEAN NOT NULL DEFAULT true,
  deadline_reminders BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies for notification_preferences
CREATE POLICY "Users can view their own preferences"
ON public.notification_preferences FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own preferences"
ON public.notification_preferences FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own preferences"
ON public.notification_preferences FOR UPDATE
USING (user_id = auth.uid());

-- Add trigger for updated_at
CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Allow users to delete their own notifications
CREATE POLICY "Users can delete their own notifications"
ON public.notifications FOR DELETE
USING (user_id = auth.uid());

-- Function to create notification for application status changes
CREATE OR REPLACE FUNCTION public.notify_application_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_user_id UUID;
  v_opportunity_title TEXT;
  v_should_notify BOOLEAN;
BEGIN
  -- Only trigger on status change
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Get student's user_id
    SELECT user_id INTO v_student_user_id
    FROM student_profiles
    WHERE id = NEW.student_id;

    -- Get opportunity title
    SELECT title INTO v_opportunity_title
    FROM opportunities
    WHERE id = NEW.opportunity_id;

    -- Check if user wants application notifications
    SELECT COALESCE(application_updates, true) INTO v_should_notify
    FROM notification_preferences
    WHERE user_id = v_student_user_id;

    -- Default to true if no preferences exist
    IF v_should_notify IS NULL THEN
      v_should_notify := true;
    END IF;

    IF v_should_notify THEN
      INSERT INTO notifications (user_id, type, title, message, related_id)
      VALUES (
        v_student_user_id,
        'application_update',
        'Application Status Updated',
        'Your application for "' || v_opportunity_title || '" has been ' || NEW.status || '.',
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger for application status changes
CREATE TRIGGER on_application_status_change
AFTER UPDATE ON applications
FOR EACH ROW
EXECUTE FUNCTION public.notify_application_status_change();

-- Function to create notification for new messages
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_should_notify BOOLEAN;
BEGIN
  -- Check if user wants message notifications
  SELECT COALESCE(new_messages, true) INTO v_should_notify
  FROM notification_preferences
  WHERE user_id = NEW.receiver_id;

  -- Default to true if no preferences exist
  IF v_should_notify IS NULL THEN
    v_should_notify := true;
  END IF;

  IF v_should_notify THEN
    INSERT INTO notifications (user_id, type, title, message, related_id)
    VALUES (
      NEW.receiver_id,
      'new_message',
      'New Message Received',
      CASE 
        WHEN LENGTH(NEW.content) > 50 THEN LEFT(NEW.content, 50) || '...'
        ELSE NEW.content
      END,
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger for new messages
CREATE TRIGGER on_new_message
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_message();

-- Function to create notifications for approaching deadlines
CREATE OR REPLACE FUNCTION public.notify_deadline_approaching()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_user_id UUID;
  v_should_notify BOOLEAN;
BEGIN
  -- Get student's user_id from the application
  SELECT sp.user_id INTO v_student_user_id
  FROM student_profiles sp
  WHERE sp.id = NEW.student_id;

  -- Check if user wants deadline notifications
  SELECT COALESCE(deadline_reminders, true) INTO v_should_notify
  FROM notification_preferences
  WHERE user_id = v_student_user_id;

  IF v_should_notify IS NULL THEN
    v_should_notify := true;
  END IF;

  -- Only create notification when application is created
  IF v_should_notify THEN
    -- We'll handle deadline notifications via the event reminders scheduler
    NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- Allow system to insert notifications
CREATE POLICY "System can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;