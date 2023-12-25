import { reactive } from "@arrow-js/core";
import { html } from "@arrow-js/core";

export const loader = () => {
  return {
    count: 10,
  };
};

export default function (loaderData) {
  const state = reactive({
    count: loaderData.count,
  });

  return html`
    <button @click="${() => (state.count += 1)}">${() => state.count}</button>
  `;
}
