export type LatLng = { lat: number; lng: number };

export type TripStatus = "planning" | "active" | "completed" | "abandoned";

export type Trip = {
  id: string;
  userId: string;
  prompt: string;
  status: TripStatus;
  origin: LatLng & { label: string };
  destination: LatLng & { label: string };
  createdAt: string;
  updatedAt: string;
};

export type TripStop = {
  id: string;
  tripId: string;
  sequence: number;
  name: string;
  description: string;
  location: LatLng;
  arrivalEstimate: string | null;
};

export type ActivityCard = {
  id: string;
  stopId: string;
  title: string;
  hiddenHint: string;
  revealedDescription: string;
  scoringCriteria: string;
  basePoints: number;
  revealedAt: string | null;
  completedAt: string | null;
};

export type CardSubmission = {
  id: string;
  cardId: string;
  userId: string;
  photoPath: string;
  matches: boolean;
  confidence: number;
  awardedPoints: number;
  aiReasoning: string;
  submittedAt: string;
};

// Convenience nested shape for `/trip/[id]` page.
export type TripWithDetails = Trip & {
  stops: (TripStop & {
    cards: ActivityCard[];
  })[];
};

// AI -> DB shape for what Claude returns from /api/plan
export type GeneratedPlan = {
  stops: {
    name: string;
    description: string;
    location: LatLng;
    arrivalEstimate?: string;
    cards: {
      title: string;
      hiddenHint: string;
      revealedDescription: string;
      scoringCriteria: string;
      basePoints: number;
    }[];
  }[];
};
