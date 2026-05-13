import { TripView } from "@/components/TripView";

export default async function TripPage(props: PageProps<"/trip/[id]">) {
  const { id } = await props.params;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? null;
  return <TripView slug={id} apiKey={apiKey} />;
}
