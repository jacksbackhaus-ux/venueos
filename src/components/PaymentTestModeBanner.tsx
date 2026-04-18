const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;

export function PaymentTestModeBanner() {
  if (!clientToken?.startsWith("pk_test_")) return null;
  return (
    <div className="w-full bg-warning/15 border-b border-warning/40 px-4 py-2 text-center text-xs text-warning-foreground">
      Test payments mode — use card <span className="font-mono">4242 4242 4242 4242</span>.{" "}
      <a href="https://docs.lovable.dev/features/payments" target="_blank" rel="noreferrer" className="underline">
        Read more
      </a>
    </div>
  );
}
