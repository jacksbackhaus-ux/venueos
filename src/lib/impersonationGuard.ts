/**
 * Global write-block for impersonation sessions.
 *
 * When a Super Admin is impersonating, every Supabase write (insert/update/
 * delete/upsert), RPC call, edge function invocation, and storage mutation
 * must be blocked. Reads are allowed.
 *
 * This works by wrapping the live `supabase` client with Proxies the first
 * time the guard is installed. The active flag lives in module scope and is
 * toggled by ImpersonationContext.
 *
 * IMPORTANT: This is a defence-in-depth UX guard. The actual auth session
 * never changes during impersonation — RLS policies still see the real
 * super-admin auth.uid(), so writes would technically succeed at the DB
 * level if not blocked here. We rely on this guard to keep impersonation
 * strictly read-only.
 */
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

let active = false;
let installed = false;

const BLOCKED_QUERY_METHODS = new Set([
  "insert",
  "update",
  "delete",
  "upsert",
]);

const BLOCK_MESSAGE =
  "Impersonation is read-only. Writes are blocked while you're viewing this account.";

class ImpersonationWriteBlockedError extends Error {
  constructor() {
    super(BLOCK_MESSAGE);
    this.name = "ImpersonationWriteBlockedError";
  }
}

function notifyBlocked() {
  try {
    toast.error(BLOCK_MESSAGE);
  } catch {
    /* toast not mounted yet — ignore */
  }
}

export function setImpersonationActive(next: boolean) {
  active = next;
  if (next) installGuard();
}

export function isImpersonationActive() {
  return active;
}

function installGuard() {
  if (installed) return;
  installed = true;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // --- Wrap .from(table) so write builders throw ---
  const originalFrom = sb.from.bind(sb);
  sb.from = (table: string) => {
    const builder = originalFrom(table);
    return new Proxy(builder, {
      get(target, prop, receiver) {
        if (active && typeof prop === "string" && BLOCKED_QUERY_METHODS.has(prop)) {
          return (..._args: unknown[]) => {
            notifyBlocked();
            // Return a thenable that rejects, mirroring PostgrestBuilder shape.
            const rejection = Promise.reject(new ImpersonationWriteBlockedError());
            return Object.assign(rejection, {
              select: () => rejection,
              single: () => rejection,
              maybeSingle: () => rejection,
              throwOnError: () => rejection,
            });
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  };

  // --- Block RPC calls (most are mutations or sensitive) ---
  const originalRpc = sb.rpc.bind(sb);
  sb.rpc = (...args: unknown[]) => {
    if (active) {
      notifyBlocked();
      return Promise.reject(new ImpersonationWriteBlockedError());
    }
    return originalRpc(...args);
  };

  // --- Block edge function invocations ---
  if (sb.functions && typeof sb.functions.invoke === "function") {
    const originalInvoke = sb.functions.invoke.bind(sb.functions);
    sb.functions.invoke = (...args: unknown[]) => {
      if (active) {
        notifyBlocked();
        return Promise.reject(new ImpersonationWriteBlockedError());
      }
      return originalInvoke(...args);
    };
  }

  // --- Block storage mutations ---
  if (sb.storage && typeof sb.storage.from === "function") {
    const originalStorageFrom = sb.storage.from.bind(sb.storage);
    sb.storage.from = (bucket: string) => {
      const sBuilder = originalStorageFrom(bucket);
      return new Proxy(sBuilder, {
        get(target, prop, receiver) {
          if (
            active &&
            typeof prop === "string" &&
            ["upload", "update", "remove", "move", "copy", "uploadToSignedUrl", "createSignedUploadUrl"].includes(prop)
          ) {
            return (..._args: unknown[]) => {
              notifyBlocked();
              return Promise.reject(new ImpersonationWriteBlockedError());
            };
          }
          return Reflect.get(target, prop, receiver);
        },
      });
    };
  }

  // --- Block auth mutations that would log out the super admin ---
  const originalSignOut = sb.auth.signOut.bind(sb.auth);
  sb.auth.signOut = (...args: unknown[]) => {
    if (active) {
      notifyBlocked();
      return Promise.reject(new ImpersonationWriteBlockedError());
    }
    return originalSignOut(...args);
  };
}
