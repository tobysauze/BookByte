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
  Menu,
  User as UserIcon,
  FileText,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
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
  { href: "/notes", label: "Notes", icon: FileText, requiresAuth: true },
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
        <div className="flex items-center gap-2 sm:gap-3 text-lg font-semibold flex-shrink-0">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/images/public/logo.png"
              alt="BookByte Logo"
              width={48}
              height={48}
              className="h-10 w-10 sm:h-12 sm:w-12"
            />
            <span className="hidden sm:inline">BookByte</span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-1 text-sm font-medium text-[rgb(var(--muted-foreground))] md:flex flex-1 justify-center max-w-2xl mx-auto">
          {filteredLinks.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 rounded-full px-4 py-2 transition hover:text-[rgb(var(--foreground))] ${isActive
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

          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <>
                <div className="flex items-center gap-2 mr-2">
                  {userRole === "editor" ? (
                    <Badge variant="default" className="h-6 px-2 text-xs">Admin</Badge>
                  ) : (
                    <Badge variant="outline" className="h-6 px-2 text-xs">Standard</Badge>
                  )}
                </div>
                {userRole === "editor" && (
                  <>
                    <Button asChild variant="default" size="sm">
                      <Link href="/create-book">
                        <Plus className="mr-2 h-4 w-4" />
                        <span className="hidden lg:inline">Create Book</span>
                        <span className="lg:hidden">Create</span>
                      </Link>
                    </Button>
                    <Button asChild variant="ghost" size="sm" title="Admin Files">
                      <Link href="/admin/files">
                        <FileText className="h-4 w-4" />
                      </Link>
                    </Button>
                  </>
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
                  <span>Logout</span>
                </Button>
              </>
            ) : (
              <Button asChild size="sm">
                <Link href="/login">
                  <LogIn className="mr-2 h-4 w-4" />
                  <span>Login</span>
                </Link>
              </Button>
            )}
          </div>

          {/* Mobile Menu */}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-6 py-6">
                  {user && (
                    <div className="flex items-center gap-3 pb-6 border-b border-[rgb(var(--border))]">
                      <div className="h-10 w-10 rounded-full bg-[rgb(var(--muted))] flex items-center justify-center">
                        <span className="font-semibold text-lg">{user.email?.[0].toUpperCase()}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm truncate max-w-[200px]">{user.email}</span>
                        <span className="text-xs text-[rgb(var(--muted-foreground))] capitalize">{userRole || "Reader"}</span>
                      </div>
                    </div>
                  )}

                  <nav className="flex flex-col gap-2">
                    {filteredLinks.map((link) => {
                      const isActive = pathname === link.href;
                      const Icon = link.icon;
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isActive
                            ? "bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))]"
                            : "hover:bg-[rgb(var(--muted))]"
                            }`}
                        >
                          {Icon ? <Icon className="h-5 w-5" /> : null}
                          {link.label}
                        </Link>
                      );
                    })}
                  </nav>

                  <div className="mt-auto pt-6 border-t border-[rgb(var(--border))] space-y-3">
                    {user ? (
                      <>
                        <Button asChild variant="outline" className="w-full justify-start" size="sm">
                          <Link href="/profile">
                            <UserIcon className="mr-2 h-4 w-4" />
                            Profile
                          </Link>
                        </Button>
                        {userRole === "editor" && (
                          <>
                            <Button asChild variant="default" className="w-full justify-start" size="sm">
                              <Link href="/create-book">
                                <Plus className="mr-2 h-4 w-4" />
                                Create Book
                              </Link>
                            </Button>
                            <Button asChild variant="ghost" className="w-full justify-start" size="sm">
                              <Link href="/admin/files">
                                <FileText className="mr-2 h-4 w-4" />
                                Admin Files
                              </Link>
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                          size="sm"
                          onClick={async () => {
                            await supabase.auth.signOut();
                          }}
                        >
                          <LogOut className="mr-2 h-4 w-4" />
                          Logout
                        </Button>
                      </>
                    ) : (
                      <Button asChild className="w-full" size="sm">
                        <Link href="/login">
                          <LogIn className="mr-2 h-4 w-4" />
                          Login
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}

