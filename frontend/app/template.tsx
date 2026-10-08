// template.tsx remounts on every route change (unlike layout), so the
// fade replays on each page transition. Disabled under reduced-motion.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
