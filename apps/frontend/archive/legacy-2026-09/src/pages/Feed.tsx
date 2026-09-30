import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import PageIntro from "../components/PageIntro";
import { Button, VisibilityBadge, Skeleton } from "../components/ui";
import { getFeed, likeFeedItem, unlikeFeedItem, cloneSessionFromFeed } from "../services/api";
import type { VisibilityLevel } from "../components/ui";
import { useToast } from "../contexts/ToastContext";
import { Search, Filter } from "lucide-react";
import { InputControl, SelectControl } from "@fitvibe/ui";

const Feed: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [sort, setSort] = useState<"date" | "popularity" | "relevance">("date");

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["feed", { scope: "public", limit, offset, q: debouncedSearchQuery, sort }],
    queryFn: () =>
      getFeed({
        scope: "public",
        limit,
        offset,
        q: debouncedSearchQuery || undefined,
        sort,
      }),
    // Reset to first page when search or sort changes
    enabled: true,
  });

  const likeMutation = useMutation({
    mutationFn: likeFeedItem,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  const unlikeMutation = useMutation({
    mutationFn: unlikeFeedItem,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  const cloneMutation = useMutation({
    mutationFn: cloneSessionFromFeed,
    onSuccess: () => {
      toast.success(t("feed.cloneSuccess") || "Session cloned successfully!");
    },
  });

  const handleLikeToggle = (feedItemId: string, isLiked: boolean) => {
    if (isLiked) {
      unlikeMutation.mutate(feedItemId);
    } else {
      likeMutation.mutate(feedItemId);
    }
  };

  const handleClone = (sessionId: string) => {
    cloneMutation.mutate(sessionId);
  };

  if (isLoading) {
    return (
      <PageIntro
        eyebrow={t("feed.eyebrow")}
        title={t("feed.title")}
        description={t("feed.description")}
      >
        <div className="grid grid--gap-md">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card card--compact">
              <Skeleton width="100%" height="60px" />
              <Skeleton width="100%" height="40px" />
              <Skeleton width="100%" height="30px" />
            </div>
          ))}
        </div>
      </PageIntro>
    );
  }

  if (error) {
    return (
      <PageIntro
        eyebrow={t("feed.eyebrow")}
        title={t("feed.title")}
        description={t("feed.description")}
      >
        <div className="empty-state card">
          <p className="text-secondary">
            {t("feed.error") || "Failed to load feed. Please try again later."}
          </p>
        </div>
      </PageIntro>
    );
  }

  const items = data?.items || [];

  if (items.length === 0) {
    return (
      <PageIntro
        eyebrow={t("feed.eyebrow")}
        title={t("feed.title")}
        description={t("feed.description")}
      >
        <div className="empty-state card">
          <p className="text-muted">
            {t("feed.empty") || "No activity yet. Start training and share your sessions!"}
          </p>
        </div>
      </PageIntro>
    );
  }

  return (
    <PageIntro
      eyebrow={t("feed.eyebrow")}
      title={t("feed.title")}
      description={t("feed.description")}
    >
      <div className="flex flex--column flex--gap-md mb-md">
        <div className="flex flex--align-center flex--gap-md flex--wrap">
          <div className="flex flex--align-center flex--gap-sm" style={{ flex: "1 1 300px" }}>
            <Search size={20} className="text-muted" />
            <InputControl
              type="search"
              placeholder={t("feed.searchPlaceholder") || "Search sessions, exercises, users..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input"
              style={{ flex: "1" }}
              aria-label={t("feed.searchLabel") || "Search feed"}
            />
          </div>
          <div className="flex flex--align-center flex--gap-sm">
            <Filter size={20} className="text-muted" />
            <SelectControl
              value={sort}
              onChange={(e) => setSort(e.target.value as "date" | "popularity" | "relevance")}
              className="select"
              aria-label={t("feed.sortLabel") || "Sort feed"}
            >
              <option value="date">{t("feed.sortDate") || "Date"}</option>
              <option value="popularity">{t("feed.sortPopularity") || "Popularity"}</option>
              <option value="relevance">{t("feed.sortRelevance") || "Relevance"}</option>
            </SelectControl>
          </div>
        </div>
      </div>
      <div className="grid grid--gap-md">
        {items.map((item) => {
          const isRestricted = item.visibility === "private";
          const displayName = item.user.displayName || item.user.username;

          return (
            <article key={item.feedItemId || item.id} className="card card--compact">
              <header className="flex flex--justify-between flex--align-center flex--gap-md">
                <div className="grid" style={{ gap: "0.25rem" }}>
                  <strong className="text-105">{displayName}</strong>
                  <span className="text-085 text-muted">
                    {item.publishedAt
                      ? new Date(item.publishedAt).toLocaleDateString()
                      : new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <VisibilityBadge level={item.visibility as VisibilityLevel} />
              </header>
              <div>
                {item.session?.title ? (
                  <strong className="block mb-05">{item.session.title}</strong>
                ) : item.session?.notes ? (
                  <strong className="block mb-05">{item.session.notes}</strong>
                ) : null}
                {item.session &&
                  (typeof item.session.totalVolume === "number" &&
                  !isNaN(item.session.totalVolume) ? (
                    <span className="text-09 text-secondary block mt-05">
                      {t("feed.totalVolume", {
                        volume: (item.session.totalVolume / 1000).toFixed(1),
                        defaultValue: `${(item.session.totalVolume / 1000).toFixed(1)}k kg`,
                      })}
                    </span>
                  ) : (
                    <span className="text-09 text-muted block mt-05" data-testid="no-volume-data">
                      {t("feed.noVolumeData", { defaultValue: "No volume data" })}
                    </span>
                  ))}
              </div>
              <footer className="flex flex--justify-between flex--align-center flex--wrap flex--gap-075 text-09 text-secondary">
                <span>
                  {item.likesCount} {t("feed.likes") || "likes"} • {item.commentsCount}{" "}
                  {t("feed.comments") || "comments"}
                </span>
                <div className="flex flex--align-center flex--gap-06">
                  <Button
                    type="button"
                    size="sm"
                    variant={item.isLiked ? "primary" : "ghost"}
                    onClick={() =>
                      handleLikeToggle(item.feedItemId || item.id, Boolean(item.isLiked))
                    }
                    disabled={likeMutation.isPending || unlikeMutation.isPending}
                    aria-label={
                      item.isLiked ? t("feed.unlike") || "Unlike" : t("feed.like") || "Like"
                    }
                  >
                    {item.isLiked ? "♥" : "♡"} {item.likesCount}
                  </Button>
                  {item.session?.id && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={isRestricted || cloneMutation.isPending}
                      onClick={() => handleClone(item.session.id)}
                    >
                      {t("feed.clone") || "Clone"}
                    </Button>
                  )}
                </div>
              </footer>
            </article>
          );
        })}
      </div>

      {/* Pagination */}
      {items.length >= limit && (
        <div className="flex flex--align-center flex--justify-center flex--gap-md mt-md">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            aria-label={t("feed.previousPage") || "Previous page"}
          >
            {t("feed.previous") || "Previous"}
          </Button>
          <span className="text-secondary">
            {t("feed.pageInfo", {
              from: offset + 1,
              to: offset + items.length,
              defaultValue: `Showing ${offset + 1}-${offset + items.length}`,
            })}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setOffset(offset + limit)}
            disabled={items.length < limit}
            aria-label={t("feed.nextPage") || "Next page"}
          >
            {t("feed.next") || "Next"}
          </Button>
        </div>
      )}
    </PageIntro>
  );
};

export default Feed;
