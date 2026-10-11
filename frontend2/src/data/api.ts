// API client connecting to FastAPI backend with seamless mock fallback

export type UserRole = "HOUSEHOLD" | "VENDOR";

export type DemoUser = {
  id: number;
  name: string;
  role: UserRole;
  phone?: string;
  avatar: string;
  initials: string;
};

export const DEMO_USERS: DemoUser[] = [
  { id: 1, name: "Priya Sharma", role: "HOUSEHOLD", phone: "+91 98765 43210", avatar: "👩🏽", initials: "PS" },
  { id: 2, name: "Rohan Verma", role: "HOUSEHOLD", phone: "+91 98111 22334", avatar: "👨🏻", initials: "RV" },
  { id: 3, name: "Ramesh Scrap Store", role: "VENDOR", phone: "+91 98999 11223", avatar: "👨🏽", initials: "RS" },
  { id: 4, name: "GreenRecycle Vendors", role: "VENDOR", phone: "+91 98222 33445", avatar: "👨🏾", initials: "GV" },
  { id: 5, name: "Sharma Kabadiwala", role: "VENDOR", phone: "+91 98333 44556", avatar: "👨🏻", initials: "SK" },
];

export type ScrapRate = {
  scrap_type: string;
  display_name: string;
  rate_per_kg: number;
  currency: string;
  is_indicative: boolean;
};

export type ScrapRequest = {
  id: string | number;
  household_id?: number;
  household_name?: string;
  household_phone?: string;
  vendor_id?: number;
  vendor_name?: string;
  vendor_phone?: string;
  category: string;
  scrap_type: string;
  weight: number;
  quantity_kg: number;
  rate_per_kg: number;
  estimated_value: number;
  status: "OPEN" | "CLAIMED" | "PICKED UP" | "COMPLETED" | "CANCELLED";
  distance_km?: number;
  latitude: number;
  longitude: number;
  address: string;
  address_note?: string;
  created_at: string;
  claimed_at?: string;
  picked_up_at?: string;
  completed_at?: string;
  final_weight_kg?: number;
  final_amount?: number;
};

const API_BASE_URL = typeof window !== "undefined" && (window as any).__API_URL__
  ? (window as any).__API_URL__
  : "http://localhost:8000";

let currentUserId = 1;

export function setApiUserId(id: number) {
  currentUserId = id;
}

export function getApiUserId(): number {
  return currentUserId;
}

// In-memory mock requests store
let mockRequests: ScrapRequest[] = [
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

// Helper to normalize backend status (e.g. PICKED_UP -> PICKED UP)
function normalizeStatus(st: string): ScrapRequest["status"] {
  if (st === "PICKED_UP") return "PICKED UP";
  if (st === "CLAIMED") return "CLAIMED";
  if (st === "COMPLETED") return "COMPLETED";
  if (st === "CANCELLED") return "CANCELLED";
  return "OPEN";
}

// Map scrap_type to readable category name
export function typeToCategory(scrapType: string): string {
  const map: Record<string, string> = {
    newspaper: "Newspaper & Paper",
    cardboard: "Cardboard",
    plastic: "Plastic",
    iron: "Metal",
    metal: "Metal",
    aluminium: "E-Waste",
    ewaste: "E-Waste",
    glass: "Glass",
    clothes: "Clothes & Fabric",
  };
  return map[scrapType.toLowerCase()] || scrapType;
}

export function categoryToType(categoryName: string): string {
  const map: Record<string, string> = {
    "Newspaper & Paper": "newspaper",
    "Cardboard": "cardboard",
    "Plastic": "plastic",
    "Metal": "iron",
    "E-Waste": "aluminium",
    "Glass": "glass",
    "Clothes & Fabric": "clothes",
    "Others": "iron",
  };
  return map[categoryName] || "newspaper";
}

// 1. Fetch Rates
export async function apiFetchRates(): Promise<ScrapRate[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/rates`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      return data.rates || data;
    }
  } catch {}
  // Default benchmark rates
  return [
    { scrap_type: "newspaper", display_name: "Newspaper & Paper", rate_per_kg: 15, currency: "INR", is_indicative: true },
    { scrap_type: "plastic", display_name: "Plastic", rate_per_kg: 12, currency: "INR", is_indicative: true },
    { scrap_type: "iron", display_name: "Metal", rate_per_kg: 32, currency: "INR", is_indicative: true },
    { scrap_type: "aluminium", display_name: "E-Waste", rate_per_kg: 45, currency: "INR", is_indicative: true },
    { scrap_type: "glass", display_name: "Glass", rate_per_kg: 4, currency: "INR", is_indicative: true },
    { scrap_type: "cardboard", display_name: "Cardboard", rate_per_kg: 9, currency: "INR", is_indicative: true },
    { scrap_type: "clothes", display_name: "Clothes & Fabric", rate_per_kg: 7, currency: "INR", is_indicative: true },
  ];
}

// 2. Create Request
export async function apiCreateRequest(params: {
  category: string;
  weight: number;
  address: string;
  notes?: string;
  lat?: number;
  lng?: number;
}): Promise<ScrapRequest> {
  const scrap_type = categoryToType(params.category);
  const payload = {
    scrap_type,
    quantity_kg: params.weight,
    latitude: params.lat || 28.5244,
    longitude: params.lng || 77.2188,
    address_note: `${params.address}${params.notes ? ` — ${params.notes}` : ""}`,
  };

  try {
    const res = await fetch(`${API_BASE_URL}/api/requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Demo-User-Id": String(currentUserId),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const bReq = await res.json();
      const newReq: ScrapRequest = {
        id: bReq.id ? `REQ-${bReq.id}` : `REQ-${Date.now().toString().slice(-6)}`,
        household_id: currentUserId,
        household_name: DEMO_USERS.find((u) => u.id === currentUserId)?.name || "Priya Sharma",
        category: params.category,
        scrap_type,
        weight: params.weight,
        quantity_kg: params.weight,
        rate_per_kg: bReq.rate_per_kg || 15,
        estimated_value: bReq.estimated_value || params.weight * 15,
        status: "OPEN",
        latitude: payload.latitude,
        longitude: payload.longitude,
        address: params.address,
        address_note: params.notes,
        created_at: new Date().toISOString(),
      };
      mockRequests.unshift(newReq);
      return newReq;
    }
  } catch {}

  // Local fallback
  const newId = `REQ-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
  const rate = scrap_type === "iron" ? 32 : scrap_type === "aluminium" ? 45 : scrap_type === "plastic" ? 12 : 15;
  const newReq: ScrapRequest = {
    id: newId,
    household_id: currentUserId,
    household_name: DEMO_USERS.find((u) => u.id === currentUserId)?.name || "Priya Sharma",
    category: params.category,
    scrap_type,
    weight: params.weight,
    quantity_kg: params.weight,
    rate_per_kg: rate,
    estimated_value: params.weight * rate,
    status: "OPEN",
    distance_km: 1.2,
    latitude: params.lat || 28.5244,
    longitude: params.lng || 77.2188,
    address: params.address,
    address_note: params.notes,
    created_at: new Date().toISOString(),
  };
  mockRequests.unshift(newReq);
  return newReq;
}

// 3. Fetch My Requests
export async function apiFetchMyRequests(): Promise<ScrapRequest[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/requests/mine`, {
      headers: { "X-Demo-User-Id": String(currentUserId) },
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const list = await res.json();
      return list.map((item: any) => ({
        id: item.id ? `REQ-${item.id}` : item.id,
        household_id: item.household_id,
        household_name: item.household_name,
        household_phone: item.household_phone,
        vendor_id: item.vendor_id,
        vendor_name: item.vendor_name,
        vendor_phone: item.vendor_phone,
        category: typeToCategory(item.scrap_type),
        scrap_type: item.scrap_type,
        weight: item.quantity_kg || 10,
        quantity_kg: item.quantity_kg || 10,
        rate_per_kg: item.rate_per_kg || 15,
        estimated_value: item.estimated_value || 150,
        status: normalizeStatus(item.status),
        latitude: item.latitude || 28.5244,
        longitude: item.longitude || 77.2188,
        address: item.address_note || "Saket, New Delhi",
        created_at: item.created_at || new Date().toISOString(),
      }));
    }
  } catch {}

  // In-memory filter based on user role
  const isVendor = currentUserId >= 3;
  if (isVendor) {
    return mockRequests.filter((r) => r.vendor_id === currentUserId || r.status !== "OPEN");
  }
  return mockRequests.filter((r) => r.household_id === currentUserId || !r.household_id);
}

// 4. Fetch Nearby Requests (For Vendors)
export async function apiFetchNearby(radiusKm: number = 5): Promise<ScrapRequest[]> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/requests/nearby?lat=28.5244&lng=77.2188&radius_km=${radiusKm}`,
      {
        headers: { "X-Demo-User-Id": String(currentUserId) },
        signal: AbortSignal.timeout(3000),
      }
    );
    if (res.ok) {
      const list = await res.json();
      return list.map((item: any) => ({
        id: item.id ? `REQ-${item.id}` : item.id,
        category: typeToCategory(item.scrap_type),
        scrap_type: item.scrap_type,
        weight: item.quantity_kg || 10,
        quantity_kg: item.quantity_kg || 10,
        rate_per_kg: item.rate_per_kg || 15,
        estimated_value: item.estimated_value || 150,
        status: normalizeStatus(item.status),
        distance_km: item.distance_km || 1.5,
        latitude: item.approx_latitude || 28.52,
        longitude: item.approx_longitude || 77.22,
        address: "Saket, New Delhi (Approximate area)",
        created_at: item.created_at || new Date().toISOString(),
      }));
    }
  } catch {}

  // Filter OPEN mock requests
  return mockRequests.filter((r) => r.status === "OPEN");
}

// 5. Vendor Claim Request (atomic claim with 409 conflict handling)
export async function apiClaimRequest(requestId: string | number): Promise<ScrapRequest> {
  const numericId = String(requestId).replace(/\D/g, "") || "101";

  try {
    const res = await fetch(`${API_BASE_URL}/api/requests/${numericId}/claim`, {
      method: "POST",
      headers: { "X-Demo-User-Id": String(currentUserId) },
      signal: AbortSignal.timeout(3000),
    });
    if (res.status === 409) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || "ALREADY_CLAIMED: This request was just claimed by another vendor.");
    }
  } catch (e: any) {
    if (e.message?.includes("ALREADY_CLAIMED")) throw e;
  }

  // Update in mock store
  const found = mockRequests.find((r) => String(r.id) === String(requestId));
  if (found) {
    found.status = "CLAIMED";
    found.vendor_id = currentUserId;
    found.vendor_name = DEMO_USERS.find((u) => u.id === currentUserId)?.name || "Vendor";
    found.claimed_at = new Date().toISOString();
    return found;
  }
  throw new Error("Request not found");
}

// 6. Vendor Status Update (Mark Picked Up)
export async function apiMarkPickedUp(requestId: string | number): Promise<ScrapRequest> {
  const numericId = String(requestId).replace(/\D/g, "") || "101";
  try {
    await fetch(`${API_BASE_URL}/api/requests/${numericId}/pickup`, {
      method: "POST",
      headers: { "X-Demo-User-Id": String(currentUserId) },
      signal: AbortSignal.timeout(3000),
    });
  } catch {}

  const found = mockRequests.find((r) => String(r.id) === String(requestId));
  if (found) {
    found.status = "PICKED UP";
    found.picked_up_at = new Date().toISOString();
    return found;
  }
  throw new Error("Request not found");
}

// 7. Vendor Complete Request with Final Weight Settlement
export async function apiCompleteRequest(requestId: string | number, finalWeightKg: number): Promise<ScrapRequest> {
  const numericId = String(requestId).replace(/\D/g, "") || "101";
  try {
    await fetch(`${API_BASE_URL}/api/requests/${numericId}/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Demo-User-Id": String(currentUserId),
      },
      body: JSON.stringify({ final_weight_kg: finalWeightKg }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {}

  const found = mockRequests.find((r) => String(r.id) === String(requestId));
  if (found) {
    found.status = "COMPLETED";
    found.final_weight_kg = finalWeightKg;
    found.final_amount = Number((finalWeightKg * found.rate_per_kg).toFixed(2));
    found.completed_at = new Date().toISOString();
    return found;
  }
  throw new Error("Request not found");
}

// 8. Household Cancel Request
export async function apiCancelRequest(requestId: string | number): Promise<ScrapRequest> {
  const numericId = String(requestId).replace(/\D/g, "") || "101";
  try {
    await fetch(`${API_BASE_URL}/api/requests/${numericId}/cancel`, {
      method: "POST",
      headers: { "X-Demo-User-Id": String(currentUserId) },
      signal: AbortSignal.timeout(3000),
    });
  } catch {}

  const found = mockRequests.find((r) => String(r.id) === String(requestId));
  if (found) {
    found.status = "CANCELLED";
    return found;
  }
  throw new Error("Request not found");
}
