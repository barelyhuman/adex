import { html } from 'adex/html'
export const loader = ({ req }) => {
  return {
    greeting: req.params.name,
  }
}

export default function Page(loaderData) {
  return html` <h1>Hello ${loaderData.greeting}</h1> `
}
