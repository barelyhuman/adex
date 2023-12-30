export const loader = ({ req }) => {
  return {
    single: req.params.single,
  }
}

export default function Page(loaderData) {
  return html`
    From single
    <pre>
      ${JSON.stringify(loaderData, null, 2)}
    </pre
    >
  `
}
