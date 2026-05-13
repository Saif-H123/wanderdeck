export type LatLng = { lat: number; lng: number };

export type TripStop = {
  id: string;
  name: string;
  description: string;
  location: LatLng;
  arrivalEstimate?: string;
  cards: ActivityCard[];
};

export type ActivityCard = {
  id: string;
  stopId: string;
  title: string;
  hiddenHint: string;
  revealedDescription: string;
  scoringCriteria: string;
  basePoints: number;
  revealed: boolean;
  completed: boolean;
};

export type Trip = {
  id: string;
  userId: string;
  prompt: string;
  origin: LatLng;
  destination: LatLng;
  stops: TripStop[];
  createdAt: string;
};

export type PhotoScore = {
  cardId: string;
  matches: boolean;
  confidence: number;
  awardedPoints: number;
  reasoning: string;
};
