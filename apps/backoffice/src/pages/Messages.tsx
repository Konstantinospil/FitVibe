import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, InputControl, TextareaControl } from "@fitvibe/ui";
import { messagesApi, type ContactMessage } from "../services/api";
import { useAuthStore } from "../store/auth.store";
import { useThemeColors } from "../hooks/useThemeColors";

const MessagesPage: React.FC = () => {
  const colors = useThemeColors();
  const [page, setPage] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [openOnly, setOpenOnly] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [showResponseInput, setShowResponseInput] = useState(false);
  const [responseText, setResponseText] = useState("");
  const limit = 50;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const { data, isLoading, error } = useQuery({
    queryKey: ["messages", page, unreadOnly, openOnly],
    queryFn: () =>
      messagesApi.list({
        limit,
        offset: page * limit,
        unreadOnly,
        openOnly,
      }),
    enabled: isAuthenticated, // Only run query when authenticated
  });

  const queryClient = useQueryClient();

  const markReadMutation = useMutation({
    mutationFn: (messageId: string) => messagesApi.markRead(messageId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });

  const handleMarkRead = (messageId: string) => {
    markReadMutation.mutate(messageId);
  };

  const handleViewMessage = (message: ContactMessage) => {
    setSelectedMessage(message);
    // Mark as read when viewing
    if (!message.readAt) {
      handleMarkRead(message.id);
    }
  };

  const handleCloseModal = () => {
    setSelectedMessage(null);
    setShowResponseInput(false);
    setResponseText("");
  };

  const markRespondedMutation = useMutation({
    mutationFn: (messageId: string) => messagesApi.markResponded(messageId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });

  const saveResponseMutation = useMutation({
    mutationFn: ({ messageId, response }: { messageId: string; response: string }) =>
      messagesApi.saveResponse(messageId, response),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });

  const handleReply = (
    email: string,
    topic?: string,
    message?: string,
    savedResponse?: string | null,
  ) => {
    // Construct mailto link with subject and body
    const subject = topic ? `Re: ${topic}` : "Re: Contact Form Message";
    let body = "";

    // Include saved response if it exists, otherwise include original message context
    if (savedResponse) {
      body = encodeURIComponent(savedResponse);
    } else if (message) {
      const bodyText = `--- Original Message ---\n\nFrom: ${email}\nTopic: ${topic || "N/A"}\n\n${message}`;
      body = encodeURIComponent(bodyText);
    }

    const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(subject)}${body ? `&body=${body}` : ""}`;

    // Open default email client with pre-filled recipient, subject, and body
    window.location.href = mailtoLink;
  };

  const handleMarkResponded = (messageId: string) => {
    markRespondedMutation.mutate(messageId);
  };

  const handleSaveResponse = (messageId: string, andSendEmail = false) => {
    if (!responseText.trim()) {
      return;
    }
    const responseToSave = responseText;
    saveResponseMutation.mutate(
      { messageId, response: responseToSave },
      {
        onSuccess: () => {
          // If andSendEmail is true, open mailto after saving with the response text
          if (andSendEmail && selectedMessage) {
            // Use setTimeout to ensure state is updated
            setTimeout(() => {
              handleReply(
                selectedMessage.email,
                selectedMessage.topic,
                selectedMessage.message,
                responseToSave,
              );
              setShowResponseInput(false);
              setResponseText("");
            }, 100);
          } else {
            setShowResponseInput(false);
            setResponseText("");
          }
          // Refresh the query to get updated message with response
          void queryClient.invalidateQueries({ queryKey: ["messages"] });
        },
      },
    );
  };

  const handleShowResponseInput = () => {
    // Don't allow editing if response already exists (read-only)
    if (selectedMessage?.response) {
      return; // Response is read-only once saved
    }
    setShowResponseInput(true);
    setResponseText("");
  };

  return (
    <div>
      <h1
        style={{
          color: colors.text,
          marginBottom: "2rem",
          fontSize: "var(--type-page-title-size)",
        }}
      >
        User Messages
      </h1>

      <div style={{ marginBottom: "2rem", display: "flex", gap: "2rem", flexWrap: "wrap" }}>
        <label style={{ color: colors.text, display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <InputControl
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => {
              setUnreadOnly(e.target.checked);
              setPage(0);
            }}
            style={{ cursor: "pointer" }}
          />
          Show unread only
        </label>
        <label style={{ color: colors.text, display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <InputControl
            type="checkbox"
            checked={openOnly}
            onChange={(e) => {
              setOpenOnly(e.target.checked);
              setPage(0);
            }}
            style={{ cursor: "pointer" }}
          />
          Show open only
        </label>
      </div>

      {isLoading ? (
        <div style={{ color: colors.text }}>Loading...</div>
      ) : error ? (
        <div style={{ color: "var(--vibe-explosivity)", padding: "2rem" }}>
          Error loading messages: {error instanceof Error ? error.message : String(error)}
        </div>
      ) : !data || !data.messages || data.messages.length === 0 ? (
        <div style={{ color: colors.text, textAlign: "center", padding: "2rem" }}>
          No messages found
          {unreadOnly ? " (unread only)" : ""}
          {openOnly ? " (open only)" : ""}
        </div>
      ) : (
        <>
          <div
            style={{
              background: colors.surface,
              borderRadius: "var(--radius-sm)",
              overflowX: "auto",
              overflowY: "visible",
              border: `1px solid ${colors.border}`,
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1200px" }}>
              <thead>
                <tr
                  style={{
                    background: "var(--color-surface-muted)",
                  }}
                >
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      color: colors.text,
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    Email
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      color: colors.text,
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    Topic
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      color: colors.text,
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    Message
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      color: colors.text,
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    Received
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      color: colors.text,
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    Responded
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      color: colors.text,
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    Status
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      color: colors.text,
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.messages.map((message) => (
                  <tr
                    key={message.id}
                    style={{
                      borderBottom: `1px solid ${colors.border}`,
                      background: !message.readAt
                        ? "color-mix(in srgb, var(--vibe-strength) var(--transparency-disabled), transparent)"
                        : "transparent",
                    }}
                  >
                    <td style={{ padding: "1rem", color: colors.text }}>{message.email}</td>
                    <td style={{ padding: "1rem", color: colors.text }}>{message.topic}</td>
                    <td style={{ padding: "1rem", color: colors.text, maxWidth: "400px" }}>
                      <Button
                        onClick={() => handleViewMessage(message)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: colors.text,
                          cursor: "pointer",
                          textAlign: "left",
                          width: "100%",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          textDecoration: "underline",
                        }}
                        title="Click to view full message"
                      >
                        {message.message}
                      </Button>
                    </td>
                    <td style={{ padding: "1rem", color: colors.text }}>
                      {new Date(message.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: "1rem", color: colors.text }}>
                      {message.respondedAt ? (
                        new Date(message.respondedAt).toLocaleString()
                      ) : (
                        <span style={{ color: "var(--color-text-muted)" }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: "1rem", color: colors.text }}>
                      {message.readAt ? (
                        <span style={{ color: "var(--color-text-muted)" }}>Read</span>
                      ) : (
                        <span style={{ color: "var(--vibe-strength)" }}>Unread</span>
                      )}
                    </td>
                    <td style={{ padding: "1rem" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: "0.5rem",
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <Button
                          onClick={() => handleViewMessage(message)}
                          style={{
                            padding: "0.5rem 1rem",
                            background: colors.border,
                            color: colors.text,
                            border: "none",
                            borderRadius: "var(--radius-sm)",
                            cursor: "pointer",
                            fontSize: "var(--type-supporting-size)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          View
                        </Button>
                        {!message.respondedAt && (
                          <>
                            <Button
                              onClick={() =>
                                handleReply(
                                  message.email,
                                  message.topic,
                                  message.message,
                                  message.response,
                                )
                              }
                              style={{
                                padding: "0.5rem 1rem",
                                background: colors.border,
                                color: colors.text,
                                border: "none",
                                borderRadius: "var(--radius-sm)",
                                cursor: "pointer",
                                fontSize: "var(--type-supporting-size)",
                                whiteSpace: "nowrap",
                              }}
                            >
                              Reply
                            </Button>
                            <Button
                              onClick={() => handleMarkResponded(message.id)}
                              disabled={markRespondedMutation.isPending}
                              style={{
                                padding: "0.5rem 1rem",
                                background: "var(--vibe-regeneration)",
                                color: colors.text,
                                border: "none",
                                borderRadius: "var(--radius-sm)",
                                cursor: "pointer",
                                fontSize: "var(--type-supporting-size)",
                                whiteSpace: "nowrap",
                              }}
                              title="Mark as responded after sending reply"
                            >
                              Mark Responded
                            </Button>
                          </>
                        )}
                        {!message.readAt && (
                          <Button
                            onClick={() => handleMarkRead(message.id)}
                            disabled={markReadMutation.isPending}
                            style={{
                              padding: "0.5rem 1rem",
                              background: "var(--vibe-strength)",
                              color: colors.text,
                              border: "none",
                              borderRadius: "var(--radius-sm)",
                              cursor: "pointer",
                              fontSize: "var(--type-supporting-size)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Mark Read
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.messages.length >= limit && (
            <div style={{ marginTop: "2rem", display: "flex", gap: "1rem", alignItems: "center" }}>
              <Button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                style={{
                  padding: "0.75rem 1.5rem",
                  background: page === 0 ? colors.border : colors.accent,
                  color: colors.text,
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  cursor: page === 0 ? "not-allowed" : "pointer",
                }}
              >
                Previous
              </Button>
              <span style={{ color: colors.text }}>Page {page + 1}</span>
              <Button
                onClick={() => setPage((p) => p + 1)}
                disabled={data.messages.length < limit}
                style={{
                  padding: "0.75rem 1.5rem",
                  background: data.messages.length < limit ? colors.border : colors.accent,
                  color: colors.text,
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  cursor: data.messages.length < limit ? "not-allowed" : "pointer",
                }}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Message Detail Modal */}
      {selectedMessage && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "var(--modal-backdrop)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "2rem",
          }}
          onClick={handleCloseModal}
        >
          <div
            style={{
              background: colors.surface,
              borderRadius: "var(--radius-sm)",
              border: `1px solid ${colors.border}`,
              maxWidth: "800px",
              width: "100%",
              maxHeight: "90vh",
              overflow: "auto",
              padding: "2rem",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "1.5rem",
              }}
            >
              <h2
                style={{
                  color: colors.text,
                  fontSize: "var(--type-section-title-size)",
                  margin: 0,
                }}
              >
                Message Details
              </h2>
              <Button
                onClick={handleCloseModal}
                style={{
                  background: "transparent",
                  border: "none",
                  color: colors.text,
                  fontSize: "var(--type-section-title-size)",
                  cursor: "pointer",
                  padding: "0.25rem 0.5rem",
                }}
              >
                ×
              </Button>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <div
                style={{
                  color: "var(--color-text-muted)",
                  fontSize: "var(--type-supporting-size)",
                  marginBottom: "0.25rem",
                }}
              >
                From:
              </div>
              <div
                style={{
                  color: colors.text,
                  fontSize: "var(--type-body-size)",
                  marginBottom: "1rem",
                }}
              >
                {selectedMessage.email}
              </div>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <div
                style={{
                  color: "var(--color-text-muted)",
                  fontSize: "var(--type-supporting-size)",
                  marginBottom: "0.25rem",
                }}
              >
                Topic:
              </div>
              <div
                style={{
                  color: colors.text,
                  fontSize: "var(--type-body-size)",
                  marginBottom: "1rem",
                }}
              >
                {selectedMessage.topic}
              </div>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <div
                style={{
                  color: "var(--color-text-muted)",
                  fontSize: "var(--type-supporting-size)",
                  marginBottom: "0.25rem",
                }}
              >
                Date:
              </div>
              <div
                style={{
                  color: colors.text,
                  fontSize: "var(--type-body-size)",
                  marginBottom: "1rem",
                }}
              >
                {new Date(selectedMessage.createdAt).toLocaleString()}
              </div>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <div
                style={{
                  color: "var(--color-text-muted)",
                  fontSize: "var(--type-supporting-size)",
                  marginBottom: "0.25rem",
                }}
              >
                Status:
              </div>
              <div style={{ marginBottom: "1rem" }}>
                {selectedMessage.readAt ? (
                  <span style={{ color: "var(--color-text-muted)" }}>Read</span>
                ) : (
                  <span style={{ color: "var(--vibe-strength)" }}>Unread</span>
                )}
              </div>
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <div
                style={{
                  color: "var(--color-text-muted)",
                  fontSize: "var(--type-supporting-size)",
                  marginBottom: "0.5rem",
                }}
              >
                Message:
              </div>
              <div
                style={{
                  color: colors.text,
                  fontSize: "var(--type-body-size)",
                  lineHeight: "var(--type-body-line-height)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  background: "var(--color-input-bg)",
                  padding: "1rem",
                  borderRadius: "var(--radius-sm)",
                  border: `1px solid ${colors.border}`,
                  minHeight: "200px",
                  maxHeight: "400px",
                  overflow: "auto",
                }}
              >
                {selectedMessage.message}
              </div>
            </div>

            {selectedMessage.response && (
              <div style={{ marginBottom: "1.5rem" }}>
                <div
                  style={{
                    color: "var(--color-text-muted)",
                    fontSize: "var(--type-supporting-size)",
                    marginBottom: "0.5rem",
                  }}
                >
                  Recorded Response (read-only):
                </div>
                <div
                  style={{
                    color: colors.text,
                    fontSize: "var(--type-body-size)",
                    lineHeight: "var(--type-body-line-height)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    background: "var(--color-surface-muted)",
                    padding: "1rem",
                    borderRadius: "var(--radius-sm)",
                    border: `1px solid ${colors.border}`,
                    minHeight: "100px",
                    maxHeight: "300px",
                    overflow: "auto",
                  }}
                >
                  {selectedMessage.response}
                </div>
              </div>
            )}

            {showResponseInput && (
              <div style={{ marginBottom: "1.5rem" }}>
                <div
                  style={{
                    color: "var(--color-text-muted)",
                    fontSize: "var(--type-supporting-size)",
                    marginBottom: "0.5rem",
                  }}
                >
                  Add Response:
                </div>
                <TextareaControl
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="Enter your response to this message..."
                  rows={8}
                  style={{
                    width: "100%",
                    padding: "1rem",
                    background: "var(--color-surface-muted)",
                    border: `1px solid ${colors.border}`,
                    borderRadius: "var(--radius-sm)",
                    color: colors.text,
                    fontSize: "var(--type-body-size)",
                    fontFamily: "var(--font-family-body)",
                    resize: "vertical",
                  }}
                />
                <div style={{ display: "flex", gap: "1rem", marginTop: "1rem", flexWrap: "wrap" }}>
                  <Button
                    onClick={() => handleSaveResponse(selectedMessage.id, true)}
                    disabled={!responseText.trim() || saveResponseMutation.isPending}
                    style={{
                      padding: "0.75rem 1.5rem",
                      background:
                        responseText.trim() && !saveResponseMutation.isPending
                          ? colors.accent
                          : colors.border,
                      color: colors.text,
                      border: "none",
                      borderRadius: "var(--radius-sm)",
                      cursor:
                        responseText.trim() && !saveResponseMutation.isPending
                          ? "pointer"
                          : "not-allowed",
                      fontSize: "var(--type-body-size)",
                    }}
                  >
                    {saveResponseMutation.isPending ? "Saving..." : "Save & Send Email"}
                  </Button>
                  <Button
                    onClick={() => handleSaveResponse(selectedMessage.id, false)}
                    disabled={!responseText.trim() || saveResponseMutation.isPending}
                    style={{
                      padding: "0.75rem 1.5rem",
                      background:
                        responseText.trim() && !saveResponseMutation.isPending
                          ? colors.border
                          : "var(--color-secondary-active)",
                      color: colors.text,
                      border: "none",
                      borderRadius: "var(--radius-sm)",
                      cursor:
                        responseText.trim() && !saveResponseMutation.isPending
                          ? "pointer"
                          : "not-allowed",
                      fontSize: "var(--type-body-size)",
                    }}
                  >
                    {saveResponseMutation.isPending ? "Saving..." : "Save Only"}
                  </Button>
                  <Button
                    onClick={() => {
                      setShowResponseInput(false);
                      setResponseText("");
                    }}
                    style={{
                      padding: "0.75rem 1.5rem",
                      background: "transparent",
                      color: colors.text,
                      border: `1px solid ${colors.border}`,
                      borderRadius: "var(--radius-sm)",
                      cursor: "pointer",
                      fontSize: "var(--type-body-size)",
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <div
              style={{ display: "flex", gap: "1rem", justifyContent: "flex-end", flexWrap: "wrap" }}
            >
              {!selectedMessage.respondedAt && (
                <>
                  <Button
                    onClick={() =>
                      handleReply(
                        selectedMessage.email,
                        selectedMessage.topic,
                        selectedMessage.message,
                        selectedMessage.response,
                      )
                    }
                    style={{
                      padding: "0.75rem 1.5rem",
                      background: colors.border,
                      color: colors.text,
                      border: "none",
                      borderRadius: "var(--radius-sm)",
                      cursor: "pointer",
                      fontSize: "var(--type-body-size)",
                    }}
                  >
                    Reply via Email
                  </Button>
                </>
              )}
              {!selectedMessage.response && !showResponseInput && (
                <Button
                  onClick={handleShowResponseInput}
                  style={{
                    padding: "0.75rem 1.5rem",
                    background: colors.border,
                    color: colors.text,
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    fontSize: "var(--type-body-size)",
                  }}
                >
                  Record Response
                </Button>
              )}
              {selectedMessage.response && (
                <Button
                  onClick={() =>
                    handleReply(
                      selectedMessage.email,
                      selectedMessage.topic,
                      selectedMessage.message,
                      selectedMessage.response,
                    )
                  }
                  style={{
                    padding: "0.75rem 1.5rem",
                    background: "var(--vibe-regeneration)",
                    color: colors.text,
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    fontSize: "var(--type-body-size)",
                  }}
                >
                  Send Email with Recorded Response
                </Button>
              )}
              {!selectedMessage.readAt && (
                <Button
                  onClick={() => {
                    handleMarkRead(selectedMessage.id);
                    handleCloseModal();
                  }}
                  disabled={markReadMutation.isPending}
                  style={{
                    padding: "0.75rem 1.5rem",
                    background: "var(--vibe-strength)",
                    color: colors.text,
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    fontSize: "var(--type-body-size)",
                  }}
                >
                  Mark as Read
                </Button>
              )}
              <Button
                onClick={handleCloseModal}
                style={{
                  padding: "0.75rem 1.5rem",
                  background: "transparent",
                  color: colors.text,
                  border: `1px solid ${colors.border}`,
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  fontSize: "var(--type-body-size)",
                }}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessagesPage;
