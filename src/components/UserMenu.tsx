import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

/**
 * Server-rendered auth badge. Either:
 *   - logged in: shows the user's initial + a dropdown link to /trips
 *   - logged out: link to /sign-in
 */
export async function UserMenu({ compact = false }: { compact?: boolean }) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Link
        href="/sign-in"
        className={`rounded-full border border-stone-300 bg-white/85 backdrop-blur transition hover:bg-white dark:border-stone-700 dark:bg-stone-900/85 dark:text-stone-50 ${
          compact ? "px-3 py-1.5 text-xs font-medium" : "px-4 py-2 text-sm font-medium"
        }`}
      >
        Sign in
      </Link>
    );
  }

  const initial = (user.email ?? "?").trim()[0]?.toUpperCase() ?? "?";

  return (
    <div className="group relative">
      <Link
        href="/trips"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-900 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-700 dark:bg-stone-50 dark:text-stone-900 dark:hover:bg-stone-200"
        aria-label={`Account menu for ${user.email}`}
      >
        {initial}
      </Link>
      <div className="pointer-events-none absolute right-0 top-full mt-2 w-56 origin-top-right scale-95 opacity-0 transition group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100 focus-within:pointer-events-auto focus-within:scale-100 focus-within:opacity-100">
        <div className="overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
          <div className="border-b border-stone-100 px-4 py-3 dark:border-stone-800">
            <p className="text-xs font-medium uppercase tracking-wider text-stone-500">Signed in</p>
            <p className="mt-1 truncate text-sm text-stone-900 dark:text-stone-50">{user.email}</p>
          </div>
          <Link
            href="/trips"
            className="block px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            Your trips
          </Link>
          <form action="/auth/sign-out" method="POST">
            <button
              type="submit"
              className="block w-full px-4 py-2 text-left text-sm text-stone-500 transition hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
