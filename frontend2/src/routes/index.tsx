import { Title } from "@solidjs/meta";
import { createMemo, createSignal, createEffect, For, Show } from "solid-js";
import {
  addRequest,
  address,
  categories,
  formatRupees,
  notify,
  requests,
  refreshRequests,
  setAddress,
  vendors,
} from "../data/store";
import {
  Archive,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Home as HomeIcon,
  IndianRupee,
  Leaf,
  LocateFixed,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
  Star,
  Tag,
  Truck,
  Users,
} from "../icons.js";

export default function Home() {
  const [category, setCategory] = createSignal(categories[0].name);
  const [weight, setWeight] = createSignal(10);
  const [notes, setNotes] = createSignal("");
  const [step, setStep] = createSignal(1);
  const [radius, setRadius] = createSignal("5 km");
  const selectedCategory = createMemo(
    () => categories.find((c) => c.name === category()) ?? categories[0],
  );
  const minValue = createMemo(() => weight() * selectedCategory().min);
  const maxValue = createMemo(() => weight() * selectedCategory().max);
  const scrollToForm = () =>
    document
      .getElementById("pickup-form")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  const submitRequest = async () => {
    await addRequest(category(), weight(), notes());
    setStep(3);
    notify("Your scrap pickup request was created!");
  };
  return (
    <div class="dashboard-grid">
      <Title>KabaadLink | Scrap Pickup Dashboard</Title>
      <section class="hero card">
        <div class="hero-copy">
          <p class="eyebrow">CLEAN HOMES. STRONGER COMMUNITIES.</p>
          <h1>
            Turn Your Scrap into
            <br />
            Value with <span>KabaadLink</span>
          </h1>
          <p class="hero-subtitle">
            Reliable pickup. Transparent pricing. Verified local vendors.
          </p>
          <button class="primary-button hero-button" onClick={scrollToForm}>
            Create a Scrap Request <ArrowRight size={20} />
          </button>
        </div>
        <div class="hero-art" aria-hidden="true">
          <img
            class="hero-image"
            src="/recycling-scene.png"
            alt="Household member handing a box of recyclables to a KabaadLink vendor"
          />
        </div>
      </section>

      <section class="requests card" id="my-requests">
        <div class="section-heading">
          <h2>My Requests</h2>
          <a class="text-link" href="/my-requests">
            View All <ArrowRight size={15} />
          </a>
        </div>
        <For each={requests().slice(0, 1)}>
          {(request) => (
            <div class="request-item">
              <div class="request-top">
                <strong>{request.id}</strong>
                <span class="status-pill">{request.status}</span>
              </div>
              <p>
                {request.category} <span class="dot-separator">•</span> ~
                {request.weight} kg
              </p>
              <div class="request-meta">
                <MapPin size={16} /> Saket, New Delhi
              </div>
              <div class="request-meta">
                <Clock3 size={16} /> Today, 4:00 PM – 7:00 PM
              </div>
              <div class="vendors-nearby">
                <Users size={17} color="currentColor" /> 3 vendors nearby
              </div>
            </div>
          )}
        </For>
      </section>

      <section class="categories card" id="categories">
        <div class="section-heading">
          <h2>Popular Scrap Categories</h2>
          <a class="text-link" href="/price-guide">
            View Price Guide <ArrowRight size={15} />
          </a>
        </div>
        <div class="category-grid">
          <For each={categories}>
            {(item) => (
              <button
                class={{
                  "category-tile": true,
                  "category-selected": category() === item.name,
                }}
                onClick={() => {
                  setCategory(item.name);
                  setStep(1);
                  scrollToForm();
                }}
              >
                <span class="category-emoji">{item.icon}</span>
                <span>{item.name}</span>
              </button>
            )}
          </For>
        </div>
      </section>

      <section class="tracking card">
        <h2>Track Your Request</h2>
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

      <div class="vendor-column">
        <section class="vendors card">
          <div class="section-heading">
            <h2>
              Nearby Vendors <span class="heading-muted">(Example)</span>
            </h2>
            <button
              class="text-link"
              onClick={() => notify("Showing 3 nearby vendors")}
            >
              View All
            </button>
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
        <section class="map-card card">
          <div class="section-heading">
            <h2>Vendors Near You</h2>
            <select
              aria-label="Search radius"
              value={radius()}
              onChange={(e) => setRadius(e.currentTarget.value)}
            >
              <option>3 km</option>
              <option>5 km</option>
              <option>10 km</option>
            </select>
          </div>
          <div class="map-visual">
            <div class="map-street street-a" />
            <div class="map-street street-b" />
            <div class="map-street street-c" />
            <div class="map-street street-d" />
            <div class="map-street street-e" />
            <div class="map-radius">
              <div class="map-radius-inner" />
            </div>
            <span class="map-pin pin-a">
              <MapPin size={23} color="currentColor" />
            </span>
            <span class="map-pin pin-b">
              <MapPin size={23} color="currentColor" />
            </span>
            <span class="map-pin pin-c">
              <MapPin size={23} color="currentColor" />
            </span>
            <span class="map-pin pin-d">
              <MapPin size={23} color="currentColor" />
            </span>
            <span class="map-pin pin-e">
              <MapPin size={23} color="currentColor" />
            </span>
            <span class="map-home">
              <HomeIcon size={19} color="currentColor" />
            </span>
          </div>
          <div class="map-legend">
            <span>
              <HomeIcon size={15} color="currentColor" /> Your Location
            </span>
            <span>
              <MapPin size={16} color="#08a45b" /> Nearby Vendors (approximate)
            </span>
          </div>
        </section>
      </div>

      <section class="pickup card" id="pickup-form">
        <div class="pickup-heading">
          <h2>Create a Scrap Pickup Request</h2>
          <div class="step-indicator">
            <span>Step {step()} of 3</span>
            <div class="step-bars">
              <For each={[1, 2, 3]}>
                {(n) => <i class={{ "step-filled": step() >= n }} />}
              </For>
            </div>
          </div>
        </div>
        <Show when={step() === 1}>
          <div class="form-grid">
            <label class="form-field">
              Select Category
              <select
                value={category()}
                onChange={(e) => setCategory(e.currentTarget.value)}
              >
                <For each={categories}>
                  {(c) => (
                    <option value={c.name}>
                      {c.icon} {c.name}
                    </option>
                  )}
                </For>
              </select>
            </label>
            <label class="form-field">
              Estimated Weight (kg)
              <div class="weight-control">
                <button
                  aria-label="Decrease weight"
                  onClick={() => setWeight(Math.max(1, weight() - 1))}
                >
                  <Minus size={17} />
                </button>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={weight()}
                  onInput={(e) =>
                    setWeight(Math.max(1, Number(e.currentTarget.value) || 1))
                  }
                />
                <button
                  aria-label="Increase weight"
                  onClick={() => setWeight(weight() + 1)}
                >
                  <Plus size={17} />
                </button>
              </div>
            </label>
          </div>
          <div class="price-estimate">
            <div class="estimate-icon">
              <Tag size={21} />
            </div>
            <div class="estimate-copy">
              <strong>Indicative Price Estimate</strong>
              <b>
                ₹{selectedCategory().min} – ₹{selectedCategory().max} per kg
              </b>
              <small>(based on current local rates)</small>
            </div>
            <div class="estimate-value">
              <small>Estimated Value</small>
              <strong>
                {formatRupees(minValue())} – {formatRupees(maxValue())}
              </strong>
            </div>
            <button
              class="info-icon"
              aria-label="Price information"
              onClick={() =>
                notify(
                  "Indicative prices only. Final amount is confirmed by the vendor after weighing.",
                )
              }
            >
              <CircleHelp size={17} />
            </button>
          </div>
          <label class="form-field address-field">
            Pickup Address
            <div class="address-input">
              <MapPin size={18} />
              <input
                value={address()}
                onInput={(e) => setAddress(e.currentTarget.value)}
              />
              <button
                onClick={() =>
                  notify("Enter your pickup address to update the location")
                }
              >
                <LocateFixed size={17} /> <span>Use Current Location</span>
              </button>
            </div>
          </label>
          <label class="form-field notes-field">
            Address Notes <span class="muted">(Optional)</span>
            <textarea
              maxlength={200}
              placeholder="e.g. Gate no. 3, call when you arrive, items are at security desk."
              value={notes()}
              onInput={(e) => setNotes(e.currentTarget.value)}
            />
            <span class="character-count">{notes().length}/200</span>
          </label>
          <button
            class="primary-button full-button"
            onClick={() => {
              if (!address().trim())
                return notify("Please enter a pickup address");
              setStep(2);
            }}
          >
            Find Nearby Vendors <ArrowRight size={18} />
          </button>
        </Show>
        <Show when={step() === 2}>
          <div class="step-content">
            <div class="step-title">
              <ShieldCheck size={24} color="#087e48" />
              <div>
                <h3>Nearby verified vendors</h3>
                <p>Choose a vendor to send your pickup request.</p>
              </div>
            </div>
            <For each={vendors}>
              {(v) => (
                <div class="select-vendor">
                  <span class="vendor-avatar">{v.avatar}</span>
                  <div>
                    <strong>{v.name}</strong>
                    <p>
                      ⭐ {v.rating} · {v.distance} away
                    </p>
                  </div>
                  <button onClick={submitRequest}>
                    Choose Vendor <ArrowRight size={15} />
                  </button>
                </div>
              )}
            </For>
            <button class="secondary-button" onClick={() => setStep(1)}>
              Back to details
            </button>
          </div>
        </Show>
        <Show when={step() === 3}>
          <div class="success-content">
            <CheckCircle2 size={55} color="#07954f" />
            <h3>Pickup request created!</h3>
            <p>
              Your request is open. Nearby vendors can now view and claim it.
            </p>
            <a class="primary-button" href="/my-requests">
              View My Requests <ArrowRight size={17} />
            </a>
          </div>
        </Show>
      </section>

      <div class="right-bottom">
        <section class="pricing card">
          <div class="pricing-icon">
            <IndianRupee size={27} />
          </div>
          <div>
            <h2>Transparent Pricing</h2>
            <p>
              Live local rates based on demand, vendor quotes and material type.
            </p>
            <a class="text-link" href="/price-guide">
              View Price Guide <ArrowRight size={16} />
            </a>
          </div>
        </section>
        <section class="impact card">
          <h2>Be a Part of a Cleaner City</h2>
          <div class="impact-row">
            <span class="impact-icon">
              <HomeIcon size={25} />
            </span>
            <div>
              <strong>1,200+</strong>
              <small>Households Served</small>
            </div>
          </div>
          <div class="impact-row">
            <span class="impact-icon">
              <Users size={25} />
            </span>
            <div>
              <strong>85+</strong>
              <small>Verified Vendors</small>
            </div>
          </div>
          <div class="impact-row">
            <span class="impact-icon">
              <Leaf size={25} />
            </span>
            <div>
              <strong>12,500+ kg</strong>
              <small>Scrap Recycled</small>
            </div>
          </div>
          <div class="impact-trees" aria-hidden="true">
            🌳🌿
          </div>
        </section>
      </div>
    </div>
  );
}
