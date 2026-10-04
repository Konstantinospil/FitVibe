import * as publication from "../../../../apps/backend/src/modules/feed/feed.publication.service.js";
import * as repo from "../../../../apps/backend/src/modules/feed/feed.publication.repository.js";
import * as audit from "../../../../apps/backend/src/modules/common/audit.util.js";

jest.mock("../../../../apps/backend/src/modules/feed/feed.publication.repository.js");
jest.mock("../../../../apps/backend/src/modules/common/audit.util.js");

const mockRepo = jest.mocked(repo);
const mockAudit = jest.mocked(audit);

describe("feed.publication.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("audits only the atomic creation of a session feed item", async () => {
    mockRepo.insertSessionFeedItemAtomic.mockResolvedValue({
      row: {
        id: "feed-1",
        owner_id: "user-1",
        session_id: "session-1",
        visibility: "followers",
        published_at: "2026-09-21T00:00:00.000Z",
      },
      created: true,
    });

    const result = await publication.ensureSessionPublished(
      "user-1",
      "session-1",
      "followers",
    );

    expect(result).toEqual({ feedItemId: "feed-1", created: true });
    expect(mockRepo.insertSessionFeedItemAtomic).toHaveBeenCalledWith({
      ownerId: "user-1",
      sessionId: "session-1",
      visibility: "followers",
    });
    expect(mockAudit.insertAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "user-1",
        action: "feed.publish",
        entityId: "feed-1",
      }),
    );
  });

  it("does not duplicate the publish audit when the atomic insert reuses an existing row", async () => {
    mockRepo.insertSessionFeedItemAtomic.mockResolvedValue({
      row: {
        id: "feed-existing",
        owner_id: "user-1",
        session_id: "session-1",
        visibility: "public",
        published_at: "2026-09-21T00:00:00.000Z",
      },
      created: false,
    });

    await publication.ensureSessionPublished("user-1", "session-1", "public");

    expect(mockAudit.insertAudit).not.toHaveBeenCalled();
  });
});
