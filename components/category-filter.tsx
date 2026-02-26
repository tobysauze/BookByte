"use client";

import { Fragment, useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type Genre = {
  id: string;
  name: string;
  parent_id: string | null;
};

type GenreTree = Genre & { children: Genre[] };

function buildTree(genres: Genre[]): GenreTree[] {
  const parents = genres
    .filter((g) => !g.parent_id)
    .sort((a, b) => a.name.localeCompare(b.name));
  return parents.map((p) => ({
    ...p,
    children: genres
      .filter((g) => g.parent_id === p.id)
      .sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

export function CategoryFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("category") || "");
  const [, startTransition] = useTransition();
  const [genres, setGenres] = useState<Genre[]>([]);

  useEffect(() => {
    fetch("/api/genres")
      .then((r) => r.json())
      .then((data) => setGenres(data.genres || []))
      .catch(() => {});
  }, []);

  const tree = buildTree(genres);

  const handleValueChange = (newValue: string) => {
    setValue(newValue);
    startTransition(() => {
      const params = new URLSearchParams(window.location.search);
      if (newValue && newValue !== "all") {
        params.set("category", newValue);
      } else {
        params.delete("category");
      }
      router.push(`${window.location.pathname}?${params.toString()}`);
    });
  };

  const clearFilter = () => {
    setValue("");
    startTransition(() => {
      const params = new URLSearchParams(window.location.search);
      params.delete("category");
      router.push(`${window.location.pathname}?${params.toString()}`);
    });
  };

  useEffect(() => {
    setValue(searchParams.get("category") || "");
  }, [searchParams]);

  return (
    <div className="flex items-center gap-2">
      <Select value={value} onValueChange={handleValueChange}>
        <SelectTrigger className="w-[200px] h-10 bg-white">
          <SelectValue placeholder="All Genres" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Genres</SelectItem>
          {tree.map((parent) => (
            <Fragment key={parent.id}>
              <SelectItem value={parent.name} className="font-medium">
                {parent.name}
              </SelectItem>
              {parent.children.map((child) => (
                <SelectItem key={child.id} value={child.name} className="pl-6">
                  <span className="text-[rgb(var(--muted-foreground))] mr-1">
                    ↳
                  </span>
                  {child.name}
                </SelectItem>
              ))}
            </Fragment>
          ))}
        </SelectContent>
      </Select>

      {value && value !== "all" && (
        <Button
          variant="ghost"
          size="icon"
          onClick={clearFilter}
          className="h-9 w-9 text-gray-500 hover:text-gray-900"
          title="Clear filter"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
