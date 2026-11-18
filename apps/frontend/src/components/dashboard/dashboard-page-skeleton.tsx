type SkeletonVariant = "overview" | "table" | "analytics" | "editor" | "detail" | "shell";

const block = "animate-pulse motion-reduce:animate-none rounded bg-[#ECEBE5]";

function HeaderSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1 space-y-3">
        <div className={`${block} h-3 w-28`} />
        <div className={`${block} h-9 ${wide ? "w-72" : "w-56"} max-w-full`} />
        <div className={`${block} h-3.5 w-full max-w-[520px] bg-[#F1F0EB]`} />
      </div>
      <div className={`${block} h-10 w-32 rounded-[5px]`} />
    </div>
  );
}

function MetricSkeletons() {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="rounded-[8px] border border-[#ECEBE5] bg-[#FFFEFB] p-4 sm:p-5">
          <div className={`${block} h-3 w-20`} />
          <div className={`${block} mt-4 h-8 w-16 bg-[#E7E5DE]`} />
          <div className={`${block} mt-3 h-2.5 w-28 bg-[#F1F0EB]`} />
        </div>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <section className="overflow-hidden rounded-[8px] border border-[#ECEBE5] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F0EFE9] p-4 sm:p-5">
        <div className="space-y-2">
          <div className={`${block} h-3.5 w-32`} />
          <div className={`${block} h-2.5 w-48 bg-[#F1F0EB]`} />
        </div>
        <div className={`${block} h-9 w-52 max-w-full rounded-[5px] bg-[#F1F0EB]`} />
      </div>
      <div className="space-y-0 divide-y divide-[#F3F2ED]">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 px-4 py-4 sm:px-5">
            <div className={`${block} h-9 w-9 shrink-0 rounded-full bg-[#F0EFE9]`} />
            <div className="min-w-0 flex-1 space-y-2">
              <div className={`${block} h-3 w-40 max-w-[65%]`} />
              <div className={`${block} h-2.5 w-64 max-w-[85%] bg-[#F1F0EB]`} />
            </div>
            <div className={`${block} hidden h-7 w-20 rounded-full bg-[#F1F0EB] sm:block`} />
            <div className={`${block} h-8 w-16 rounded-[5px] bg-[#F1F0EB]`} />
          </div>
        ))}
      </div>
    </section>
  );
}

function AnalyticsSkeleton() {
  return (
    <>
      <MetricSkeletons />
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.8fr)]">
        <div className="rounded-[8px] border border-[#ECEBE5] bg-white p-5">
          <div className={`${block} h-3.5 w-36`} />
          <div className={`${block} mt-2 h-2.5 w-52 bg-[#F1F0EB]`} />
          <div className="mt-8 flex h-56 items-end gap-3 border-b border-[#ECEBE5] px-2">
            {[42, 68, 50, 82, 58, 92, 64, 76, 48, 86, 60, 72].map((height, index) => (
              <div key={index} className={`${block} flex-1 rounded-t-[3px] bg-[#E8E5DD]`} style={{ height: `${height}%` }} />
            ))}
          </div>
        </div>
        <div className="rounded-[8px] border border-[#ECEBE5] bg-white p-5">
          <div className={`${block} h-3.5 w-32`} />
          <div className={`${block} mx-auto mt-7 h-36 w-36 rounded-full bg-[#E8E5DD]`} />
          <div className="mt-6 space-y-3">
            {[0, 1, 2].map((item) => <div key={item} className={`${block} h-3 w-full bg-[#F1F0EB]`} />)}
          </div>
        </div>
      </div>
      <TableSkeleton />
    </>
  );
}

function EditorSkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {[0, 1].map((item) => (
        <section key={item} className="rounded-[8px] border border-[#ECEBE5] bg-white p-5">
          <div className={`${block} h-4 w-36`} />
          <div className={`${block} mt-2 h-3 w-56 bg-[#F1F0EB]`} />
          <div className="mt-6 space-y-5">
            {[0, 1, 2, 3].map((field) => (
              <div key={field}>
                <div className={`${block} h-3 w-24`} />
                <div className={`${block} mt-2 h-10 w-full rounded-[5px] bg-[#F1F0EB]`} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((item) => <div key={item} className="h-24 rounded-[8px] border border-[#ECEBE5] bg-[#FFFEFB] p-4"><div className={`${block} h-3 w-20`} /><div className={`${block} mt-5 h-5 w-28`} /></div>)}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)]">
        <div className="h-80 rounded-[8px] border border-[#ECEBE5] bg-white p-5"><div className={`${block} h-4 w-40`} /><div className="mt-7 space-y-5">{[0,1,2,3,4].map((item)=><div key={item} className="flex gap-3"><div className={`${block} h-8 w-8 rounded-full`} /><div className="flex-1 space-y-2"><div className={`${block} h-3 w-3/4`} /><div className={`${block} h-3 w-1/2 bg-[#F1F0EB]`} /></div></div>)}</div></div>
        <div className="h-56 rounded-[8px] border border-[#ECEBE5] bg-white p-5"><div className={`${block} h-4 w-32`} /><div className={`${block} mt-6 h-10 w-full bg-[#F1F0EB]`} /><div className={`${block} mt-3 h-10 w-full bg-[#F1F0EB]`} /></div>
      </div>
    </>
  );
}

export function DashboardPageSkeleton({ variant = "table", showSidebar = false }: { variant?: SkeletonVariant; showSidebar?: boolean }) {
  const content = (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <HeaderSkeleton wide={variant === "overview" || variant === "analytics"} />
      {variant === "overview" ? (
        <>
          <MetricSkeletons />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.8fr)]">
            <div className="h-72 rounded-[8px] border border-[#ECEBE5] bg-white p-5"><div className={`${block} h-4 w-40`} /><div className={`${block} mt-3 h-3 w-56 bg-[#F1F0EB]`} /><div className={`${block} mt-8 h-40 w-full bg-[#F1F0EB]`} /></div>
            <div className="h-72 rounded-[8px] border border-[#ECEBE5] bg-white p-5"><div className={`${block} h-4 w-32`} /><div className="mt-6 space-y-5">{[0,1,2,3].map((item)=><div key={item} className="flex items-center gap-3"><div className={`${block} h-8 w-8 rounded-full`} /><div className="flex-1 space-y-2"><div className={`${block} h-3 w-2/3`} /><div className={`${block} h-2.5 w-1/2 bg-[#F1F0EB]`} /></div></div>)}</div></div>
          </div>
          <TableSkeleton />
        </>
      ) : variant === "analytics" ? <AnalyticsSkeleton />
        : variant === "editor" ? <EditorSkeleton />
        : variant === "detail" ? <DetailSkeleton />
        : <><MetricSkeletons /><TableSkeleton /></>}
      <span className="sr-only">Loading dashboard content</span>
    </div>
  );

  if (!showSidebar) return content;

  return (
    <div className="min-h-screen bg-[#FBF9F2]" aria-busy="true" aria-live="polite">
      <aside className="fixed inset-y-0 left-0 hidden w-[72px] border-r border-[#E9E8E1] bg-[#F5F4ED] px-3 py-5 md:block lg:w-[208px]">
        <div className="flex items-center gap-2"><div className={`${block} h-8 w-8 rounded-full`} /><div className={`${block} hidden h-4 w-24 lg:block`} /></div>
        <div className="mt-10 space-y-3">{Array.from({ length: 7 }, (_, item) => <div key={item} className="flex items-center gap-3 rounded-[5px] px-2 py-2"><div className={`${block} h-4 w-4 rounded`} /><div className={`${block} hidden h-3 w-24 lg:block`} /></div>)}</div>
        <div className="absolute inset-x-3 bottom-7 flex items-center gap-3"><div className={`${block} h-8 w-8 rounded-full`} /><div className={`${block} hidden h-3 w-24 lg:block`} /></div>
      </aside>
      <main className="min-h-screen pb-8 md:pl-[72px] lg:pl-[208px]">
        <div className="mx-auto w-full max-w-7xl px-4 pb-8 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pt-14">
          <div className="rounded-[12px] border border-[#ECEBE5] bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] sm:p-7 lg:p-8">{content}</div>
        </div>
      </main>
    </div>
  );
}
