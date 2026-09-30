import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Send, Trash2 } from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Avatar } from "../ui/Avatar";
import { Spinner } from "../ui/Spinner";
import { getFeedItemComments, addComment, deleteComment, type Comment } from "../../services/api";
import { useToast } from "../ui/Toast";

export interface CommentSectionProps {
  feedItemId: string;
  currentUserId?: string;
  onCommentAdded?: (comment: Comment) => void;
  onCommentDeleted?: (commentId: string) => void;
  autoLoad?: boolean;
}

/**
 * CommentSection component displays and manages comments for a feed item.
 * Supports adding, viewing, and deleting comments.
 */
export const CommentSection: React.FC<CommentSectionProps> = ({
  feedItemId,
  currentUserId,
  onCommentAdded,
  onCommentDeleted,
  autoLoad = true,
}) => {
  const { t } = useTranslation("common");
  const { showToast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadComments = async () => {
    setIsLoading(true);
    try {
      const response = await getFeedItemComments(feedItemId, { limit: 50 });
      setComments(response.comments.filter((c) => !c.deletedAt));
    } catch {
      showToast({
        variant: "error",
        title: t("feed.comments.loadError.title"),
        message: t("feed.comments.loadError.message"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (autoLoad) {
      void loadComments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedItemId, autoLoad]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newComment.trim() || isSubmitting) {
      return;
    }

    const commentText = newComment.trim();
    setNewComment("");
    setIsSubmitting(true);

    try {
      const response = await addComment(feedItemId, { body: commentText });
      setComments((prev) => [response.comment, ...prev]);
      onCommentAdded?.(response.comment);
    } catch {
      setNewComment(commentText);
      showToast({
        variant: "error",
        title: t("feed.comments.addError.title"),
        message: t("feed.comments.addError.message"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (deletingId) {
      return;
    }

    setDeletingId(commentId);
    try {
      await deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      onCommentDeleted?.(commentId);
      showToast({
        variant: "success",
        title: t("feed.comments.deleted"),
      });
    } catch {
      showToast({
        variant: "error",
        title: t("feed.comments.deleteError.title"),
        message: t("feed.comments.deleteError.message"),
      });
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return t("feed.timestamp.momentsAgo");
    }
    if (diffMins < 60) {
      return t("feed.timestamp.minutesAgo", { count: diffMins });
    }
    if (diffHours < 24) {
      return t("feed.timestamp.hoursAgo", { count: diffHours });
    }
    if (diffDays < 7) {
      return t("feed.timestamp.daysAgo", { count: diffDays });
    }

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    }).format(date);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-md)",
        padding: "var(--space-md)",
        borderTop: "1px solid var(--color-border)",
      }}
    >
      {currentUserId && (
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          style={{ display: "flex", gap: "var(--space-sm)" }}
        >
          <Input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={t("feed.comments.placeholder")}
            maxLength={500}
            disabled={isSubmitting}
            style={{ flex: 1 }}
            aria-label={t("feed.comments.addComment")}
          />
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            leftIcon={<Send size={16} />}
            disabled={!newComment.trim() || isSubmitting}
            aria-label={t("feed.comments.post")}
          >
            {t("feed.comments.post")}
          </Button>
        </form>
      )}

      {isLoading ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "var(--space-lg)",
          }}
        >
          <Spinner size="md" />
        </div>
      ) : comments.length === 0 ? (
        <p
          style={{
            margin: 0,
            fontSize: "var(--font-size-sm)",
            color: "var(--color-text-secondary)",
            textAlign: "center",
            padding: "var(--space-md)",
          }}
        >
          {t("feed.comments.empty")}
        </p>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-md)",
          }}
        >
          {comments.map((comment) => (
            <div
              key={comment.id}
              style={{
                display: "flex",
                gap: "var(--space-sm)",
                alignItems: "flex-start",
              }}
            >
              <Avatar name={comment.displayName || comment.username} size={32} />
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-xs)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "var(--space-sm)",
                  }}
                >
                  <div>
                    <strong
                      style={{
                        fontSize: "var(--font-size-sm)",
                        color: "var(--color-text-primary)",
                      }}
                    >
                      {comment.displayName || comment.username}
                    </strong>
                    <span
                      style={{
                        fontSize: "var(--font-size-xs)",
                        color: "var(--color-text-secondary)",
                        marginLeft: "var(--space-xs)",
                      }}
                    >
                      @{comment.username} • {formatDate(comment.createdAt)}
                    </span>
                  </div>
                  {currentUserId === comment.userId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        void handleDelete(comment.id);
                      }}
                      isLoading={deletingId === comment.id}
                      leftIcon={<Trash2 size={14} />}
                      aria-label={t("feed.comments.delete")}
                      style={{
                        padding: "0.25rem",
                        minWidth: "auto",
                      }}
                    />
                  )}
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "var(--font-size-sm)",
                    color: "var(--color-text-primary)",
                    lineHeight: "var(--line-height-relaxed)",
                  }}
                >
                  {comment.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
