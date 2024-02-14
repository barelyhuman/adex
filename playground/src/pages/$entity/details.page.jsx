export const loader = ({ req }) => {
  return {
    entity: req.params.entity
  }
}

export default function Page ({ serverProps }) {
  return (
    <>
      Fetching {serverProps.entity} data
    </>
  )
}
