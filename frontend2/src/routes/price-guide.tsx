import { Title } from "@solidjs/meta";
import { createSignal, createMemo, For } from "solid-js";
import { categories, formatRupees, notify } from "../data/store";
import { ArrowRight, IndianRupee, Tag, Minus, Plus } from "../icons.js";

export default function PriceGuide() {
  const [selectedCat, setSelectedCat] = createSignal(categories[0].name);
  const [calcWeight, setCalcWeight] = createSignal(10);

  const activeCategory = createMemo(
    () => categories.find((c) => c.name === selectedCat()) || categories[0]
  );

  const estMin = createMemo(() => calcWeight() * activeCategory().min);
  const estMax = createMemo(() => calcWeight() * activeCategory().max);

  return (
    <div class="dashboard-grid">
      <Title>Price Guide | KabaadLink</Title>
      <section class="card page-card">
        <div class="page-head">
          <h1>Price Guide</h1>
          <p>
            Indicative per-kg rates based on current local demand. The final
            amount is confirmed by the vendor after weighing.
          </p>
        </div>

        {/* Live Estimator Widget */}
        <div
          class="card"
          style="background: #f0fdf4; border: 1px solid #bbf7d0; margin-bottom: 24px; padding: 18px;"
        >
          <strong style="display: block; font-size: 14px; color: #166534; margin-bottom: 12px;">
            ⚡ Instant Payout Calculator
          </strong>
          <div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: center;">
            <div style="flex: 1; min-width: 180px;">
              <small class="muted" style="display: block; margin-bottom: 4px; font-weight: 600;">Category</small>
              <select
                style="width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid #d1d5db; background: white;"
                value={selectedCat()}
                onChange={(e) => setSelectedCat(e.currentTarget.value)}
              >
                <For each={categories}>
                  {(c) => <option value={c.name}>{c.name}</option>}
                </For>
              </select>
            </div>

            <div style="flex: 1; min-width: 140px;">
              <small class="muted" style="display: block; margin-bottom: 4px; font-weight: 600;">Estimated Weight (kg)</small>
              <div style="display: flex; align-items: center; gap: 8px;">
                <button
                  style="width: 32px; height: 32px; border-radius: 8px; border: 1px solid #d1d5db; background: white; display: grid; place-items: center;"
                  onClick={() => setCalcWeight(Math.max(1, calcWeight() - 1))}
                >
                  <Minus size={14} />
                </button>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  style="width: 60px; text-align: center; padding: 6px; border-radius: 8px; border: 1px solid #d1d5db; font-weight: 700; background: white;"
                  value={calcWeight()}
                  onInput={(e) => setCalcWeight(Math.max(1, Number(e.currentTarget.value) || 1))}
                />
                <button
                  style="width: 32px; height: 32px; border-radius: 8px; border: 1px solid #d1d5db; background: white; display: grid; place-items: center;"
                  onClick={() => setCalcWeight(calcWeight() + 1)}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            <div style="padding: 10px 16px; background: white; border-radius: 12px; border: 1px solid #bbf7d0; min-width: 160px; text-align: right;">
              <small style="color: #166534; font-weight: 600; display: block;">Estimated Payout</small>
              <strong style="font-size: 18px; color: #15803d;">
                {formatRupees(estMin())} – {formatRupees(estMax())}
              </strong>
            </div>
          </div>
        </div>

        <div class="price-table" role="table" aria-label="Scrap price guide">
          <div class="price-row price-head" role="row">
            <span role="columnheader">Category</span>
            <span role="columnheader">Rate (per kg)</span>
            <span role="columnheader" />
          </div>
          <For each={categories}>
            {(item) => (
              <div class="price-row" role="row">
                <span>
                  <span class="category-emoji">{item.icon}</span> {item.name}
                </span>
                <span class="price-rate">
                  <IndianRupee size={14} /> {item.min} – {item.max}
                </span>
                <a
                  class="text-link"
                  href="/"
                  onClick={() => setSelectedCat(item.name)}
                >
                  <Tag size={14} /> Sell scrap <ArrowRight size={14} />
                </a>
              </div>
            )}
          </For>
        </div>
      </section>
    </div>
  );
}
