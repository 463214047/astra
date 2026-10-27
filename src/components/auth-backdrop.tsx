export function AuthBackdrop() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_18%,var(--brand-200),transparent_34%),radial-gradient(circle_at_82%_78%,var(--brand-100),transparent_36%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed left-[calc(50%-280px)] top-[calc(50%-280px)] size-[560px] rounded-full bg-[radial-gradient(circle,var(--brand-200),transparent_65%)] blur-2xl animate-[float_12s_ease-in-out_infinite_alternate]"
      />
    </>
  );
}
