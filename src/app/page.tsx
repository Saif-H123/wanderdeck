import { Landing } from "@/components/Landing";
import { UserMenu } from "@/components/UserMenu";

export default function Home() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? null;
  return <Landing apiKey={apiKey} userMenu={<UserMenu />} />;
}
