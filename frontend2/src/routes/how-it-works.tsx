import { Title } from "@solidjs/meta";
import { For } from "solid-js";
import { categories } from "../data/store";
import { ArrowRight, ClipboardList, Tag, Truck, Users } from "../icons.js";

const steps = [
  {
    n: "1",
    icon: ClipboardList,
    title: "Create a request",
    text: "Pick a scrap category, enter the estimated weight and your pickup address. It takes less than a minute.",
  },
  {
    n: "2",
    icon: Users,
    title: "A vendor claims it",
    text: "Verified vendors near you see your open request and claim it. You get notified as soon as one accepts.",
  },
  {
    n: "3",
    icon: Truck,
    title: "Pickup & payment",
    text: "The vendor arrives in your chosen slot, weighs the scrap on a certified scale and pays you on the spot.",
  },
];

export default function HowItWorks() {
  return (
    <div class="dashboard-grid">
      <Title>How It Works | KabaadLink</Title>
      <section class="card page-card">
        <div class="page-head">
          <h1>How It Works</h1>
          <p>
            From scrap pile to cash in hand in three simple steps. Transparent
            pricing at every stage.
          </p>
        </div>
        <div class="steps-grid">
          <For each={steps}>
            {(step) => (
              <div class="step-card">
                <span class="step-number">{step.n}</span>
                <span class="step-card-icon">
                  <step.icon size={26} />
                </span>
                <h2>{step.title}</h2>
                <p>{step.text}</p>
              </div>
            )}
          </For>
        </div>
        <div class="page-cta">
          <a class="primary-button" href="/">
            Create a Scrap Request <ArrowRight size={18} />
          </a>
          <a class="text-link" href="/price-guide">
            Check rates first <Tag size={15} /> <ArrowRight size={15} />
          </a>
        </div>
      </section>
    </div>
  );
}
