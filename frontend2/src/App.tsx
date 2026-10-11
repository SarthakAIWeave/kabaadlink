import { Title } from "@solidjs/meta";
import { Loading, Show } from "solid-js";
import Header from "./components/Header";
import { dismissToast, toast } from "./data/store";
import { CheckCircle2, X } from "./icons.js";
import { Router } from "./router";
import "./App.css";

export default function App() {
  return (
    <Router>
      {(props) => (
        <div class="app-shell">
          <Title>KabaadLink | Scrap Pickup Dashboard</Title>
          <Header />
          <Loading fallback={<main>Loading…</main>}>{props.children}</Loading>
          <Show when={toast()}>
            <div class="toast" role="status">
              <CheckCircle2 size={18} />
              {toast()}
              <button aria-label="Dismiss" onClick={dismissToast}>
                <X size={15} />
              </button>
            </div>
          </Show>
        </div>
      )}
    </Router>
  );
}
