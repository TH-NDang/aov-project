import { useEffect, useState } from "react"
import {
  wikiRequest,
  wikiErrorMessage,
  WikiError,
  ROLE_LABELS,
  type Asset,
  type Change,
  type Context,
  type HeroDetail,
  type HeroSummary,
  type Page,
} from "./wiki-api"
const panel = "rounded-[16px] border border-white/12 bg-[#10131de8] p-5 shadow-xl backdrop-blur-md sm:p-7"
const input =
  "rounded-[8px] border border-white/20 bg-[#141823] px-3 py-2 text-sm text-white focus:outline-2 focus:outline-gold"
const button =
  "rounded-[8px] border border-gold/30 bg-gold/10 px-4 py-2 text-sm text-gold transition-colors hover:bg-gold/20 disabled:opacity-40"
function useRemote<T>(path: string | null) {
  const [state, setState] = useState<{ path: string | null; data?: T; error?: unknown; loading: boolean }>({
    path,
    loading: !!path,
  })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!path) return
    const abort = new AbortController()
    setState({ path, loading: true })
    void wikiRequest<T>(path, abort.signal).then(
      (data) => {
        if (!abort.signal.aborted) setState({ path, data, loading: false })
      },
      (error) => {
        if (!abort.signal.aborted) setState({ path, error, loading: false })
      },
    )
    return () => abort.abort()
  }, [path, attempt])
  return {
    data: state.path === path ? state.data : undefined,
    error: state.path === path ? state.error : undefined,
    loading: state.path === path ? state.loading : !!path,
    retry: () => setAttempt((n) => n + 1),
  }
}
function Image({ asset, alt, className }: { asset?: Asset; alt: string; className: string }) {
  return asset?.currentVersion?.url ? (
    <img src={asset.currentVersion.url} alt={alt} className={className} loading="lazy" />
  ) : (
    <div
      role="img"
      aria-label={`${alt}: chưa có ảnh`}
      className={className + " grid place-items-center bg-white/5 text-sm text-white/40"}
    >
      Chưa có ảnh
    </div>
  )
}
function ContextNote({ context }: { context: Context }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/60">
      <span>
        {context.region} · {context.ruleset.code}
      </span>
      <span>Patch {context.patch.code}</span>
      <span>Hiệu lực: {new Date(context.effectiveAt).toLocaleString("vi-VN")}</span>
      {context.fallbackApplied && <span>Đang dùng bản dịch {context.actualLocale}</span>}
    </div>
  )
}
function ErrorState({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div className={panel} role="alert">
      <p>{wikiErrorMessage(error)}</p>
      {error instanceof WikiError && error.requestId && (
        <p className="mt-2 text-xs text-white/50">Mã tra cứu: {error.requestId}</p>
      )}
      <button className={button + " mt-4"} onClick={retry}>
        Thử lại
      </button>
    </div>
  )
}
function History({ heroId, query }: { heroId: string; query: string }) {
  const [page, setPage] = useState(0)
  const history = useRemote<Page<Change>>(`/heroes/${encodeURIComponent(heroId)}/changes?${query}&page=${page}&size=10`)
  const display = (value: unknown) =>
    value === null || value === undefined ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value)
  return (
    <section className={panel}>
      <h2 className="font-heading text-2xl text-gold">Lịch sử thay đổi</h2>
      {history.loading ? (
        <p role="status" className="mt-4">
          Đang tải lịch sử…
        </p>
      ) : history.error ? (
        <ErrorState error={history.error} retry={history.retry} />
      ) : !history.data?.items.length ? (
        <p className="mt-4 text-white/60">Chưa có thay đổi gameplay được ghi nhận trong vùng này.</p>
      ) : (
        <>
          <div className="mt-5 space-y-5">
            {history.data.items.map((change) => (
              <article className="border-l-2 border-gold/40 pl-4" key={change.id}>
                <h3 className="font-semibold">{change.patch.title || change.patch.code}</h3>
                <p className="mt-1 whitespace-pre-wrap text-white/80">{change.summary}</p>
                <ul className="mt-2 space-y-1 text-sm text-white/60">
                  {change.changes.map((item) => (
                    <li key={item.id}>
                      {item.statKey || item.skillKey || item.description || item.type}
                      {item.oldValue !== undefined || item.newValue !== undefined
                        ? `: ${display(item.oldValue)} → ${display(item.newValue)} ${item.unit ?? ""}`
                        : ""}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-3">
            <button className={button} disabled={!page} onClick={() => setPage(page - 1)}>
              Trước
            </button>
            <span className="text-sm">Trang {page + 1}</span>
            <button
              className={button}
              disabled={(page + 1) * 10 >= history.data.totalElements}
              onClick={() => setPage(page + 1)}
            >
              Sau
            </button>
          </div>
        </>
      )}
    </section>
  )
}
export function HeroWiki() {
  const [params, setParams] = useState(() => new URLSearchParams(window.location.search))
  const [search, setSearch] = useState(params.get("q") ?? "")
  useEffect(() => {
    const pop = () => {
      const p = new URLSearchParams(window.location.search)
      setParams(p)
      setSearch(p.get("q") ?? "")
    }
    window.addEventListener("popstate", pop)
    return () => window.removeEventListener("popstate", pop)
  }, [])
  const region = params.get("region") || "VN",
    locale = params.get("locale") || "vi-VN",
    heroId = params.get("hero") || ""
  const rawPage = Number(params.get("page") ?? 0),
    page = Number.isSafeInteger(rawPage) && rawPage >= 0 ? rawPage : 0
  const contextQuery = new URLSearchParams({ region, locale }).toString()
  const href = (values: Record<string, string>) => {
    const p = new URLSearchParams(params)
    for (const [key, value] of Object.entries(values)) {
      if (value) p.set(key, value)
      else p.delete(key)
    }
    return `?${p}`
  }
  function navigate(values: Record<string, string>) {
    window.history.pushState(null, "", href(values))
    setParams(new URLSearchParams(window.location.search))
  }
  const regions = useRemote<{ code: string; displayName: string; available: boolean }[]>("/regions")
  const list = useRemote<Page<HeroSummary>>(
    heroId
      ? null
      : `/heroes?${contextQuery}&page=${page}&size=24&q=${encodeURIComponent(params.get("q") ?? "")}&sort=code,asc${params.get("role") ? `&role=${encodeURIComponent(params.get("role")!)}` : ""}`,
  )
  const detail = useRemote<HeroDetail>(heroId ? `/heroes/${encodeURIComponent(heroId)}?${contextQuery}` : null)
  const data = detail.data
  return (
    <div className="space-y-6 pb-12 text-white">
      <section className={panel}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[.2em] text-gold/70">Học viện Liên Quân</p>
            <h2 className="mt-2 font-heading text-3xl text-gold">{heroId ? "Hồ sơ tướng" : "Danh sách tướng"}</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="grid gap-1 text-xs text-white/60">
              Vùng
              <select className={input} value={region} onChange={(e) => navigate({ region: e.target.value, page: "" })}>
                {!regions.data?.some((r) => r.code === region) && <option value={region}>{region}</option>}
                {regions.data?.map((r) => (
                  <option key={r.code} value={r.code} disabled={!r.available}>
                    {r.displayName}
                    {r.available ? "" : " · Chưa hỗ trợ"}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs text-white/60">
              Ngôn ngữ
              <select className={input} value={locale} onChange={(e) => navigate({ locale: e.target.value, page: "" })}>
                {!["vi-VN", "en-US"].includes(locale) && <option>{locale}</option>}
                <option value="vi-VN">Tiếng Việt</option>
                <option value="en-US">English</option>
              </select>
            </label>
          </div>
        </div>
        {!heroId && (
          <form
            className="mt-5 flex flex-wrap gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              navigate({ q: search.trim(), page: "" })
            }}
          >
            <label className="min-w-40 flex-1">
              <span className="sr-only">Tìm tướng</span>
              <input
                className={input + " w-full"}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                maxLength={120}
                placeholder="Tìm tên hoặc mã tướng…"
              />
            </label>
            <label>
              <span className="sr-only">Vai trò</span>
              <select
                className={input}
                value={params.get("role") ?? ""}
                onChange={(e) => navigate({ role: e.target.value, page: "" })}
              >
                <option value="">Tất cả vai trò</option>
                {Object.entries(ROLE_LABELS).map(([role, label]) => (
                  <option key={role} value={role}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button className={button}>Tìm kiếm</button>
          </form>
        )}
        {heroId && (
          <a className="mt-4 inline-block text-sm text-gold underline" href={href({ hero: "", page: "" })}>
            ← Tất cả tướng
          </a>
        )}
        {Boolean(regions.error) && (
          <p className="mt-3 text-sm text-amber-200">
            Không tải được danh mục vùng.{" "}
            <button className="underline" onClick={regions.retry}>
              Thử lại
            </button>
          </p>
        )}
      </section>
      {(heroId ? detail.loading : list.loading) && (
        <div className={panel} role="status">
          Đang tải dữ liệu tướng…
        </div>
      )}
      {(heroId ? detail.error : list.error) ? (
        <ErrorState error={heroId ? detail.error : list.error} retry={heroId ? detail.retry : list.retry} />
      ) : null}
      {!heroId && list.data && (
        <>
          {list.data.context && <ContextNote context={list.data.context} />}
          {!list.data.items.length ? (
            <div className={panel}>Chưa có tướng phù hợp. Thử đổi bộ lọc hoặc quay lại khi dữ liệu được xuất bản.</div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {list.data.items.map((hero) => (
                <a
                  href={href({ hero: hero.id })}
                  key={hero.id}
                  className="group overflow-hidden rounded-[12px] border border-white/12 bg-[#10131de8] transition-transform hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-gold"
                >
                  <Image asset={hero.head} alt={hero.name} className="aspect-square w-full object-cover" />
                  <div className="p-3">
                    <h3 className="font-heading text-lg text-gold">{hero.name}</h3>
                    <p className="mt-1 text-xs text-white/60">
                      {hero.roles.map((r) => ROLE_LABELS[r] ?? r).join(" · ")}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )}
          <div className="flex items-center justify-center gap-4">
            <button className={button} disabled={!page} onClick={() => navigate({ page: String(page - 1) })}>
              Trước
            </button>
            <span className="text-sm text-white/70">
              Trang {page + 1} · {list.data.totalElements} tướng
            </span>
            <button
              className={button}
              disabled={(page + 1) * 24 >= list.data.totalElements}
              onClick={() => navigate({ page: String(page + 1) })}
            >
              Sau
            </button>
          </div>
        </>
      )}
      {heroId && data && (
        <>
          <article className={panel + " relative overflow-hidden"}>
            {data.media.SPLASH?.currentVersion && (
              <img
                src={data.media.SPLASH.currentVersion.url}
                alt=""
                className="absolute inset-0 size-full object-cover opacity-15"
              />
            )}
            <div className="relative grid items-center gap-6 md:grid-cols-[200px_1fr]">
              <Image
                asset={data.media.PORTRAIT}
                alt={data.content.profile.name}
                className="mx-auto max-h-80 w-48 rounded-[12px] object-contain"
              />
              <div>
                <ContextNote context={data.context} />
                <h1 className="mt-4 font-heading text-4xl text-gold">{data.content.profile.name}</h1>
                {data.content.profile.title && (
                  <p className="mt-2 text-lg text-white/80">{data.content.profile.title}</p>
                )}
                <p className="mt-3 text-sm text-gold/80">
                  {data.content.profile.roles.map((r) => ROLE_LABELS[r] ?? r).join(" · ")}
                </p>
                <p className="mt-4 whitespace-pre-wrap leading-7 text-white/75">{data.content.profile.summary}</p>
              </div>
            </div>
          </article>
          <div className="grid gap-6 lg:grid-cols-2">
            <section className={panel}>
              <h2 className="font-heading text-2xl text-gold">Đánh giá tổng quan</h2>
              <div className="mt-5 space-y-4">
                {(
                  [
                    ["survivability", "Sinh tồn"],
                    ["attackDamage", "Sát thương đánh thường"],
                    ["skillEffects", "Hiệu ứng kỹ năng"],
                    ["difficulty", "Độ khó"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{label}</span>
                      <span>{data.content.overviewRatings[key]}/10</span>
                    </div>
                    <meter
                      className="h-3 w-full accent-amber-300"
                      min={0}
                      max={10}
                      value={data.content.overviewRatings[key]}
                      aria-label={label}
                    />
                  </div>
                ))}
              </div>
            </section>
            <section className={panel}>
              <h2 className="font-heading text-2xl text-gold">Chỉ số chiến đấu</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-white/50">
                    <tr>
                      <th className="py-2">Chỉ số</th>
                      <th>Cơ bản</th>
                      <th>Tăng/cấp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.content.combatStats.values.map((stat) => (
                      <tr key={stat.statKey} className="border-t border-white/10">
                        <th className="py-2 font-normal">{stat.statKey}</th>
                        <td>{stat.baseValue ?? "—"}</td>
                        <td>{stat.growthPerLevel ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
          <section className={panel}>
            <h2 className="font-heading text-2xl text-gold">Kỹ năng</h2>
            <div className="mt-5 space-y-5">
              {[...data.content.skills.skills]
                .sort((a, b) => a.displayOrder - b.displayOrder)
                .map((skill) => (
                  <article
                    key={skill.skillKey}
                    className="flex gap-4 border-b border-white/10 pb-5 last:border-0 last:pb-0"
                  >
                    <Image
                      asset={data.skillMedia?.[skill.skillKey]}
                      alt={skill.name}
                      className="size-14 shrink-0 rounded-[10px] object-cover"
                    />
                    <div>
                      <h3 className="text-lg font-semibold">{skill.name}</h3>
                      <p className="mt-1 text-xs text-gold/70">
                        {skill.kind === "PASSIVE" ? "Nội tại" : "Kỹ năng"}
                        {skill.formKey ? ` · ${skill.formKey}` : ""}
                        {skill.fallbackApplied ? ` · ${skill.actualLocale}` : ""}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap leading-7 text-white/75">{skill.description}</p>
                    </div>
                  </article>
                ))}
            </div>
          </section>
          <section className={panel}>
            <h2 className="font-heading text-2xl text-gold">Trang phục</h2>
            {!data.content.skins.skins.length ? (
              <p className="mt-4 text-white/60">Chưa ghi nhận trang phục.</p>
            ) : (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[...data.content.skins.skins]
                  .sort((a, b) => a.displayOrder - b.displayOrder)
                  .map((skin) => (
                    <article key={skin.skinKey} className="overflow-hidden rounded-[12px] border border-white/10">
                      <Image
                        asset={data.skinMedia?.[skin.skinKey]}
                        alt={skin.name}
                        className="aspect-video w-full object-cover"
                      />
                      <div className="space-y-2 p-4">
                        <h3 className="font-semibold text-gold">{skin.name}</h3>
                        {skin.rarityCode && <p className="text-xs text-white/50">{skin.rarityCode}</p>}
                        <p className="whitespace-pre-wrap text-sm text-white/70">{skin.description}</p>
                        {skin.acquisitionNote && <p className="text-xs text-white/60">{skin.acquisitionNote}</p>}
                      </div>
                    </article>
                  ))}
              </div>
            )}
          </section>
          {data.content.profile.lore && (
            <section className={panel}>
              <h2 className="font-heading text-2xl text-gold">Cốt truyện</h2>
              <p className="mt-4 whitespace-pre-wrap leading-8 text-white/75">{data.content.profile.lore}</p>
            </section>
          )}
          <History key={`${heroId}-${contextQuery}`} heroId={heroId} query={contextQuery} />
        </>
      )}
    </div>
  )
}
