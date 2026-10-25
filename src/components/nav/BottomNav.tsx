"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Today", icon: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10" },
  {
    href: "/calendar",
    label: "Calendar",
    icon: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  },
  {
    href: "/progress",
    label: "Progress",
    icon: "M4 19h16M7 15l4-5 3 3 5-7",
  },
  {
    href: "/programs",
    label: "Program",
    icon: "M6 4h12v16H6zM9 8h6M9 12h6M9 16h3",
  },
  {
    href: "/settings",
    label: "Settings",
    icon: "M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M13 4v4M7 10v4M15 16v4",
  },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <NavBar
      isActive={(href) =>
        href === "/" ? pathname === "/" : pathname.startsWith(href)
      }
    />
  );
}

/** Same bar without an active tab, while the path is unknown. */
export function NavBar({
  isActive = () => false,
}: {
  isActive?: (href: string) => boolean;
}) {
  return (
    <nav className="border-border bg-surface/95 fixed inset-x-0 bottom-0 z-10 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {items.map(({ href, label, icon }) => {
          const active = isActive(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium ${active ? "text-accent" : "text-muted"}`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d={icon} />
                </svg>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
