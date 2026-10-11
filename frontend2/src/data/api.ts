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
  approx_latitude?: number;
  approx_longitude?: number;
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
    id: "REQ-1",
    household_id: 1,
    household_name: "Priya Sharma",
    household_phone: "+91 98765 43210",
    category: "Newspaper & Paper",
    scrap_type: "newspaper",
    weight: 12.5,
    quantity_kg: 12.5,
    rate_per_kg: 15,
    estimated_value: 187.5,
    status: "OPEN",
    distance_km: 1.2,
    latitude: 28.6139,
    longitude: 77.2090,
    address: "B-42, Pandara Road, Ground Floor",
    address_note: "B-42, Pandara Road, Ground Floor",
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "REQ-2",
    household_id: 2,
    household_name: "Rohan Verma",
    household_phone: "+91 98111 22334",
    category: "Metal",
    scrap_type: "iron",
    weight: 25.0,
    quantity_kg: 25.0,
    rate_per_kg: 25,
    estimated_value: 625.0,
    status: "OPEN",
    distance_km: 0.9,
    latitude: 28.6200,
    longitude: 77.2150,
    address: "Sector 3, Building 14",
    address_note: "Sector 3, Building 14",
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
];

// Helper to normalize backend status (e.g. PICKED_UP -> PICKED UP)
export function normalizeStatus(st: string): ScrapRequest["status"] {
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
    aluminium: "Aluminium",
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
    "Aluminium": "aluminium",
    "E-Waste": "aluminium",
    "Glass": "plastic",
    "Clothes & Fabric": "cardboard",
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
      const list = Array.isArray(data) ? data : data.rates || [];
      return list.map((r: any) => ({
        scrap_type: r.scrap_type,
        display_name: r.display_name,
        rate_per_kg: Number(r.rate_per_kg),
        currency: r.currency || "INR",
        is_indicative: r.is_indicative !== undefined ? r.is_indicative : true,
      }));
    }
  } catch {}
  return [
    { scrap_type: "newspaper", display_name: "Newspaper", rate_per_kg: 15, currency: "INR", is_indicative: true },
    { scrap_type: "cardboard", display_name: "Cardboard", rate_per_kg: 8, currency: "INR", is_indicative: true },
    { scrap_type: "plastic", display_name: "Plastic", rate_per_kg: 10, currency: "INR", is_indicative: true },
    { scrap_type: "iron", display_name: "Iron", rate_per_kg: 25, currency: "INR", is_indicative: true },
    { scrap_type: "aluminium", display_name: "Aluminium", rate_per_kg: 80, currency: "INR", is_indicative: true },
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
    latitude: params.lat || 28.6139,
    longitude: params.lng || 77.2090,
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
        id: bReq.id ? `REQ-${bReq.id}` : `REQ-${Date.now().toString().slice(-4)}`,
        household_id: currentUserId,
        household_name: DEMO_USERS.find((u) => u.id === currentUserId)?.name || "Priya Sharma",
        category: params.category,
        scrap_type,
        weight: Number(bReq.quantity_kg || params.weight),
        quantity_kg: Number(bReq.quantity_kg || params.weight),
        rate_per_kg: Number(bReq.rate_per_kg || 15),
        estimated_value: Number(bReq.estimated_value || params.weight * 15),
        status: "OPEN",
        latitude: Number(bReq.latitude || payload.latitude),
        longitude: Number(bReq.longitude || payload.longitude),
        address: bReq.address_note || params.address,
        address_note: params.notes,
        created_at: bReq.created_at || new Date().toISOString(),
      };
      mockRequests.unshift(newReq);
      return newReq;
    }
  } catch {}

  // Local fallback
  const newId = `REQ-${Date.now().toString().slice(-4)}`;
  const rate = scrap_type === "iron" ? 25 : scrap_type === "aluminium" ? 80 : scrap_type === "plastic" ? 10 : scrap_type === "cardboard" ? 8 : 15;
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
    latitude: payload.latitude,
    longitude: payload.longitude,
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
        weight: Number(item.quantity_kg || 10),
        quantity_kg: Number(item.quantity_kg || 10),
        rate_per_kg: Number(item.rate_per_kg || 15),
        estimated_value: Number(item.estimated_value || 150),
        status: normalizeStatus(item.status),
        latitude: Number(item.latitude || 28.6139),
        longitude: Number(item.longitude || 77.2090),
        address: item.address_note || "Pandara Road, New Delhi",
        address_note: item.address_note,
        final_weight_kg: item.final_weight_kg ? Number(item.final_weight_kg) : undefined,
        final_amount: item.final_amount ? Number(item.final_amount) : undefined,
        created_at: item.created_at || new Date().toISOString(),
      }));
    }
  } catch {}

  const isVendor = currentUserId >= 3;
  if (isVendor) {
    return mockRequests.filter((r) => r.vendor_id === currentUserId || r.status !== "OPEN");
  }
  return mockRequests.filter((r) => r.household_id === currentUserId || !r.household_id);
}

// 4. Fetch Nearby Requests (For Vendors)
export async function apiFetchNearby(radiusKm: number = 5): Promise<ScrapRequest[]> {
  const vendorUser = DEMO_USERS.find((u) => u.id === currentUserId);
  const lat = 28.6180;
  const lng = 77.2050;

  try {
    const res = await fetch(
      `${API_BASE_URL}/api/requests/nearby?lat=${lat}&lng=${lng}&radius_km=${radiusKm}`,
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
        weight: Number(item.quantity_kg || 10),
        quantity_kg: Number(item.quantity_kg || 10),
        rate_per_kg: Number(item.rate_per_kg || 15),
        estimated_value: Number(item.estimated_value || 150),
        status: normalizeStatus(item.status),
        distance_km: item.distance_km ? Number(item.distance_km) : 1.2,
        latitude: Number(item.approx_latitude || item.latitude || 28.6139),
        longitude: Number(item.approx_longitude || item.longitude || 77.2090),
        address: "New Delhi (Approximate area)",
        created_at: item.created_at || new Date().toISOString(),
      }));
    }
  } catch {}

  return mockRequests.filter((r) => r.status === "OPEN");
}

// 5. Vendor Claim Request (atomic claim with 409 conflict handling)
export async function apiClaimRequest(requestId: string | number): Promise<ScrapRequest> {
  const numericId = String(requestId).replace(/\D/g, "");

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
    if (res.ok) {
      const data = await res.json();
      const found = mockRequests.find((r) => String(r.id) === String(requestId));
      if (found) {
        found.status = "CLAIMED";
        found.vendor_id = currentUserId;
        found.vendor_name = DEMO_USERS.find((u) => u.id === currentUserId)?.name || "Vendor";
        found.claimed_at = data.claimed_at || new Date().toISOString();
        return found;
      }
      return {
        id: requestId,
        category: "Scrap",
        scrap_type: "general",
        weight: 10,
        quantity_kg: 10,
        rate_per_kg: 15,
        estimated_value: 150,
        status: "CLAIMED",
        vendor_id: currentUserId,
        latitude: 28.6139,
        longitude: 77.2090,
        address: "New Delhi",
        created_at: new Date().toISOString(),
      };
    }
  } catch (e: any) {
    if (e.message?.includes("ALREADY_CLAIMED")) throw e;
  }

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
  const numericId = String(requestId).replace(/\D/g, "");
  try {
    const res = await fetch(`${API_BASE_URL}/api/requests/${numericId}/pickup`, {
      method: "POST",
      headers: { "X-Demo-User-Id": String(currentUserId) },
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const found = mockRequests.find((r) => String(r.id) === String(requestId));
      if (found) {
        found.status = "PICKED UP";
        found.picked_up_at = new Date().toISOString();
        return found;
      }
    }
  } catch {}

  const found = mockRequests.find((r) => String(r.id) === String(requestId));
  if (found) {
    found.status = "PICKED UP";
    found.picked_up_at = new Date().toISOString();
    return found;
  }
  return {
    id: requestId,
    category: "Scrap",
    scrap_type: "general",
    weight: 10,
    quantity_kg: 10,
    rate_per_kg: 15,
    estimated_value: 150,
    status: "PICKED UP",
    latitude: 28.6139,
    longitude: 77.2090,
    address: "New Delhi",
    created_at: new Date().toISOString(),
  };
}

// 7. Vendor Complete Request with Final Weight Settlement
export async function apiCompleteRequest(requestId: string | number, finalWeightKg: number): Promise<ScrapRequest> {
  const numericId = String(requestId).replace(/\D/g, "");
  try {
    const res = await fetch(`${API_BASE_URL}/api/requests/${numericId}/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Demo-User-Id": String(currentUserId),
      },
      body: JSON.stringify({ final_weight_kg: finalWeightKg }),
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      const found = mockRequests.find((r) => String(r.id) === String(requestId));
      if (found) {
        found.status = "COMPLETED";
        found.final_weight_kg = finalWeightKg;
        found.final_amount = Number(data.final_amount || (finalWeightKg * found.rate_per_kg));
        found.completed_at = new Date().toISOString();
        return found;
      }
    }
  } catch {}

  const found = mockRequests.find((r) => String(r.id) === String(requestId));
  if (found) {
    found.status = "COMPLETED";
    found.final_weight_kg = finalWeightKg;
    found.final_amount = Number((finalWeightKg * found.rate_per_kg).toFixed(2));
    found.completed_at = new Date().toISOString();
    return found;
  }
  return {
    id: requestId,
    category: "Scrap",
    scrap_type: "general",
    weight: finalWeightKg,
    quantity_kg: finalWeightKg,
    rate_per_kg: 15,
    estimated_value: finalWeightKg * 15,
    status: "COMPLETED",
    final_weight_kg: finalWeightKg,
    final_amount: finalWeightKg * 15,
    latitude: 28.6139,
    longitude: 77.2090,
    address: "New Delhi",
    created_at: new Date().toISOString(),
  };
}

// 8. Household Cancel Request
export async function apiCancelRequest(requestId: string | number): Promise<ScrapRequest> {
  const numericId = String(requestId).replace(/\D/g, "");
  try {
    const res = await fetch(`${API_BASE_URL}/api/requests/${numericId}/cancel`, {
      method: "POST",
      headers: { "X-Demo-User-Id": String(currentUserId) },
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const found = mockRequests.find((r) => String(r.id) === String(requestId));
      if (found) {
        found.status = "CANCELLED";
        return found;
      }
    }
  } catch {}

  const found = mockRequests.find((r) => String(r.id) === String(requestId));
  if (found) {
    found.status = "CANCELLED";
    return found;
  }
  return {
    id: requestId,
    category: "Scrap",
    scrap_type: "general",
    weight: 10,
    quantity_kg: 10,
    rate_per_kg: 15,
    estimated_value: 150,
    status: "CANCELLED",
    latitude: 28.6139,
    longitude: 77.2090,
    address: "New Delhi",
    created_at: new Date().toISOString(),
  };
}
