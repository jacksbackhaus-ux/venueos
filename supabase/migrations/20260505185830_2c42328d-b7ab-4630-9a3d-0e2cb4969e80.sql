ALTER TABLE public.messenger_messages
ADD COLUMN IF NOT EXISTS requires_ack BOOLEAN NOT NULL DEFAULT false;