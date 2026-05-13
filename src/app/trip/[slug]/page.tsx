import { notFound } from "next/navigation";
import { Planner } from "@/components/Planner";
import { UserMenu } from "@/components/UserMenu";
import { getTripBySlug } from "@/lib/db/trips";

export default async function TripPage(props: PageProps<"/trip/[slug]">) {
  const { slug } = await props.params;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? null;

  const data = await getTripBySlug(slug);
  if (!data) return notFound();

  return (
    <Planner
      apiKey={apiKey}
      initialTrip={data.trip}
      initialSubmissions={data.submissions}
      userMenu={<UserMenu />}
    />
  );
}
