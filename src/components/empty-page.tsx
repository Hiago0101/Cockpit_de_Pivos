type EmptyPageProps = {
  title: string;
};

export function EmptyPage({ title }: EmptyPageProps) {
  return (
    <section className="flex min-h-[calc(100svh-4rem)] flex-col px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
      <div className="mx-auto w-full max-w-[1600px]">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Cockpit de Pivôs</p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">{title}</h1>
      </div>
    </section>
  );
}