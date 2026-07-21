import { login } from "@/app/actions/adminAuth";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>;
}) {
  const { from, error } = await searchParams;

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-ink px-6">
      <form action={login} className="w-full max-w-sm border border-line p-8">
        <h1 className="font-display text-xl text-ivory">Admin Sign In</h1>
        <p className="mt-2 text-xs text-ivory-dim">Atoreum MV internal tools</p>

        {error && (
          <p className="mt-4 text-sm text-red-400">Incorrect password. Please try again.</p>
        )}

        <input type="hidden" name="from" value={from ?? "/admin/products"} />

        <label className="mt-8 flex flex-col gap-2">
          <span className="text-xs uppercase tracking-[0.15em] text-ivory-dim">Password</span>
          <input
            type="password"
            name="password"
            required
            autoFocus
            className="border border-line bg-transparent px-4 py-3 text-sm text-ivory focus:border-gold focus:outline-none"
          />
        </label>

        <button
          type="submit"
          className="mt-6 w-full bg-gold px-6 py-3 text-xs uppercase tracking-[0.2em] text-ink transition-colors hover:bg-gold/90"
        >
          Sign In
        </button>
      </form>
    </div>
  );
}
