import { useEffect, useRef, useState } from "react";
import type { NavigateFunction } from "react-router-dom";
import { searchService } from "@shared/api";
import type { SearchGroup } from "@shared/types";

export function useLayoutSearch() {
  const [searchValue, setSearchValue] = useState("");
  const [searchGroups, setSearchGroups] = useState<SearchGroup[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchTimerRef = useRef<number | null>(null);
  const searchRequestIdRef = useRef(0);
  const lastInputRef = useRef("");

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const lower = text.toLowerCase();
    const q = query.toLowerCase();
    const idx = lower.indexOf(q);
    if (idx === -1) return text;
    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + query.length);
    const after = text.slice(idx + query.length);
    return (
      <>
        {before}
        <span style={{ background: "#fff59d", padding: "0 2px" }}>{match}</span>
        {after}
      </>
    );
  };

  useEffect(() => {
    if (searchTimerRef.current) {
      window.clearTimeout(searchTimerRef.current);
    }
    const trimmed = searchValue.trim();
    if (trimmed.length < 2) {
      setSearchQuery("");
      setSearchGroups([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchTimerRef.current = window.setTimeout(() => {
      setSearchQuery(trimmed);
    }, 350);
    return () => {
      if (searchTimerRef.current) {
        window.clearTimeout(searchTimerRef.current);
      }
    };
  }, [searchValue]);

  useEffect(() => {
    if (!searchQuery) return;
    const requestId = ++searchRequestIdRef.current;
    const run = async () => {
      try {
        const data = await searchService.search(searchQuery);
        if (requestId !== searchRequestIdRef.current) return;
        setSearchGroups(data.groups || []);
      } catch (err) {
        if (requestId !== searchRequestIdRef.current) return;
        console.error(err);
        setSearchGroups([]);
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setSearchLoading(false);
        }
      }
    };
    run();
  }, [searchQuery]);

  const onSearchInputChange = (next: string) => {
    if (lastInputRef.current === next) return;
    lastInputRef.current = next;
    setSearchValue(next);
  };

  const onSearchItemSelect = (route: string, navigate: NavigateFunction) => {
    setSearchValue("");
    navigate(route);
  };

  return {
    searchValue,
    searchGroups,
    searchLoading,
    highlightMatch,
    onSearchInputChange,
    onSearchItemSelect,
  };
}

