import { createSignal } from "solid-js";
import {
  DemoUser,
  DEMO_USERS,
  ScrapRequest,
  setApiUserId,
  apiCreateRequest,
  apiFetchMyRequests,
  apiFetchNearby,
  apiClaimRequest,
  apiMarkPickedUp,
  apiCompleteRequest,
  apiCancelRequest,
} from "./api";

export type Category = { name: string; icon: string; min: number; max: number };

export const categories: Category[] = [
  { name: "Newspaper & Paper", icon: "📰", min: 12, max: 18 },
  { name: "Plastic", icon: "🧴", min: 8, max: 15 },
  { name: "Metal", icon: "🥫", min: 25, max: 45 },
  { name: "E-Waste", icon: "💻", min: 15, max: 70 },
  { name: "Glass", icon: "🍾", min: 2, max: 6 },
  { name: "Cardboard", icon: "📦", min: 6, max: 12 },
  { name: "Clothes & Fabric", icon: "👕", min: 4, max: 10 },
  { name: "Others", icon: "•••", min: 3, max: 15 },
];

export const vendors = [
  {
    id: 3,
    name: "Ramesh Scrap Store",
    rating: "4.8",
    pickups: "230+",
    distance: "1.2 km",
    avatar: "👨🏽",
    initials: "RS",
  },
  {
    id: 4,
    name: "GreenRecycle Vendors",
    rating: "4.6",
    pickups: "190+",
    distance: "2.4 km",
    avatar: "👨🏾",
    initials: "GV",
  },
  {
    id: 5,
    name: "Sharma Kabadiwala",
    rating: "4.7",
    pickups: "310+",
    distance: "3.1 km",
    avatar: "👨🏻",
    initials: "SK",
  },
];

export const formatRupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

// Demo User Active State
const initialUserId = typeof window !== "undefined"
  ? parseInt(localStorage.getItem("kabaad_demo_user_id") || "1", 10)
  : 1;

const [activeUser, setActiveUserState] = createSignal<DemoUser>(
  DEMO_USERS.find((u) => u.id === initialUserId) || DEMO_USERS[0]
);

export { activeUser, DEMO_USERS };

export function switchUser(user: DemoUser) {
  setActiveUserState(user);
  setApiUserId(user.id);
  if (typeof window !== "undefined") {
    localStorage.setItem("kabaad_demo_user_id", String(user.id));
  }
  refreshRequests();
  notify(`Switched profile to ${user.name} (${user.role})`);
}

// Global Scrap Requests Signal
const [requests, setRequests] = createSignal<ScrapRequest[]>([
  {
    id: "REQ-2024-0815",
    household_id: 1,
    household_name: "Priya Sharma",
    household_phone: "+91 98765 43210",
    category: "Newspaper & Paper",
    scrap_type: "newspaper",
    weight: 10,
    quantity_kg: 10,
    rate_per_kg: 15,
    estimated_value: 150,
    status: "OPEN",
    distance_km: 1.2,
    latitude: 28.5244,
    longitude: 77.2188,
    address: "Saket, New Delhi – 110017",
    address_note: "Gate no. 3, Near City Center Saket. Today 4:00 PM – 7:00 PM",
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
]);

export { requests };

export async function refreshRequests() {
  try {
    const list = await apiFetchMyRequests();
    if (list && list.length > 0) {
      setRequests(list);
    }
  } catch {}
}

export async function addRequest(category: string, weight: number, notes?: string) {
  const req = await apiCreateRequest({
    category,
    weight,
    address: address(),
    notes,
  });
  setRequests((prev) => [req, ...prev]);
  return req.id;
}

export async function cancelUserRequest(id: string | number) {
  await apiCancelRequest(id);
  setRequests((prev) =>
    prev.map((r) => (String(r.id) === String(id) ? { ...r, status: "CANCELLED" as const } : r))
  );
  notify("Request cancelled successfully.");
}

export async function claimPickup(id: string | number) {
  try {
    const updated = await apiClaimRequest(id);
    setRequests((prev) =>
      prev.map((r) => (String(r.id) === String(id) ? updated : r))
    );
    notify(`Claimed pickup ${id} successfully!`);
    return updated;
  } catch (err: any) {
    notify(err.message || "Failed to claim request");
    throw err;
  }
}

export async function updatePickupStatus(id: string | number, newStatus: "PICKED UP" | "COMPLETED", finalWeight?: number) {
  if (newStatus === "PICKED UP") {
    const updated = await apiMarkPickedUp(id);
    setRequests((prev) =>
      prev.map((r) => (String(r.id) === String(id) ? updated : r))
    );
    notify(`Marked request ${id} as Picked Up!`);
  } else if (newStatus === "COMPLETED") {
    const updated = await apiCompleteRequest(id, finalWeight || 10);
    setRequests((prev) =>
      prev.map((r) => (String(r.id) === String(id) ? updated : r))
    );
    notify(`Pickup ${id} completed & settled!`);
  }
}

// Toast notification
const [toast, setToast] = createSignal("");
export { toast };

export function notify(message: string) {
  setToast(message);
  window.setTimeout(() => setToast(""), 3500);
}

export function dismissToast() {
  setToast("");
}

// Pickup Address Signal
const [address, setAddress] = createSignal("Saket, New Delhi – 110017");
export { address, setAddress };
