/**
 * Push notification client utility.
 * Works in browsers (web push) and wraps Capacitor push registration when
 * the native plugin is present.
 */
import { supabase } from "@/integrations/supabase/client";

export type PushPlatform = "ios" | "android" | "web";
export type PushProvider = "apns" | "fcm" | "webpush";

export interface RegisterParams {
  platform: PushPlatform;
  provider: PushProvider;
  token: string;
  site_id?: string | null;
  organisation_id?: string | null;
}

export async function registerPushToken(params: RegisterParams) {
  const { data: auth } = await supabase.auth.getUser();
  const user_id = auth.user?.id;
  if (!user_id) return { ok: false, error: "not_authenticated" as const };

  const { error } = await supabase
    .from("push_devices")
    .upsert(
      {
        user_id,
        platform: params.platform,
        provider: params.provider,
        push_token: params.token,
        site_id: params.site_id ?? null,
        organisation_id: params.organisation_id ?? null,
        enabled: true,
      },
      { onConflict: "user_id,platform,push_token" }
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true as const };
}

export async function disablePushToken(token: string) {
  const { data: auth } = await supabase.auth.getUser();
  const user_id = auth.user?.id;
  if (!user_id) return;
  await supabase
    .from("push_devices")
    .update({ enabled: false })
    .eq("user_id", user_id)
    .eq("push_token", token);
}

/**
 * Browser web-push helper. Requires VAPID public key (passed in) and a
 * registered service worker. Returns an applicationServerKey-compatible
 * subscription endpoint as the token.
 */
export async function enableWebPush(vapidPublicKey: string): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, error: "unsupported" };
  }
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return { ok: false, error: "permission_denied" };
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
    });
    const token = JSON.stringify(sub.toJSON());
    const res = await registerPushToken({ platform: "web", provider: "webpush", token });
    if (!res.ok) return { ok: false, error: res.error || "register_failed" };
    return { ok: true, token };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Best-effort detection: are we running inside a Capacitor native shell? */
export function isNativeApp(): boolean {
  return typeof (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform === "function" &&
    !!(window as unknown as { Capacitor: { isNativePlatform: () => boolean } }).Capacitor.isNativePlatform();
}
