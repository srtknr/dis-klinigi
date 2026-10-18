export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground ${className ?? ""}`}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7.5 3.5c-2.3 0-4 1.9-4 4.6 0 2 .7 3.3 1.3 5 .6 1.8.8 3.6 1.2 5.4.3 1.4 1 2 1.8 2 .9 0 1.4-.8 1.7-2.2l.6-2.9c.2-.9.9-1.4 1.9-1.4s1.7.5 1.9 1.4l.6 2.9c.3 1.4.8 2.2 1.7 2.2.8 0 1.5-.6 1.8-2 .4-1.8.6-3.6 1.2-5.4.6-1.7 1.3-3 1.3-5 0-2.7-1.7-4.6-4-4.6-1.6 0-2.6.8-4.5.8s-2.9-.8-4.5-.8Z" />
      </svg>
    </span>
  );
}
