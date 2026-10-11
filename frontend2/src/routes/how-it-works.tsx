import { Title } from "@solidjs/meta";
import { createSignal } from "solid-js";
import {
  ArrowRight,
  Check,
  Home as HomeIcon,
  IndianRupee,
  Leaf,
  MapPin,
  ShieldCheck,
  Tag,
  User,
  Users,
} from "../icons.js";

export default function HowItWorks() {
  const [activeTab, setActiveTab] = createSignal<"households" | "vendors">("households");

  const scrollTo = (id: string, tab: "households" | "vendors") => {
    setActiveTab(tab);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div class="how-it-works-page">
      <Title>How KabaadLink Works | Simple Steps. Real Impact.</Title>

      {/* ================= HERO SECTION ================= */}
      <section class="hiw-hero card">
        <div class="hiw-hero-copy">
          <p class="eyebrow">SIMPLE STEPS. REAL IMPACT.</p>
          <h1>
            How <span>KabaadLink</span> Works
          </h1>
          <p class="hiw-hero-subtitle">
            We make scrap collection easy, transparent and reliable for both households and vendors.
          </p>
          <div class="hiw-pill-group">
            <button
              class={{ "hiw-pill-btn": true, "hiw-pill-active": activeTab() === "households" }}
              onClick={() => scrollTo("for-households", "households")}
            >
              <HomeIcon size={16} /> For Households
            </button>
            <button
              class={{ "hiw-pill-btn": true, "hiw-pill-active": activeTab() === "vendors" }}
              onClick={() => scrollTo("for-vendors", "vendors")}
            >
              <Users size={16} /> For Vendors
            </button>
          </div>
        </div>

        <div class="hiw-hero-art" aria-hidden="true">
          <img
            class="hiw-hero-img"
            src="/recycling-scene.png"
            alt="Handing scrap to KabaadLink collector"
          />
          <div class="hiw-hero-script">
            <span>Your Scrap</span>
            <span>Finds a Better Home</span>
            <svg
              class="hiw-script-curve"
              width="130"
              height="16"
              viewBox="0 0 130 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 12C35 4 95 3 127 12"
                stroke="#07954f"
                stroke-width="3"
                stroke-linecap="round"
              />
            </svg>
          </div>
        </div>
      </section>

      {/* ================= FOR HOUSEHOLDS (4 STEPS) ================= */}
      <section class="hiw-section-card card" id="for-households">
        <div class="hiw-section-head">
          <h2>For Households — 4 Simple Steps</h2>
          <p>Create a request, get nearby vendors, and get your scrap picked up.</p>
        </div>

        <div class="hiw-steps-row">
          {/* Step 1 */}
          <div class="hiw-step-col">
            <div class="hiw-step-top">
              <span class="hiw-step-num">1</span>
            </div>
            <div class="hiw-step-visual hiw-visual-img">
              <img src="/tablet_select_scrap.jpg" alt="Selecting scrap category on tablet" />
            </div>
            <h3>Create a Scrap Request</h3>
            <p>Select category, add estimated weight, and share your location and address notes.</p>
          </div>

          <div class="hiw-arrow-col" aria-hidden="true">
            <ArrowRight size={22} color="#07954f" />
          </div>

          {/* Step 2 */}
          <div class="hiw-step-col">
            <div class="hiw-step-top">
              <span class="hiw-step-num">2</span>
            </div>
            <div class="hiw-step-visual hiw-visual-price">
              <div class="hiw-price-mockup-card">
                <div class="hiw-price-header">
                  <span class="hiw-calc-badge">
                    <Tag size={18} />
                  </span>
                  <div class="hiw-price-meta">
                    <small>Indicative Price Estimate</small>
                    <strong>₹12 – ₹18 per kg</strong>
                  </div>
                </div>
                <div class="hiw-price-mockup-lines">
                  <span class="line-a" />
                  <span class="line-b" />
                </div>
              </div>
            </div>
            <h3>Get Transparent Pricing</h3>
            <p>See indicative price range based on current local rates before confirming your request.</p>
          </div>

          <div class="hiw-arrow-col" aria-hidden="true">
            <ArrowRight size={22} color="#07954f" />
          </div>

          {/* Step 3 */}
          <div class="hiw-step-col">
            <div class="hiw-step-top">
              <span class="hiw-step-num">3</span>
            </div>
            <div class="hiw-step-visual hiw-visual-map">
              <div class="hiw-map-radar-circle circle-outer" />
              <div class="hiw-map-radar-circle circle-inner" />
              <span class="hiw-map-center-pin">
                <MapPin size={22} color="#07954f" />
              </span>
              <div class="hiw-vendor-tag tag-top">
                <span class="vendor-av">👨🏽</span>
                <span>2.4 km</span>
              </div>
              <div class="hiw-vendor-tag tag-bottom">
                <span class="vendor-av">👨🏻</span>
                <span>3.1 km</span>
              </div>
            </div>
            <h3>Vendors Nearby</h3>
            <p>Nearby verified vendors see your request and one of them claims it (first come, first serve).</p>
          </div>

          <div class="hiw-arrow-col" aria-hidden="true">
            <ArrowRight size={22} color="#07954f" />
          </div>

          {/* Step 4 */}
          <div class="hiw-step-col">
            <div class="hiw-step-top">
              <span class="hiw-step-num">4</span>
            </div>
            <div class="hiw-step-visual hiw-visual-img">
              <img src="/vendor_weighing_scrap.jpg" alt="Vendor weighing scrap on scale" />
            </div>
            <h3>Pickup & Completion</h3>
            <p>Vendor picks up the scrap, enters final weight, and you get fair settlement based on actual weight.</p>
          </div>
        </div>
      </section>

      {/* ================= FOR VENDORS (4 STEPS) ================= */}
      <section class="hiw-section-card hiw-vendor-container card" id="for-vendors">
        <div class="hiw-section-head">
          <h2>For Vendors — 4 Simple Steps</h2>
          <p>Find nearby requests, claim them, pick up scrap, and complete the job.</p>
        </div>

        <div class="hiw-steps-row">
          {/* Step 1 */}
          <div class="hiw-step-col">
            <div class="hiw-step-top">
              <span class="hiw-step-num">1</span>
            </div>
            <div class="hiw-step-visual hiw-visual-list">
              <div class="hiw-list-header">New Requests Nearby</div>
              <div class="hiw-list-row">
                <MapPin size={11} color="#07954f" />
                <span class="dist">2.1 km</span>
                <span class="wt">~8 kg</span>
                <span class="val">₹120 - ₹160</span>
                <span class="arr">›</span>
              </div>
              <div class="hiw-list-row">
                <MapPin size={11} color="#07954f" />
                <span class="dist">3.4 km</span>
                <span class="wt">~15 kg</span>
                <span class="val">₹200 - ₹300</span>
                <span class="arr">›</span>
              </div>
              <div class="hiw-list-row">
                <MapPin size={11} color="#07954f" />
                <span class="dist">4.0 km</span>
                <span class="wt">~5 kg</span>
                <span class="val">₹60 - ₹90</span>
                <span class="arr">›</span>
              </div>
            </div>
            <h3>View Nearby Requests</h3>
            <p>See open scrap requests within your set radius (default 5 km), sorted by nearest first.</p>
          </div>

          <div class="hiw-arrow-col" aria-hidden="true">
            <ArrowRight size={22} color="#07954f" />
          </div>

          {/* Step 2 */}
          <div class="hiw-step-col">
            <div class="hiw-step-top">
              <span class="hiw-step-num">2</span>
            </div>
            <div class="hiw-step-visual hiw-visual-claim">
              <div class="hiw-claim-button">Claim Request</div>
              <div class="hiw-mouse-cursor" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 3L11.5 21L14.5 13.5L22 10.5L4 3Z"
                    fill="#142033"
                    stroke="#ffffff"
                    stroke-width="1.8"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
            </div>
            <h3>Claim a Request</h3>
            <p>Tap to claim. Our system prevents double claiming using atomic updates, so every request is fair.</p>
          </div>

          <div class="hiw-arrow-col" aria-hidden="true">
            <ArrowRight size={22} color="#07954f" />
          </div>

          {/* Step 3 */}
          <div class="hiw-step-col">
            <div class="hiw-step-top">
              <span class="hiw-step-num">3</span>
            </div>
            <div class="hiw-step-visual hiw-visual-timeline">
              <div class="hiw-timeline-item step-done">
                <span class="timeline-dot dot-done">
                  <Check size={11} color="#ffffff" />
                </span>
                <strong>CLAIMED</strong>
                <small class="time">02:15 PM</small>
              </div>
              <div class="timeline-connector connector-done" />
              <div class="hiw-timeline-item step-current">
                <span class="timeline-dot dot-current">
                  <i class="dot-inner" />
                </span>
                <strong>PICKED UP</strong>
                <small class="time">03:10 PM</small>
              </div>
              <div class="timeline-connector" />
              <div class="hiw-timeline-item step-pending">
                <span class="timeline-dot dot-pending" />
                <strong class="pending-label">COMPLETED</strong>
              </div>
            </div>
            <h3>Pickup & Update</h3>
            <p>Pick up the scrap and enter the final weight with photos (optional) in the app.</p>
          </div>

          <div class="hiw-arrow-col" aria-hidden="true">
            <ArrowRight size={22} color="#07954f" />
          </div>

          {/* Step 4 */}
          <div class="hiw-step-col">
            <div class="hiw-step-top">
              <span class="hiw-step-num">4</span>
            </div>
            <div class="hiw-step-visual hiw-visual-earnings">
              <div class="hiw-earnings-data">
                <small>Earnings</small>
                <strong>₹240</strong>
                <div class="hiw-sub-meta">
                  Final Weight <b>12 kg</b>
                </div>
                <div class="hiw-sub-meta">
                  Rate per kg <b>₹20</b>
                </div>
              </div>
              <div class="hiw-earnings-art">
                <img src="/cash_earnings_stack.jpg" alt="Earnings cash stack with checkmark" />
              </div>
            </div>
            <h3>Get Paid</h3>
            <p>Once completed, the final amount is calculated based on actual weight and current rates.</p>
          </div>
        </div>
      </section>

      {/* ================= BOTTOM VALUE PROPOSITIONS ================= */}
      <section class="hiw-value-props card">
        <div class="hiw-prop-item">
          <span class="hiw-prop-icon">
            <ShieldCheck size={22} />
          </span>
          <div>
            <strong>Verified Vendors</strong>
            <small>Trusted and reviewed by the community</small>
          </div>
        </div>

        <div class="hiw-prop-item">
          <span class="hiw-prop-icon">
            <IndianRupee size={22} />
          </span>
          <div>
            <strong>Transparent Pricing</strong>
            <small>See indicative rates before pickup</small>
          </div>
        </div>

        <div class="hiw-prop-item">
          <span class="hiw-prop-icon">
            <MapPin size={22} />
          </span>
          <div>
            <strong>Hyperlocal</strong>
            <small>Connect with nearby kabadiwalas</small>
          </div>
        </div>

        <div class="hiw-prop-item">
          <span class="hiw-prop-icon">
            <Leaf size={22} />
          </span>
          <div>
            <strong>Cleaner Communities</strong>
            <small>Recycle more, reduce landfill waste</small>
          </div>
        </div>
      </section>
    </div>
  );
}
