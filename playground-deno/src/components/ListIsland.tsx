export function FormIsland() {
  const onSubmit = e => {
    e.preventDefault()
    alert('sumbitted')
  }
  return (
    <div class="flex">
      <form class="flex-col gap-2" onSubmit={onSubmit}>
        <input name="name" />
        <button>Save</button>
      </form>
    </div>
  )
}
