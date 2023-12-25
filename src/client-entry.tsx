import { html } from "@arrow-js/core";

const pageRoutes = import.meta.glob("./pages/**/*.page.{jsx,tsx}");

async function render() {
  const root = document.getElementById("root");
  const mounterPath = root.getAttribute("mounter");
  let loaderData = {};
  try {
    const meta = document.getElementById("__adex").innerText;
    loaderData = JSON.parse(atob(meta));
  } catch (err) {
    console.error(err);
  }

  const modImport: any = await pageRoutes[mounterPath]();
  const Page = modImport.default;
  const mountable = html`${() => Page(loaderData)}`;
  root.innerHTML = "";
  mountable(root);
}

render();
