export default async function TripPage(props: PageProps<"/trip/[id]">) {
  const { id } = await props.params;
  return (
    <main className="min-h-screen bg-stone-50 px-6 py-16 dark:bg-stone-950">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm text-stone-500">Trip</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
          {id}
        </h1>
        <p className="mt-4 text-stone-600 dark:text-stone-400">
          Map and card deck go here. Cards unlock as you reach each stop.
        </p>
      </div>
    </main>
  );
}
