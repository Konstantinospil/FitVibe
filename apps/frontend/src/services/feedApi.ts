import { apiClient } from "./httpApi";

// Feed API
export interface FeedItem {
  id: string;
  feedItemId: string;
  user: {
    id: string;
    username: string;
    displayName?: string;
  };
  session: {
    id: string;
    title?: string;
    notes?: string;
    plannedAt: string;
    completedAt?: string;
    exerciseCount: number;
    totalVolume?: number;
  };
  visibility: string;
  createdAt: string;
  publishedAt: string | null;
  likesCount: number;
  commentsCount: number;
  isLiked?: boolean;
  isBookmarked?: boolean;
}

export interface FeedResponse {
  items: FeedItem[];
  total?: number;
  limit?: number;
  offset?: number;
}

export async function getFeed(
  params: {
    scope?: string;
    limit?: number;
    offset?: number;
    q?: string;
    sort?: "date" | "popularity" | "relevance";
  } = {},
): Promise<FeedResponse> {
  const res = await apiClient.get<{
    items: Array<{
      feedItemId: string;
      ownerId: string;
      ownerUsername: string;
      ownerDisplayName: string;
      visibility: string;
      publishedAt: string | null;
      session: null | {
        id: string;
        title: string | null;
        completedAt: string | null;
        points: number | null;
      };
      stats: {
        likes: number;
        comments: number;
        viewerHasLiked: boolean;
        viewerHasBookmarked: boolean;
      };
    }>;
    total: number;
    limit: number;
    offset: number;
  }>("/api/v1/feed", { params });

  // Transform backend response to frontend format
  return {
    items: res.data.items.map((item) => {
      const sourceTimestamp: string = item.publishedAt ?? item.session?.completedAt ?? "";

      return {
        id: item.feedItemId,
        feedItemId: item.feedItemId,
        user: {
          id: item.ownerId,
          username: item.ownerUsername,
          displayName: item.ownerDisplayName || undefined,
        },
        session: item.session
          ? {
              id: item.session.id,
              title: item.session.title || undefined,
              plannedAt: sourceTimestamp,
              completedAt: item.session.completedAt || undefined,
              exerciseCount: 0, // Not provided by backend, would need to fetch separately
              totalVolume: undefined,
            }
          : {
              id: "",
              plannedAt: sourceTimestamp,
              exerciseCount: 0,
            },
        visibility: item.visibility,
        createdAt: sourceTimestamp,
        publishedAt: item.publishedAt,
        likesCount: item.stats.likes,
        commentsCount: item.stats.comments,
        isLiked: item.stats.viewerHasLiked,
        isBookmarked: item.stats.viewerHasBookmarked,
      };
    }),
    total: res.data.total,
    limit: res.data.limit,
    offset: res.data.offset,
  };
}

export async function likeFeedItem(feedItemId: string): Promise<void> {
  await apiClient.post(`/api/v1/feed/item/${feedItemId}/like`);
}

export async function unlikeFeedItem(feedItemId: string): Promise<void> {
  await apiClient.delete(`/api/v1/feed/item/${feedItemId}/like`);
}

export async function reportFeedItem(
  feedItemId: string,
  payload: { reason: string; details?: string },
): Promise<void> {
  await apiClient.post(`/api/v1/feed/item/${feedItemId}/report`, payload);
}

export async function bookmarkFeedItem(feedItemId: string): Promise<void> {
  await apiClient.post(`/api/v1/feed/item/${feedItemId}/bookmark`);
}

export async function unbookmarkFeedItem(feedItemId: string): Promise<void> {
  await apiClient.delete(`/api/v1/feed/item/${feedItemId}/bookmark`);
}

export async function cloneSessionFromFeed(sessionId: string): Promise<{ sessionId: string }> {
  const res = await apiClient.post<{ sessionId: string }>(
    `/api/v1/feed/session/${sessionId}/clone`,
  );
  return res.data;
}

export async function followUser(userId: string): Promise<void> {
  await apiClient.post(`/api/v1/users/${userId}/follow`);
}

export async function unfollowUser(userId: string): Promise<void> {
  await apiClient.delete(`/api/v1/users/${userId}/follow`);
}

// Feed Comments API
export interface Comment {
  id: string;
  feedItemId: string;
  userId: string;
  content: string;
  body: string;
  displayName: string;
  username: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  comment?: Comment;
}

export async function getFeedItemComments(
  feedItemId: string,
  options?: { limit?: number },
): Promise<{ comments: Comment[] }> {
  const res = await apiClient.get<{ comments: Comment[] }>(`/api/v1/feed/${feedItemId}/comments`, {
    params: options,
  });
  return res.data;
}

export async function addComment(
  feedItemId: string,
  body: { body: string },
): Promise<{ comment: Comment }> {
  const res = await apiClient.post<{ comment: Comment }>(
    `/api/v1/feed/${feedItemId}/comments`,
    body,
  );
  return res.data;
}

export async function deleteComment(commentId: string): Promise<void> {
  await apiClient.delete(`/api/v1/feed/comments/${commentId}`);
}
