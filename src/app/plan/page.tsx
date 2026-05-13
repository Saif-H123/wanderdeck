import { Planner } from "@/components/Planner";

export default function PlanPage() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? null;
  return <Planner apiKey={apiKey} />;
}
