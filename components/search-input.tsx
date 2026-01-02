"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/lib/hooks";

export function SearchInput({ placeholder = "Search books..." }: { placeholder?: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [value, setValue] = useState(searchParams.get("query") || "");
    const debouncedValue = useDebounce(value, 300);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (debouncedValue) {
            params.set("query", debouncedValue);
        } else {
            params.delete("query");
        }

        startTransition(() => {
            router.push(`${window.location.pathname}?${params.toString()}`);
        });
    }, [debouncedValue, router]);

    return (
        <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--muted-foreground))]" />
            <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="pl-9 pr-9 bg-[rgb(var(--muted))]/50 border-0 focus-visible:bg-[rgb(var(--background))] focus-visible:ring-1"
                placeholder={placeholder}
            />
            {value && (
                <button
                    onClick={() => setValue("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]"
                >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Clear search</span>
                </button>
            )}
        </div>
    );
}
