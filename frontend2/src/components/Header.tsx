import { useLocation } from "@solidjs/router";
import { createSignal, For, Show } from "solid-js";
import {
  activeUser,
  address,
  DEMO_USERS,
  notify,
  setAddress,
  switchUser,
} from "../data/store";
import { Bell, Check, ChevronDown, MapPin, Truck, User } from "../icons.js";

const nav = [
  { label: "Home", href: "/" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "My Requests", href: "/my-requests" },
  { label: "For Vendors", href: "/for-vendors" },
  { label: "Price Guide", href: "/price-guide" },
];

export default function Header() {
  const location = useLocation();
  const [locationOpen, setLocationOpen] = createSignal(false);
  const [profileOpen, setProfileOpen] = createSignal(false);
  const isActive = (href: string) =>
    href === "/" ? location.pathname === "/" : location.pathname === href;

  const households = DEMO_USERS.filter((u) => u.role === "HOUSEHOLD");
  const vendors = DEMO_USERS.filter((u) => u.role === "VENDOR");

  return (
    <header class="top-bar">
      <a
        href="/"
        class="brand-section"
        aria-label="KabaadLink home"
      >
        <div class="brand-symbol">
          <img src="/logo.png" alt="KabaadLink logo" width={42} height={42} />
        </div>
        <div>
          <div class="brand-name">
            Kabaad<span>Link</span>
          </div>
          <div class="brand-tagline">Your Scrap. A Cleaner Tomorrow.</div>
        </div>
      </a>
      <div class="location-container">
        <button
          class="location-select"
          onClick={() => setLocationOpen(!locationOpen())}
        >
          <MapPin size={17} /> <span>{address().split("–")[0] || "Saket, New Delhi"}</span>
          <ChevronDown size={15} />
        </button>
        <Show when={locationOpen()}>
          <div class="dropdown location-dropdown">
            <strong>Pickup location</strong>
            <input
              value={address()}
              onInput={(e) => setAddress(e.currentTarget.value)}
              aria-label="Location"
            />
            <button
              onClick={() => {
                setLocationOpen(false);
                notify("Pickup location updated");
              }}
            >
              Apply location
            </button>
          </div>
        </Show>
      </div>
      <nav class="header-nav" aria-label="Main navigation">
        {nav.map((item) => (
          <a
            href={item.href}
            class={isActive(item.href) ? "nav-active" : undefined}
          >
            {item.label}
          </a>
        ))}
      </nav>
      <div class="header-actions">
        <button
          class="icon-button"
          aria-label="Notifications"
          onClick={() => notify("You're all caught up!")}
        >
          <Bell size={21} />
        </button>
        <div class="header-divider" />
        <div class="profile-container">
          <button
            class="profile-trigger"
            onClick={() => setProfileOpen(!profileOpen())}
          >
            <span class="profile-avatar">{activeUser().initials}</span>
            <span class="profile-copy">
              <strong>{activeUser().name}</strong>
              <small>{activeUser().role === "HOUSEHOLD" ? "Household" : "Scrap Vendor"}</small>
            </span>
            <ChevronDown size={16} />
          </button>
          <Show when={profileOpen()}>
            <div class="dropdown profile-dropdown" style="min-width: 240px; padding: 12px;">
              <div style="font-size: 11px; font-weight: 700; color: #748094; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">
                Switch Demo Identity
              </div>

              <div style="font-size: 10px; font-weight: 700; color: #099459; text-transform: uppercase; margin-top: 6px; margin-bottom: 4px;">
                Households
              </div>
              <For each={households}>
                {(u) => (
                  <button
                    style="display: flex; align-items: center; justify-content: space-between; width: 100%; text-align: left; padding: 6px 8px; border-radius: 8px; font-size: 13px; font-weight: 500;"
                    onClick={() => {
                      switchUser(u);
                      setProfileOpen(false);
                    }}
                  >
                    <span>{u.avatar} {u.name}</span>
                    <Show when={activeUser().id === u.id}>
                      <Check size={14} color="#099459" />
                    </Show>
                  </button>
                )}
              </For>

              <div style="font-size: 10px; font-weight: 700; color: #099459; text-transform: uppercase; margin-top: 10px; margin-bottom: 4px;">
                Scrap Vendors
              </div>
              <For each={vendors}>
                {(u) => (
                  <button
                    style="display: flex; align-items: center; justify-content: space-between; width: 100%; text-align: left; padding: 6px 8px; border-radius: 8px; font-size: 13px; font-weight: 500;"
                    onClick={() => {
                      switchUser(u);
                      setProfileOpen(false);
                    }}
                  >
                    <span>{u.avatar} {u.name}</span>
                    <Show when={activeUser().id === u.id}>
                      <Check size={14} color="#099459" />
                    </Show>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>
    </header>
  );
}
