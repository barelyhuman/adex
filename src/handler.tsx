import { renderToString } from "arrow-render-to-string";
import viteDevServer from "vavite/vite-dev-server";
import { Options } from "sirv";
import ms from "ms";

const pageRoutes = import.meta.glob("./pages/**/*.page.{jsx,tsx}");

export const sirvOptions: Options = {
  maxAge: ms("1m"),
};

const buildTemplate = ({
  page = "",
  mounter = "",
  clientEntry = "",
  prefillData = {},
} = {}) => {
  return `
    <div id="root" mounter="${mounter}">${page}</div>
    <script type="module" defer src="${clientEntry}"></script>
    <script type="application/json" id="__adex">${btoa(
      JSON.stringify(prefillData, null, 2)
    )}</script>
  `;
};

async function buildHandler({ routes }) {
  const routeMap = Object.fromEntries(
    Object.entries(pageRoutes).map(([path, modImport]) => {
      let finalUrl = path
        .replace("./pages", "")
        .replace(/(\.page\.)(jsx|tsx)$/, "");
      if (finalUrl.endsWith("index")) {
        finalUrl = finalUrl.slice(0, -"index".length);
      }
      return [
        finalUrl,
        {
          path,
          importer: modImport,
        },
      ];
    })
  );

  let clientEntryPath;
  if (viteDevServer) {
    clientEntryPath = "src/client-entry.tsx";
  } else {
    const manifest = (await import("../dist/client/.vite/manifest.json"))
      .default;
    clientEntryPath = manifest["src/client-entry.tsx"].file;
  }

  return async (req, res) => {
    const hasMappedPage = routeMap[req.url];
    if (!hasMappedPage) return;

    const mod = (await hasMappedPage.importer()) as {
      default: (loaderData: any) => any;
      loader: ({ req }) => any;
    };

    const loadedData = "loader" in mod ? await mod.loader({ req }) : {};
    const str = renderToString(mod.default(loadedData));
    const html = buildTemplate({
      page: str,
      mounter: hasMappedPage.path,
      clientEntry: clientEntryPath,
      prefillData: loadedData,
    });
    res.setHeader("content-type", "text/html");
    res.write(html);
    res.end();
  };
}

export default await buildHandler({ routes: pageRoutes });
