import { Landing } from "@/components/Landing";

export default function Home() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? null;
  return <Landing apiKey={apiKey} />;
}
