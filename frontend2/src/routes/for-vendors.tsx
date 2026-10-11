import { Title } from "@solidjs/meta";
import { createSignal, createMemo, For, Show } from "solid-js";
import {
  claimPickup,
  formatRupees,
  notify,
  requests,
  updatePickupStatus,
  vendors,
} from "../data/store";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  IndianRupee,
  MapPin,
  Navigation,
  ShieldCheck,
  Star,
  Truck,
  Users,
} from "../icons.js";

const perks = [
  {
    icon: Users,
    title: "Steady stream of pickups",
    text: "Get matched with households near you posting daily scrap requests.",
  },
  {
    icon: IndianRupee,
    title: "Fair, transparent rates",
    text: "Quote against live local rates. No haggling, no surprises.",
  },
  {
    icon: ShieldCheck,
    title: "Verified badge",
    text: "Build trust with an ID-verified profile, ratings and pickup history.",
  },
];

export default function ForVendors() {
  const [radius, setRadius] = createSignal("5 km");
  const [tab, setTab] = createSignal<"feed" | "my-pickups">("feed");

  // Open requests available to claim
  const openRequests = createMemo(() => requests().filter((r) => r.status === "OPEN"));

  // Claimed/in-progress pickups assigned to vendor
  const claimedPickups = createMemo(() =>
    requests().filter((r) => r.status === "CLAIMED" || r.status === "PICKED UP" || r.status === "COMPLETED")
  );

  const handleClaim = async (id: string | number) => {
    try {
      await claimPickup(id);
    } catch (e: any) {
      notify(e.message || "409 Conflict: Already claimed by another vendor.");
    }
  };

  return (
    <div class="dashboard-grid">
      <Title>For Vendors | KabaadLink</Title>

      {/* Hero Head */}
      <section class="card page-card">
        <div class="page-head">
          <h1>Grow your scrap business with KabaadLink</h1>
          <p>
            Join 85+ verified vendors collecting more scrap, with less
            downtime, across the city.
          </p>
          <div style="display: flex; gap: 10px; margin-top: 14px;">
            <button
              class={{ "primary-button": tab() === "feed", "secondary-button": tab() !== "feed" }}
              onClick={() => setTab("feed")}
            >
              Browse Open Feed ({openRequests().length})
            </button>
            <button
              class={{ "primary-button": tab() === "my-pickups", "secondary-button": tab() !== "my-pickups" }}
              onClick={() => setTab("my-pickups")}
            >
              My Pickups ({claimedPickups().length})
            </button>
          </div>
        </div>

        <div class="steps-grid" style="margin-top: 24px;">
          <For each={perks}>
            {(perk) => (
              <div class="step-card">
                <span class="step-card-icon">
                  <perk.icon size={26} />
                </span>
                <h2>{perk.title}</h2>
                <p>{perk.text}</p>
              </div>
            )}
          </For>
        </div>
      </section>

      {/* Main Tab View */}
      <Show when={tab() === "feed"}>
        <section class="requests card page-card">
          <div class="section-heading">
            <div>
              <h2>Nearby Scrap Feed</h2>
              <span class="muted" style="font-size: 13px;">Open requests within {radius()}</span>
            </div>
            <div style="display: flex; gap: 6px;">
              <For each={["3 km", "5 km", "10 km", "15 km"]}>
                {(r) => (
                  <button
                    class={{ "pill-select": true, "category-selected": radius() === r }}
                    style="padding: 4px 10px; font-size: 11px; font-weight: 700; border-radius: 12px; border: 1px solid #d1d5db;"
                    onClick={() => setRadius(r)}
                  >
                    {r}
                  </button>
                )}
              </For>
            </div>
          </div>

          <div class="request-list">
            <For each={openRequests()}>
              {(request) => (
                <div class="request-item">
                  <div class="request-top">
                    <strong>{request.id}</strong>
                    <span class="status-pill">{request.status}</span>
                  </div>
                  <p>
                    {request.category} <span class="dot-separator">•</span> ~{request.weight} kg
                  </p>
                  <div class="request-meta">
                    <MapPin size={16} /> {request.address || "Saket, New Delhi"}
                  </div>
                  <div class="request-meta">
                    <Clock3 size={16} /> Posted recently · Estimated value: {formatRupees(request.estimated_value || request.weight * 15)}
                  </div>
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 12px; pt: 8px; border-top: 1px solid #f3f4f6;">
                    <span class="distance-pill" style="font-size: 11px;">
                      <MapPin size={12} /> {request.distance_km || 1.2} km away
                    </span>
                    <button
                      class="primary-button"
                      style="padding: 6px 14px; font-size: 12px; border-radius: 8px;"
                      onClick={() => handleClaim(request.id)}
                    >
                      Claim Pickup <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </For>
          </div>

          <Show when={openRequests().length === 0}>
            <p class="muted" style="text-align: center; padding: 24px;">
              No open requests found within {radius()}. Check back soon or switch identities.
            </p>
          </Show>
        </section>
      </Show>

      {/* Claimed Pickups Tab */}
      <Show when={tab() === "my-pickups"}>
        <section class="requests card page-card">
          <div class="section-heading">
            <h2>My Assigned Pickups</h2>
            <span class="muted" style="font-size: 13px;">Manage collection status and settlement</span>
          </div>

          <div class="request-list">
            <For each={claimedPickups()}>
              {(request) => (
                <div class="request-item">
                  <div class="request-top">
                    <strong>{request.id}</strong>
                    <span class="status-pill">{request.status}</span>
                  </div>
                  <p>
                    {request.category} <span class="dot-separator">•</span> ~{request.weight} kg
                  </p>
                  <div class="request-meta">
                    <MapPin size={16} /> Exact Address: {request.address || "Saket, New Delhi"}
                  </div>
                  <Show when={request.household_phone}>
                    <div class="request-meta" style="color: #047857; font-weight: 600;">
                      📞 Customer: {request.household_name || "Household"} ({request.household_phone})
                    </div>
                  </Show>

                  <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; pt: 8px; border-top: 1px solid #f3f4f6;">
                    <Show when={request.status === "CLAIMED"}>
                      <button
                        class="primary-button"
                        style="padding: 6px 12px; font-size: 12px;"
                        onClick={() => updatePickupStatus(request.id, "PICKED UP")}
                      >
                        <Truck size={14} /> Mark as Picked Up
                      </button>
                    </Show>

                    <Show when={request.status === "PICKED UP"}>
                      <button
                        class="primary-button"
                        style="padding: 6px 12px; font-size: 12px; background: #047857;"
                        onClick={() => {
                          const w = prompt("Enter final scale weight (kg):", String(request.weight));
                          const parsed = parseFloat(w || "");
                          if (!isNaN(parsed) && parsed > 0) {
                            updatePickupStatus(request.id, "COMPLETED", parsed);
                          }
                        }}
                      >
                        <Check size={14} /> Complete & Settle
                      </button>
                    </Show>

                    <Show when={request.status === "COMPLETED"}>
                      <span style="font-size: 12px; font-weight: 700; color: #047857; display: flex; align-items: center; gap: 4px;">
                        <CheckCircle2 size={16} /> Settled: {formatRupees(request.final_amount || request.estimated_value)}
                      </span>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </div>

          <Show when={claimedPickups().length === 0}>
            <p class="muted" style="text-align: center; padding: 24px;">
              You have not claimed any pickups yet. Switch to "Browse Open Feed" to claim one!
            </p>
          </Show>
        </section>
      </Show>

      {/* Verified Vendors List Section */}
      <section class="vendors card page-card">
        <div class="section-heading">
          <h2>
            Verified Vendors on KabaadLink <span class="heading-muted">(Example)</span>
          </h2>
        </div>
        <For each={vendors}>
          {(vendor) => (
            <div class="vendor-row">
              <div class="vendor-avatar">
                {vendor.avatar}
                <i />
              </div>
              <div class="vendor-info">
                <strong>{vendor.name}</strong>
                <span>
                  <Star size={16} color="#f8b900" /> {vendor.rating}{" "}
                  <span class="muted">({vendor.pickups} pickups)</span>
                </span>
              </div>
              <span class="distance-pill">
                <MapPin size={13} /> {vendor.distance}
              </span>
            </div>
          )}
        </For>
      </section>
    </div>
  );
}
