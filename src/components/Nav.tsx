"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Dumbbell,
  LineChart,
  Salad,
  Settings,
  Sparkles,
} from "lucide-react";

const LINKS = [
  { href: "/", label: "Overview", icon: Activity, accent: "var(--color-fg)" },
  { href: "/fitness", label: "Fitness", icon: Dumbbell, accent: "var(--color-fitness)" },
  { href: "/nutrition", label: "Nutrition", icon: Salad, accent: "var(--color-nutrition)" },
  { href: "/finance", label: "Finance", icon: LineChart, accent: "var(--color-finance)" },
  { href: "/coach", label: "Coach", icon: Sparkles, accent: "var(--color-coach)" },
  { href: "/settings", label: "Settings", icon: Settings, accent: "var(--color-fg)" },
];

export function Nav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      aria-label="Sections"
      className="sticky top-0 z-30 shrink-0 border-b border-line bg-surface/85 backdrop-blur-md lg:flex lg:h-screen lg:w-60 lg:flex-col lg:border-r lg:border-b-0"
    >
      <div className="hidden items-baseline gap-2 px-6 pt-7 pb-6 lg:flex">
        <span className="text-md font-semibold tracking-tight text-fg">
          Dashboard
        </span>
      </div>

      <ul className="flex gap-0.5 overflow-x-auto px-3 py-2 lg:flex-col lg:px-3 lg:py-0">
        {LINKS.map(({ href, label, icon: Icon, accent }) => {
          const active = isActive(href);
          return (
            <li key={href} className="shrink-0 lg:shrink">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                style={active ? ({ "--dot": accent } as React.CSSProperties) : undefined}
                className={`group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors duration-150 ${
                  active
                    ? "bg-raised text-fg"
                    : "text-fg-subtle hover:bg-raised/60 hover:text-fg-muted"
                }`}
              >
                <Icon
                  size={15}
                  strokeWidth={2}
                  aria-hidden="true"
                  className={active ? "" : "opacity-80"}
                  style={active ? { color: accent } : undefined}
                />
                <span className="font-medium">{label}</span>
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-1.5 -left-3 hidden w-0.5 rounded-r-full lg:block"
                    style={{ background: accent }}
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="mt-auto hidden px-6 pb-6 text-2xs leading-relaxed text-fg-faint lg:block">
        Local only. Your data stays on this machine.
      </p>
    </nav>
  );
}
