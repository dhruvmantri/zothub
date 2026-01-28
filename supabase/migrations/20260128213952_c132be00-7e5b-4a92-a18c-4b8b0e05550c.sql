-- Add 'admin' to the user_role enum (must be in separate transaction)
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'admin';