/** The first other names of an entry, and how many more there are. */
export function AliasChips({ aliases }: { aliases: string[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {aliases.slice(0, 3).map((alias) => (
        <span
          key={alias}
          className="max-w-full truncate rounded-md bg-muted/60 px-1.5 py-0.5 text-xs font-normal text-foreground/75"
          title={alias}
        >
          {alias}
        </span>
      ))}
      {aliases.length > 3 && (
        <span className="text-xs text-muted-foreground" title={aliases.slice(3).join(", ")}>
          +{aliases.length - 3}
        </span>
      )}
    </span>
  )
}
