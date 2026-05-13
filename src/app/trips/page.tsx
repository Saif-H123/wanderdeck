import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getUserTrips } from "@/lib/db/trips";

export const dynamic = "force-dynamic";

export default async function TripsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }
  const trips = await getUserTrips(user.id);

  return (
    <main className="min-h-screen bg-stone-100 px-6 py-16 dark:bg-stone-950">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
              Signed in as {user.email}
            </p>
            <h1 className="font-display mt-1 text-4xl font-semibold text-stone-900 dark:text-stone-50">
              Your trips
            </h1>
          </div>
          <Link
            href="/plan"
            className="rounded-full bg-stone-900 px-5 py-2 text-sm font-medium text-white dark:bg-stone-50 dark:text-stone-900"
          >
            New trip
          </Link>
        </div>

        {trips.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-stone-300 bg-white p-10 text-center dark:border-stone-700 dark:bg-stone-900">
            <p className="font-display text-xl text-stone-800 dark:text-stone-200">
              No trips yet.
            </p>
            <p className="mt-2 text-sm text-stone-500">Drop some pins and we&rsquo;ll build you a deck.</p>
            <Link
              href="/plan"
              className="mt-6 inline-block rounded-full bg-stone-900 px-5 py-2 text-sm font-medium text-white dark:bg-stone-50 dark:text-stone-900"
            >
              Plan your first trip
            </Link>
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {trips.map((t) => (
              <li key={t.slug}>
                <Link
                  href={`/trip/${t.slug}`}
                  className="block rounded-2xl border border-stone-200 bg-white p-5 transition hover:border-stone-400 hover:shadow-sm dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-600"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
                      {new Date(t.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                    <p className="text-xs text-stone-500">
                      {t.stopCount} stop{t.stopCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-stone-700 dark:text-stone-300">
                    {t.vibe.split("\n").find((l) => l.startsWith("User:"))?.slice(6).trim() ||
                      t.vibe.slice(0, 200)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
