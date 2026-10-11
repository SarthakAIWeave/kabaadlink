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
  { name: "Newspaper & Paper", icon: "📰", min: 14, max: 16 },
  { name: "Plastic", icon: "🧴", min: 9, max: 12 },
  { name: "Metal", icon: "🥫", min: 24, max: 28 },
  { name: "Aluminium", icon: "🥫", min: 75, max: 85 },
  { name: "E-Waste", icon: "💻", min: 60, max: 90 },
  { name: "Cardboard", icon: "📦", min: 7, max: 10 },
  { name: "Glass", icon: "🍾", min: 2, max: 6 },
  { name: "Clothes & Fabric", icon: "👕", min: 4, max: 10 },
  { name: "Others", icon: "•••", min: 5, max: 20 },
];

export const vendors = [
  {
    id: 3,
    name: "Ramesh Scrap Store",
    rating: "4.8",
    pickups: "230+",
    distance: "0.6 km",
    avatar: "👨🏽",
    initials: "RS",
  },
  {
    id: 4,
    name: "GreenRecycle Vendors",
    rating: "4.6",
    pickups: "190+",
    distance: "0.5 km",
    avatar: "👨🏾",
    initials: "GV",
  },
  {
    id: 5,
    name: "Sharma Kabadiwala",
    rating: "4.7",
    pickups: "310+",
    distance: "1.2 km",
    avatar: "👨🏻",
    initials: "SK",
  },
];

export const formatRupees = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

// Initial Demo Requests
const INITIAL_DEMO_REQUESTS: ScrapRequest[] = [
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
  {
    id: "REQ-2024-0816",
    household_id: 2,
    household_name: "Rohan Verma",
    household_phone: "+91 98111 22334",
    category: "Cardboard",
    scrap_type: "cardboard",
    weight: 12.5,
    quantity_kg: 12.5,
    rate_per_kg: 8,
    estimated_value: 100,
    status: "OPEN",
    distance_km: 2.4,
    latitude: 28.5200,
    longitude: 77.2150,
    address: "Flat 402, Green Avenue, Saket",
    address_note: "Keep near security gate.",
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: "REQ-2024-0814",
    household_id: 1,
    household_name: "Priya Sharma",
    household_phone: "+91 98765 43210",
    vendor_id: 3,
    vendor_name: "Ramesh Scrap Store",
    vendor_phone: "+91 98999 11223",
    category: "Metal",
    scrap_type: "iron",
    weight: 8,
    quantity_kg: 8,
    rate_per_kg: 30,
    estimated_value: 240,
    status: "CLAIMED",
    distance_km: 0.8,
    latitude: 28.5244,
    longitude: 77.2188,
    address: "Saket, New Delhi – 110017",
    address_note: "Call 10 mins before arrival",
    created_at: new Date(Date.now() - 14400000).toISOString(),
    claimed_at: new Date(Date.now() - 3600000).toISOString(),
  },
];

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
  setTimeout(() => {
    refreshRequests();
    if (user.role === "VENDOR") {
      refreshNearbyRequests();
    }
  }, 10);
  notify(`Switched profile to ${user.name} (${user.role})`);
}

// Global Scrap Requests Signal (Mine)
const [requests, setRequests] = createSignal<ScrapRequest[]>(INITIAL_DEMO_REQUESTS);
export { requests };

// Nearby Feed Signal (For Vendors)
const [nearbyRequests, setNearbyRequests] = createSignal<ScrapRequest[]>(
  INITIAL_DEMO_REQUESTS.filter((r) => r.status === "OPEN")
);
export { nearbyRequests };

export async function refreshRequests() {
  try {
    const list = await apiFetchMyRequests();
    if (list && list.length > 0) {
      setRequests(list);
    }
  } catch {}
}

export async function refreshNearbyRequests(radiusKm: number = 5) {
  try {
    const list = await apiFetchNearby(radiusKm);
    if (list && list.length > 0) {
      setNearbyRequests(list);
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
  setTimeout(refreshRequests, 50);
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
    setNearbyRequests((prev) => prev.filter((r) => String(r.id) !== String(id)));
    setRequests((prev) => [updated, ...prev.filter((r) => String(r.id) !== String(id))]);
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
  if (typeof window !== "undefined") {
    window.setTimeout(() => setToast(""), 3500);
  }
}

export function dismissToast() {
  setToast("");
}

// Pickup Address Signal
const [address, setAddress] = createSignal("B-42, Pandara Road, New Delhi – 110003");
export { address, setAddress };

// Non-blocking background sync after page loads
if (typeof window !== "undefined") {
  setApiUserId(activeUser().id);
  setTimeout(() => {
    refreshRequests();
    if (activeUser().role === "VENDOR") {
      refreshNearbyRequests();
    }
  }, 100);
}
