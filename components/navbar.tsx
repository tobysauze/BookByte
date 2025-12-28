"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  Compass,
  Library,
  LogIn,
  LogOut,
  Heart,
  CheckCircle,
  Highlighter,
  Plus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import Image from "next/image";

type UserRole = "editor" | "regular" | null;

type NavbarLink = {
  href: string;
  label: string;
  icon?: LucideIcon;
  requiresAuth?: boolean;
};

const navLinks: NavbarLink[] = [
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/library", label: "My Library", icon: Library, requiresAuth: true },
  { href: "/read", label: "Read", icon: CheckCircle, requiresAuth: true },
  { href: "/favorites", label: "Favorites", icon: Heart, requiresAuth: true },
  { href: "/highlights", label: "Highlights", icon: Highlighter, requiresAuth: true },
];

type NavbarProps = {
  initialUser: User | null;
};

export function Navbar({ initialUser }: NavbarProps) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(initialUser);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  // Fetch user role when user changes
  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) {
        setUserRole(null);
        return;
      }

      try {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("is_editor")
          .eq("id", user.id)
          .single();
        
        setUserRole(profile?.is_editor ? "editor" : "regular");
      } catch (error) {
        console.error("Error fetching user role:", error);
        setUserRole("regular"); // Default to regular user
      }
    };

    fetchUserRole();
  }, [user, supabase]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);

      try {
        await fetch("/api/auth/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event, session }),
        });
      } catch (error) {
        console.error("Failed to sync auth session", error);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const filteredLinks = navLinks.filter((link) =>
    link.requiresAuth ? Boolean(user) : true,
  );

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[rgb(var(--border))] bg-[rgb(var(--background))]/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 sm:gap-4 lg:gap-6 px-4 py-4 sm:px-6 lg:px-10">
        <Link 
          href="/" 
          className="flex items-center gap-2 sm:gap-3 text-lg font-semibold flex-shrink-0"
        >
          <Image
            src="/images/public/logo.png"
            alt="BookByte Logo"
            width={48}
            height={48}
            className="h-10 w-10 sm:h-12 sm:w-12"
          />
          <span className="hidden sm:inline">BookByte</span>
        </Link>

        <nav className="hidden items-center gap-1 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-1 text-sm font-medium text-[rgb(var(--muted-foreground))] md:flex flex-1 justify-center max-w-2xl mx-auto">
          {filteredLinks.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 rounded-full px-4 py-2 transition hover:text-[rgb(var(--foreground))] ${
                  isActive
                    ? "bg-[rgb(var(--background))] text-[rgb(var(--foreground))] shadow-sm"
                    : ""
                }`}
              >
                {Icon ? <Icon className="h-4 w-4" /> : null}
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 flex-shrink-0 ml-auto min-w-0 overflow-hidden">
          <ThemeToggle />
          {user ? (
            <>
              {userRole === "editor" && (
                <Button asChild variant="default" size="sm" className="hidden md:flex">
                  <Link href="/create-book">
                    <Plus className="mr-2 h-4 w-4" />
                    <span className="hidden lg:inline">Create Book</span>
                    <span className="lg:hidden">Create</span>
                  </Link>
                </Button>
              )}
              <Link
                href={`/profile`}
                className="hidden text-sm text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] lg:block truncate max-w-[120px]"
              >
                {user.email}
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await supabase.auth.signOut();
                }}
                className="flex"
              >
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden md:inline">Logout</span>
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link href="/login">
                <LogIn className="mr-2 h-4 w-4" />
                <span className="hidden md:inline">Login</span>
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

