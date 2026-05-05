-- Auto-post system messages on temperature breaches and rejected deliveries

-- 1) Temperature breach trigger
CREATE OR REPLACE FUNCTION public.trg_messenger_temp_breach()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _channel_id uuid;
  _unit_name text;
  _min numeric;
  _max numeric;
  _content text;
  _payload jsonb;
  _label text;
BEGIN
  -- Only on a failing log
  IF NEW.pass IS DISTINCT FROM false THEN RETURN NEW; END IF;

  SELECT id INTO _channel_id FROM public.messenger_channels
  WHERE site_id = NEW.site_id AND name = 'whole-site' AND is_system LIMIT 1;
  IF _channel_id IS NULL THEN RETURN NEW; END IF;

  IF NEW.unit_id IS NOT NULL THEN
    SELECT name, min_temp, max_temp INTO _unit_name, _min, _max
    FROM public.temp_units WHERE id = NEW.unit_id;
    _label := COALESCE(_unit_name, 'Unit');
  ELSE
    _label := COALESCE(NEW.food_item, 'Process check');
    _min := NULL; _max := NULL;
  END IF;

  _content := format('🌡️ Temperature breach: %s recorded %s°C', _label, NEW.value);
  IF _min IS NOT NULL AND _max IS NOT NULL THEN
    _content := _content || format(' (acceptable %s°C to %s°C)', _min, _max);
  END IF;
  IF NEW.corrective_action IS NOT NULL AND length(trim(NEW.corrective_action)) > 0 THEN
    _content := _content || E'\nCorrective action: ' || NEW.corrective_action;
  ELSE
    _content := _content || E'\nNo corrective action recorded.';
  END IF;

  _payload := jsonb_build_object(
    'kind', 'temp_breach',
    'log_id', NEW.id,
    'unit_id', NEW.unit_id,
    'unit_name', _unit_name,
    'food_item', NEW.food_item,
    'value', NEW.value,
    'min_temp', _min,
    'max_temp', _max,
    'log_type', NEW.log_type,
    'corrective_action', NEW.corrective_action,
    'logged_by_name', NEW.logged_by_name
  );

  INSERT INTO public.messenger_messages
    (channel_id, site_id, sender_id, sender_name_snapshot, content, message_type, system_payload)
  VALUES
    (_channel_id, NEW.site_id, NULL, 'System', _content, 'system', _payload);

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS messenger_temp_breach_trigger ON public.temp_logs;
CREATE TRIGGER messenger_temp_breach_trigger
AFTER INSERT ON public.temp_logs
FOR EACH ROW EXECUTE FUNCTION public.trg_messenger_temp_breach();

-- 2) Delivery rejection trigger
CREATE OR REPLACE FUNCTION public.trg_messenger_delivery_rejected()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _channel_id uuid;
  _supplier_name text;
  _content text;
  _payload jsonb;
  _reasons text[] := ARRAY[]::text[];
  _reason text;
BEGIN
  IF NEW.accepted IS DISTINCT FROM false THEN RETURN NEW; END IF;

  SELECT id INTO _channel_id FROM public.messenger_channels
  WHERE site_id = NEW.site_id AND name = 'whole-site' AND is_system LIMIT 1;
  IF _channel_id IS NULL THEN RETURN NEW; END IF;

  SELECT name INTO _supplier_name FROM public.suppliers WHERE id = NEW.supplier_id;

  IF NEW.temp_pass IS false THEN
    _reasons := array_append(_reasons, format('temperature out of range (%s°C)', NEW.temp));
  END IF;
  IF NEW.packaging = 'damaged' THEN
    _reasons := array_append(_reasons, 'damaged packaging');
  END IF;
  IF NEW.use_by_ok IS false THEN
    _reasons := array_append(_reasons, 'use-by date issue');
  END IF;
  IF NEW.note IS NOT NULL AND length(trim(NEW.note)) > 0 THEN
    _reasons := array_append(_reasons, NEW.note);
  END IF;

  _reason := CASE WHEN array_length(_reasons,1) IS NULL THEN 'rejected'
                  ELSE array_to_string(_reasons, '; ') END;

  _content := format('🚫 Delivery rejected — %s', COALESCE(_supplier_name, 'Unknown supplier'));
  IF NEW.items IS NOT NULL AND length(trim(NEW.items)) > 0 THEN
    _content := _content || E'\nItems: ' || NEW.items;
  END IF;
  _content := _content || E'\nReason: ' || _reason;

  _payload := jsonb_build_object(
    'kind', 'delivery_rejected',
    'delivery_id', NEW.id,
    'supplier_id', NEW.supplier_id,
    'supplier_name', _supplier_name,
    'items', NEW.items,
    'reason', _reason,
    'temp', NEW.temp,
    'packaging', NEW.packaging,
    'use_by_ok', NEW.use_by_ok,
    'logged_by_name', NEW.logged_by_name
  );

  INSERT INTO public.messenger_messages
    (channel_id, site_id, sender_id, sender_name_snapshot, content, message_type, system_payload)
  VALUES
    (_channel_id, NEW.site_id, NULL, 'System', _content, 'system', _payload);

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS messenger_delivery_rejected_trigger ON public.delivery_logs;
CREATE TRIGGER messenger_delivery_rejected_trigger
AFTER INSERT ON public.delivery_logs
FOR EACH ROW EXECUTE FUNCTION public.trg_messenger_delivery_rejected();