export const loader = ({ req }) => {
  return {
    single: req.params.single
  }
}

export default function Page ({ serverProps }) {
  return (
    <>
      From single
      <pre>
        {JSON.stringify(serverProps, null, 2)}
      </pre>
    </>
  )
}
