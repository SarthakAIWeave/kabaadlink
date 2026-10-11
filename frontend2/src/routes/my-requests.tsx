import { Title } from "@solidjs/meta";
import { createSignal, createMemo, For, Show } from "solid-js";
import { cancelUserRequest, requests } from "../data/store";
import {
  Archive,
  ArrowRight,
  Check,
  Clock3,
  MapPin,
  Truck,
  Users,
  XCircle,
} from "../icons.js";

const FILTER_TABS = ["ALL", "OPEN", "CLAIMED", "PICKED UP", "COMPLETED", "CANCELLED"] as const;

export default function MyRequests() {
  const [filter, setFilter] = createSignal<string>("ALL");

  const filteredRequests = createMemo(() => {
    const f = filter();
    if (f === "ALL") return requests();
    return requests().filter((r) => r.status === f);
  });

  return (
    <div class="dashboard-grid">
      <Title>My Requests | KabaadLink</Title>
      <section class="tracking card page-card">
        <div class="page-head">
          <h1>My Requests</h1>
          <p>Follow every pickup from open request to completed payment.</p>
        </div>
        <div class="tracking-steps">
          <For
            each={[
              { name: "OPEN", icon: Archive },
              { name: "CLAIMED", icon: Users },
              { name: "PICKED UP", icon: Truck },
              { name: "COMPLETED", icon: Check },
            ]}
          >
            {(item, index) => (
              <div class="tracking-step">
                <span
                  class={{
                    "tracking-icon": true,
                    "tracking-active": index() === 0,
                  }}
                >
                  <item.icon size={19} />
                </span>
                <span
                  class={{
                    "tracking-label": true,
                    "tracking-label-active": index() === 0,
                  }}
                >
                  {item.name}
                </span>
              </div>
            )}
          </For>
        </div>
      </section>

      <section class="requests card page-card">
        <div class="section-heading">
          <h2>
            All Requests{" "}
            <span class="heading-muted">({filteredRequests().length})</span>
          </h2>
          <a class="text-link" href="/">
            New Request <ArrowRight size={15} />
          </a>
        </div>

        {/* Filter Pills */}
        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px;">
          <For each={FILTER_TABS}>
            {(tab) => (
              <button
                class={{
                  "pill-select": true,
                  "category-selected": filter() === tab,
                }}
                style="padding: 6px 14px; font-size: 12px; font-weight: 700; border-radius: 20px; border: 1px solid #d1d5db;"
                onClick={() => setFilter(tab)}
              >
                {tab}
              </button>
            )}
          </For>
        </div>

        <div class="request-list">
          <For each={filteredRequests()}>
            {(request) => (
              <div class="request-item" style="position: relative;">
                <div class="request-top">
                  <strong>{request.id}</strong>
                  <span class="status-pill">{request.status}</span>
                </div>
                <p>
                  {request.category} <span class="dot-separator">•</span> ~
                  {request.weight} kg
                </p>
                <div class="request-meta">
                  <MapPin size={16} /> {request.address || "Saket, New Delhi"}
                </div>
                <div class="request-meta">
                  <Clock3 size={16} /> Today, 4:00 PM – 7:00 PM
                </div>

                <Show when={request.vendor_name}>
                  <div class="request-meta" style="color: #d97706; font-weight: 600;">
                    <Truck size={16} /> Assigned Collector: {request.vendor_name}
                  </div>
                </Show>

                <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 10px; pt: 8px; border-top: 1px solid #f3f4f6;">
                  <div class="vendors-nearby">
                    <Users size={17} color="currentColor" /> 3 vendors nearby
                  </div>

                  <Show when={request.status === "OPEN"}>
                    <button
                      style="font-size: 11px; font-weight: 600; color: #dc2626; padding: 4px 10px; border-radius: 8px; border: 1px solid #fecaca; background: #fef2f2; cursor: pointer;"
                      onClick={() => cancelUserRequest(request.id)}
                    >
                      Cancel Request
                    </button>
                  </Show>
                </div>
              </div>
            )}
          </For>
        </div>
        <Show when={filteredRequests().length === 0}>
          <p class="muted" style="text-align: center; padding: 24px;">No requests found for status "{filter()}".</p>
        </Show>
      </section>
    </div>
  );
}
