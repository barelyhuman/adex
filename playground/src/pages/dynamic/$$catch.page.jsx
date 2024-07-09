export const loader = ({ req }) => {
  return {
    catch: req.params.catch
  }
}

export default function Page ({ serverProps }) {
  return (
    <>
      From Catch
      <pre>
        {JSON.stringify(serverProps, null, 2)}
      </pre>
    </>
  )
}
