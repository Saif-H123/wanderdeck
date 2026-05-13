import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-200 dark:from-stone-950 dark:to-stone-900">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-5xl font-semibold tracking-tight text-stone-900 dark:text-stone-50 sm:text-7xl">
          wanderdeck
        </h1>
        <p className="mt-6 max-w-xl text-lg text-stone-600 dark:text-stone-400">
          Describe the trip you want. We&rsquo;ll plan the route, the stops, and
          a deck of hidden activity cards. Pick one up at each stop, snap a
          photo, score points.
        </p>
        <Link
          href="/plan"
          className="mt-10 rounded-full bg-stone-900 px-8 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-stone-700 dark:bg-stone-50 dark:text-stone-900 dark:hover:bg-stone-200"
        >
          Plan a trip
        </Link>
      </div>
    </main>
  );
}
