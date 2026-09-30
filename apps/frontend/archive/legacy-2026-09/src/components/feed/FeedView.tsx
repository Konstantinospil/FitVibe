import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { FeedSessionCard } from "./FeedSessionCard";
import type { FeedSortOption, FeedScope } from "./FeedFilters";
import { FeedFilters } from "./FeedFilters";
import { CommentSection } from "./CommentSection";
import { getFeed, type FeedItem } from "../../services/api";
import { useToast } from "../ui/Toast";

export interface FeedViewProps {
  initialScope?: FeedScope;
  currentUserId?: string;
  onSessionClick?: (sessionId: string) => void;
  onUserClick?: (userId: string) => void;
  onCloneSuccess?: (newSessionId: string) => void;
  showComments?: boolean;
  itemsPerPage?: number;
}

/**
 * FeedView component displays the main feed with sessions, filters, and interactions.
 * Supports pagination, search, sorting, and social features.
 */
export const FeedView: React.FC<FeedViewProps> = ({
  initialScope = "all",
  currentUserId,
  onSessionClick,
  onUserClick,
  onCloneSuccess,
  showComments = false,
  itemsPerPage = 20,
}) => {
  const { t } = useTranslation("common");
  const { showToast } = useToast();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<FeedSortOption>("date");
  const [scope, setScope] = useState<FeedScope>(initialScope);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());

  const loadFeed = useCallback(
    async (reset = false) => {
      const currentOffset = reset ? 0 : offset;
      const loadingState = reset ? setIsLoading : setIsLoadingMore;

      loadingState(true);
      try {
        const response = await getFeed({
          scope: scope === "all" ? undefined : scope,
          limit: itemsPerPage,
          offset: currentOffset,
          q: searchQuery || undefined,
          sort,
        });

        if (reset) {
          setItems(response.items);
        } else {
          setItems((prev) => [...prev, ...response.items]);
        }

        setHasMore(response.items.length === itemsPerPage);
        setOffset(currentOffset + response.items.length);
      } catch {
        showToast({
          variant: "error",
          title: t("feed.loadError.title"),
          message: t("feed.loadError.message"),
        });
      } finally {
        loadingState(false);
      }
    },
    [offset, searchQuery, sort, scope, itemsPerPage, t, showToast],
  );

  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    void loadFeed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, sort, scope]);

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      void loadFeed(false);
    }
  };

  const handleLikeChange = (feedItemId: string, liked: boolean, count: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.feedItemId === feedItemId ? { ...item, isLiked: liked, likesCount: count } : item,
      ),
    );
  };

  const handleBookmarkChange = (feedItemId: string, bookmarked: boolean) => {
    setItems((prev) =>
      prev.map((item) =>
        item.feedItemId === feedItemId ? { ...item, isBookmarked: bookmarked } : item,
      ),
    );
  };

  const toggleComments = (feedItemId: string) => {
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (next.has(feedItemId)) {
        next.delete(feedItemId);
      } else {
        next.add(feedItemId);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "var(--space-xl)",
        }}
      >
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-lg)",
      }}
    >
      <FeedFilters
        searchQuery={searchQuery}
        sort={sort}
        scope={scope}
        onSearchChange={setSearchQuery}
        onSortChange={setSort}
        onScopeChange={setScope}
        showScopeFilter={true}
      />

      {items.length === 0 ? (
        <div
          style={{
            padding: "var(--space-xl)",
            textAlign: "center",
            color: "var(--color-text-secondary)",
          }}
        >
          <p style={{ margin: 0, fontSize: "var(--font-size-lg)" }}>{t("feed.empty.title")}</p>
          <p style={{ margin: "var(--space-sm) 0 0 0", fontSize: "var(--font-size-sm)" }}>
            {t("feed.empty.message")}
          </p>
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-md)",
            }}
          >
            {items.map((item) => (
              <div key={item.feedItemId}>
                <FeedSessionCard
                  item={item}
                  onLikeChange={(liked, count) => handleLikeChange(item.feedItemId, liked, count)}
                  onBookmarkChange={(bookmarked) =>
                    handleBookmarkChange(item.feedItemId, bookmarked)
                  }
                  onCloneSuccess={onCloneSuccess}
                  onUserClick={onUserClick}
                  onSessionClick={onSessionClick}
                />
                {showComments && expandedComments.has(item.feedItemId) && (
                  <CommentSection feedItemId={item.feedItemId} currentUserId={currentUserId} />
                )}
                {showComments && !expandedComments.has(item.feedItemId) && (
                  <div
                    style={{
                      padding: "var(--space-sm) var(--space-md)",
                      borderTop: "1px solid var(--color-border)",
                    }}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleComments(item.feedItemId)}
                      style={{ width: "100%" }}
                    >
                      {t("feed.comments.view", { count: item.commentsCount })}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {hasMore && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "var(--space-lg)",
              }}
            >
              <Button
                variant="secondary"
                size="md"
                onClick={handleLoadMore}
                isLoading={isLoadingMore}
                leftIcon={<ChevronDown size={18} />}
                disabled={isLoadingMore}
              >
                {t("feed.loadMore")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
