import { Title } from "@solidjs/meta";
import { createMemo, createSignal, For, Show } from "solid-js";
import {
  addRequest,
  address,
  categories,
  formatRupees,
  notify,
  requests,
  setAddress,
  vendors,
} from "../data/store";
import {
  Archive,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
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
  User,
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

  const scrollToForm = () => {
    document
      .getElementById("pickup-form")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const submitRequest = async () => {
    await addRequest(category(), weight(), notes());
    setStep(3);
    notify("Your scrap pickup request was created!");
  };

  const sidebarLinks = [
    { label: "Home", icon: HomeIcon, href: "/", active: true },
    { label: "New Request", icon: Plus, href: "#pickup-form", action: scrollToForm },
    { label: "My Requests", icon: Archive, href: "/my-requests" },
    { label: "Price Guide", icon: Tag, href: "/price-guide" },
    { label: "My Address", icon: MapPin, href: "#pickup-form", action: scrollToForm },
    { label: "Profile", icon: User, href: "#", action: () => notify("Priya Sharma • Household Profile") },
  ];

  return (
    <div class="dashboard-layout">
      <Title>KabaadLink | Scrap Pickup Dashboard</Title>

      {/* ================= COLUMN 1: LEFT SIDEBAR & VENDORS ================= */}
      <aside class="left-column">
        {/* Sidebar Nav */}
        <nav class="sidebar-nav card" aria-label="Quick navigation">
          <For each={sidebarLinks}>
            {(item) => (
              <a
                href={item.href}
                class={{ "sidebar-link": true, "sidebar-link-active": !!item.active }}
                onClick={(e) => {
                  if (item.action) {
                    e.preventDefault();
                    item.action();
                  }
                }}
              >
                <span class="sidebar-icon">
                  <item.icon size={18} />
                </span>
                <span>{item.label}</span>
              </a>
            )}
          </For>
        </nav>

        {/* Nearby Vendors Card */}
        <section class="vendors card">
          <div class="section-heading">
            <h2>
              Nearby Vendors <span class="heading-muted">(Example)</span>
            </h2>
            <a class="text-link" href="/for-vendors">
              View All <ArrowRight size={14} />
            </a>
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
                    <Star size={14} color="#f8b900" /> {vendor.rating}{" "}
                    <span class="muted">({vendor.pickups})</span>
                  </span>
                </div>
                <span class="distance-pill">
                  <MapPin size={12} /> {vendor.distance}
                </span>
              </div>
            )}
          </For>
        </section>

        {/* Vendors Near You Map Card */}
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
              <MapPin size={22} color="currentColor" />
            </span>
            <span class="map-pin pin-b">
              <MapPin size={22} color="currentColor" />
            </span>
            <span class="map-pin pin-c">
              <MapPin size={22} color="currentColor" />
            </span>
            <span class="map-pin pin-d">
              <MapPin size={22} color="currentColor" />
            </span>
            <span class="map-pin pin-e">
              <MapPin size={22} color="currentColor" />
            </span>
            <span class="map-home">
              <HomeIcon size={18} color="currentColor" />
            </span>
          </div>
          <div class="map-legend">
            <span>
              <HomeIcon size={14} color="currentColor" /> Your Location
            </span>
            <span>
              <MapPin size={15} color="#08a45b" /> Nearby Vendors (approximate)
            </span>
          </div>
        </section>
      </aside>

      {/* ================= COLUMN 2: CENTER / MAIN ACTIONS ================= */}
      <main class="center-column">
        {/* Hero Card */}
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
              Create a Scrap Request <ArrowRight size={18} />
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

        {/* Popular Scrap Categories - Shifted Upper */}
        <section class="categories card" id="categories">
          <div class="section-heading">
            <h2>Popular Scrap Categories</h2>
            <a class="text-link" href="/price-guide">
              View Price Guide <ArrowRight size={15} />
            </a>
          </div>
          <div class="category-row-grid">
            <For each={categories}>
              {(item) => (
                <button
                  class={{
                    "category-card-item": true,
                    "category-card-selected": category() === item.name,
                  }}
                  onClick={() => {
                    setCategory(item.name);
                    setStep(1);
                    scrollToForm();
                  }}
                >
                  <span class="category-card-emoji">{item.icon}</span>
                  <span class="category-card-name">{item.name}</span>
                </button>
              )}
            </For>
          </div>
        </section>

        {/* Pickup Request Form */}
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

            {/* Price Estimate Banner */}
            <div class="price-estimate">
              <span class="estimate-icon">
                <Tag size={20} />
              </span>
              <div class="estimate-copy">
                <strong>Indicative Price Estimate</strong>
                <small>
                  {formatRupees(selectedCategory().min)} –{" "}
                  {formatRupees(selectedCategory().max)} per kg
                </small>
                <small class="muted">(based on current local rates)</small>
              </div>
              <div class="estimate-value">
                <small>Estimated Value</small>
                <strong>
                  {formatRupees(minValue())} – {formatRupees(maxValue())}
                  <CircleHelp size={14} class="estimate-info-icon" />
                </strong>
              </div>
            </div>

            {/* Address Field */}
            <div class="address-field">
              <label class="form-field">
                Pickup Address
                <div class="address-input">
                  <MapPin size={18} />
                  <input
                    id="address-input-field"
                    value={address()}
                    onInput={(e) => setAddress(e.currentTarget.value)}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setAddress("Saket, New Delhi – 110017");
                      notify("Updated to current GPS location: Saket, New Delhi");
                    }}
                  >
                    <LocateFixed size={15} /> Use Current Location
                  </button>
                </div>
              </label>
            </div>

            {/* Notes Field */}
            <div class="notes-field">
              <label class="form-field">
                Address Notes (Optional)
                <textarea
                  placeholder="e.g. Gate no. 3, call when you arrive, items are at security desk."
                  value={notes()}
                  maxlength={200}
                  onInput={(e) => setNotes(e.currentTarget.value)}
                />
                <span class="character-count">{notes().length}/200</span>
              </label>
            </div>

            <button
              class="primary-button full-button"
              onClick={() => setStep(2)}
            >
              Find Nearby Vendors
            </button>
          </Show>

          <Show when={step() === 2}>
            <div class="step-content">
              <div class="step-title">
                <div>
                  <h3>Select a Preferred Collector</h3>
                  <p>Choose a verified vendor nearby or broadcast to all.</p>
                </div>
              </div>
              <For each={vendors}>
                {(vendor) => (
                  <div class="select-vendor">
                    <div class="vendor-avatar">{vendor.avatar}</div>
                    <div>
                      <strong>{vendor.name}</strong>
                      <p>
                        ⭐ {vendor.rating} ({vendor.pickups}) · {vendor.distance} away
                      </p>
                    </div>
                    <button onClick={submitRequest}>
                      Choose Vendor <ArrowRight size={15} />
                    </button>
                  </div>
                )}
              </For>
              <button
                class="secondary-button full-button"
                style="margin-top: 8px;"
                onClick={submitRequest}
              >
                Broadcast to All Nearby Vendors
              </button>
              <button
                class="text-link"
                style="margin-top: 8px; justify-content: center;"
                onClick={() => setStep(1)}
              >
                ← Back to Edit Details
              </button>
            </div>
          </Show>

          <Show when={step() === 3}>
            <div class="success-content">
              <span class="step-card-icon" style="width: 56px; height: 56px; margin: 0 auto 12px;">
                <Check size={28} />
              </span>
              <h3>Pickup Request Submitted!</h3>
              <p>
                Nearby vendors in {address().split("–")[0] || "Saket"} have been notified.
                You will receive a notification as soon as a collector claims your pickup.
              </p>
              <button
                class="primary-button"
                onClick={() => {
                  setStep(1);
                  setNotes("");
                }}
              >
                Create Another Request <ArrowRight size={16} />
              </button>
            </div>
          </Show>
        </section>
      </main>

      {/* ================= COLUMN 3: RIGHT STATUS & IMPACT ================= */}
      <aside class="right-column">
        {/* My Requests Card */}
        <section class="requests card" id="my-requests">
          <div class="section-heading">
            <h2>My Requests</h2>
            <a class="text-link" href="/my-requests">
              View All <ArrowRight size={14} />
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
                  <MapPin size={15} /> {request.address || "Saket, New Delhi"}
                </div>
                <div class="request-meta">
                  <Clock3 size={15} /> Today, 4:00 PM – 7:00 PM
                </div>
                <div class="vendors-nearby">
                  <Users size={15} color="currentColor" /> 3 vendors nearby
                </div>
                <ChevronRight class="request-chevron" size={18} />
              </div>
            )}
          </For>
        </section>

        {/* Track Your Request Stepper */}
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
                    <item.icon size={18} />
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

        {/* Transparent Pricing Card */}
        <section class="pricing card">
          <div style="display: flex; gap: 14px; align-items: flex-start;">
            <span class="pricing-icon">
              <IndianRupee size={24} />
            </span>
            <div>
              <h2>Transparent Pricing</h2>
              <p>
                Live local rates based on demand, vendor quotes and material type.
              </p>
              <a class="text-link" href="/price-guide">
                View Price Guide <ArrowRight size={14} />
              </a>
            </div>
          </div>
        </section>

        {/* Cleaner City Impact Card */}
        <section class="impact card">
          <h2>Be a Part of a Cleaner City</h2>
          <div class="impact-row">
            <span class="impact-icon">
              <HomeIcon size={22} />
            </span>
            <div>
              <strong>1,200+</strong>
              <small>Households Served</small>
            </div>
          </div>
          <div class="impact-row">
            <span class="impact-icon">
              <Users size={22} />
            </span>
            <div>
              <strong>85+</strong>
              <small>Verified Vendors</small>
            </div>
          </div>
          <div class="impact-row">
            <span class="impact-icon">
              <Leaf size={22} />
            </span>
            <div>
              <strong>12,500+ kg</strong>
              <small>Scrap Recycled</small>
            </div>
          </div>
          <div class="impact-trees" aria-hidden="true">
            <svg width="130" height="72" viewBox="0 0 130 72" fill="none" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="65" cy="66" rx="60" ry="10" fill="#e8f6ee" />
              <path d="M24 62L24 44" stroke="#849b82" stroke-width="3" stroke-linecap="round" />
              <circle cx="24" cy="38" r="16" fill="#8ed4ad" opacity="0.85" />
              <path d="M56 62L56 40" stroke="#71866e" stroke-width="3.5" stroke-linecap="round" />
              <circle cx="56" cy="32" r="20" fill="#46ab72" />
              <circle cx="48" cy="28" r="14" fill="#359c63" />
              <circle cx="62" cy="26" r="13" fill="#58be84" />
              <path d="M94 62L94 46" stroke="#849b82" stroke-width="3" stroke-linecap="round" />
              <circle cx="94" cy="40" r="15" fill="#96d9b4" opacity="0.9" />
              <circle cx="102" cy="44" r="10" fill="#a8e3c4" opacity="0.9" />
            </svg>
          </div>
        </section>
      </aside>
    </div>
  );
}
