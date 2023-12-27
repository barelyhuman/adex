import { reactive } from "@arrow-js/core";
import { html } from "@arrow-js/core";
import fs from "node:fs";

export const loader = async () => {
  const fileContent = await fs.promises.readFile("./index.page.jsx");
  return {
    count: 10,
    cwd: fileContent,
  };
};

export default function (loaderData) {
  const state = reactive({
    count: loaderData.count,
  });

  return html`
    <button @click="${() => (state.count += 1)}">${() => state.count}</button>
    <pre>
      ${JSON.stringify(loaderData.cwd)}
</pre>
  `;
}
