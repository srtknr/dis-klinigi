export function PageIntro({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <div className="border-b bg-cream">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        {eyebrow ? <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">{eyebrow}</p> : null}
        <h1 className="font-display mt-2 text-4xl tracking-tight">{title}</h1>
        {description ? <p className="mt-3 max-w-2xl text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  );
}
