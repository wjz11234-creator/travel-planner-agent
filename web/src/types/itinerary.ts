export type AgentId = "supervisor" | "guide" | "planner" | "preference" | "research" | "budget" | "critic" | "writer";

export type TravelProfile = {
  destination?: string | null;
  days?: number | null;
  budget?: number | null;
  companions?: string | null;
  pace?: string | null;
  interests?: string[];
  constraints?: string | null;
};

export type ItineraryItem = {
  time: string;
  place: string;
  category: string;
  duration_min: number;
  tips: string;
  est_cost: number;
  transport_between?: string;
  meal_suggestion?: string;
};

export type ItineraryDay = {
  day_index: number;
  date: string;
  theme: string;
  area: string;
  items: ItineraryItem[];
};

export type Itinerary = {
  title: string;
  days: ItineraryDay[];
  warnings: string[];
};

export type ChatMessage = {
  role: "user" | "agent";
  content: string;
  agent?: string | null;
};

export type SessionSummary = {
  session_id: string;
  updated_at: string;
  msg_count: number;
  preview: string | null;
};
