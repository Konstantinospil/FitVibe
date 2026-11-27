import { db } from "../../../../apps/backend/src/db/connection.js";
import * as repository from "../../../../apps/backend/src/modules/sessions/sessions.repository.js";
import * as imageUpload from "../../../../apps/backend/src/services/imageUpload.service.js";
import * as storage from "../../../../apps/backend/src/services/mediaStorage.service.js";
import { insertAudit } from "../../../../apps/backend/src/modules/common/audit.util.js";
import {
  deleteSessionPhoto,
  readSessionPhoto,
  saveSessionPhoto,
} from "../../../../apps/backend/src/modules/sessions/sessions.photo.service.js";
import { HttpError } from "../../../../apps/backend/src/utils/http.js";

jest.mock("../../../../apps/backend/src/db/connection.js", () => ({
  db: { transaction: jest.fn() },
}));
jest.mock("../../../../apps/backend/src/modules/sessions/sessions.repository.js", () => ({
  ...jest.requireActual("../../../../apps/backend/src/modules/sessions/sessions.repository.js"),
  getSessionById: jest.fn(),
  sessionPhotoRows: jest.fn(),
  findSessionPhoto: jest.fn(),
}));
jest.mock("../../../../apps/backend/src/services/imageUpload.service.js", () => ({
  ...jest.requireActual("../../../../apps/backend/src/services/imageUpload.service.js"),
  prepareImage: jest.fn(),
}));
jest.mock("../../../../apps/backend/src/services/mediaStorage.service.js", () => ({
  ...jest.requireActual("../../../../apps/backend/src/services/mediaStorage.service.js"),
  saveMediaFile: jest.fn(),
  deleteStorageObject: jest.fn(),
  readStorageObject: jest.fn(),
}));
jest.mock("../../../../apps/backend/src/modules/common/audit.util.js");

const mockRepo = jest.mocked(repository);
const mockImage = jest.mocked(imageUpload);
const mockStorage = jest.mocked(storage);
const mockTransaction = jest.mocked(db.transaction);

const userId = "user-1";
const sessionId = "session-1";
const file = { buffer: Buffer.from("x"), mimetype: "image/png", originalname: "a.png", size: 1 };
const storedPhoto = {
  id: "photo-new",
  url: `/api/v1/sessions/${sessionId}/photo/photo-new`,
  mime_type: "image/jpeg",
  bytes: 3,
  uploaded_at: "2026-11-27T10:00:00.000Z",
};

/** A transaction whose table builders record inserts and deletes. */
function fakeTransaction(lockedStatus: string | undefined) {
  const inserts: unknown[] = [];
  const deletedIds: unknown[] = [];
  const trx = jest.fn((table: string) => {
    if (table === "sessions") {
      const builder = {
        where: () => builder,
        whereNull: () => builder,
        forUpdate: () => builder,
        first: async () => (lockedStatus ? { status: lockedStatus } : undefined),
      };
      return builder;
    }
    return {
      insert: async (row: unknown) => inserts.push(row),
      whereIn: (_column: string, ids: unknown[]) => ({ del: async () => deletedIds.push(...ids) }),
    };
  });
  mockTransaction.mockImplementation(((run: (t: typeof trx) => unknown) => run(trx)) as never);
  return { inserts, deletedIds };
}

const rejection = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return error as HttpError;
  }
  throw new Error("expected a rejection");
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRepo.getSessionById.mockResolvedValue({
    id: sessionId,
    owner_id: userId,
    status: "completed",
  } as never);
  mockImage.prepareImage.mockResolvedValue({ buffer: Buffer.from("jpg"), mimeType: "image/jpeg" });
  mockStorage.saveMediaFile.mockResolvedValue({ storageKey: "sessions/user-1/new.jpg", bytes: 3 });
  mockStorage.deleteStorageObject.mockResolvedValue(undefined);
  mockRepo.findSessionPhoto.mockResolvedValue(storedPhoto);
});

describe("saveSessionPhoto", () => {
  it("stores a first photo and audits the upload", async () => {
    const { inserts } = fakeTransaction("completed");
    mockRepo.sessionPhotoRows.mockResolvedValue([]);

    await expect(saveSessionPhoto(userId, sessionId, file)).resolves.toEqual(storedPhoto);

    expect(mockImage.prepareImage).toHaveBeenCalledWith(file, imageUpload.PHOTO_RENDITION);
    expect(inserts).toEqual([
      expect.objectContaining({
        owner_id: userId,
        target_type: repository.SESSION_PHOTO_TARGET,
        target_id: sessionId,
        storage_key: "sessions/user-1/new.jpg",
      }),
    ]);
    expect(insertAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "session_photo_uploaded" }),
    );
  });

  it("replaces the old photo: its row goes in the transaction, its file after", async () => {
    const { deletedIds } = fakeTransaction("completed");
    mockRepo.sessionPhotoRows.mockResolvedValue([
      {
        id: "photo-old",
        storage_key: "sessions/user-1/old.jpg",
        mime_type: "image/jpeg",
        bytes: 2,
        created_at: "x",
      },
    ]);

    await saveSessionPhoto(userId, sessionId, file);

    expect(deletedIds).toEqual(["photo-old"]);
    expect(mockStorage.deleteStorageObject).toHaveBeenCalledWith("sessions/user-1/old.jpg");
    expect(insertAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "session_photo_replaced" }),
    );
  });

  it("refuses a workout that is not completed before reading the file", async () => {
    mockRepo.getSessionById.mockResolvedValue({ id: sessionId, status: "planned" } as never);
    const error = await rejection(saveSessionPhoto(userId, sessionId, file));
    expect(error).toMatchObject({ status: 409, code: "E.SESSION.PHOTO_NOT_COMPLETED" });
    expect(mockImage.prepareImage).not.toHaveBeenCalled();
  });

  it("removes the written file when the session changed before the row was saved", async () => {
    fakeTransaction("in_progress");
    const error = await rejection(saveSessionPhoto(userId, sessionId, file));
    expect(error).toMatchObject({ status: 409 });
    expect(mockStorage.deleteStorageObject).toHaveBeenCalledWith("sessions/user-1/new.jpg");
  });

  it("answers 404 for someone else's session", async () => {
    mockRepo.getSessionById.mockResolvedValue(undefined);
    const error = await rejection(saveSessionPhoto(userId, sessionId, file));
    expect(error).toMatchObject({ status: 404, code: "E.SESSION.NOT_FOUND" });
  });
});

describe("deleteSessionPhoto", () => {
  it("removes the row and the file, and audits it", async () => {
    const { deletedIds } = fakeTransaction("completed");
    mockRepo.sessionPhotoRows.mockResolvedValue([
      {
        id: "photo-1",
        storage_key: "sessions/user-1/a.jpg",
        mime_type: "image/jpeg",
        bytes: 2,
        created_at: "x",
      },
    ]);

    await deleteSessionPhoto(userId, sessionId);

    expect(deletedIds).toEqual(["photo-1"]);
    expect(mockStorage.deleteStorageObject).toHaveBeenCalledWith("sessions/user-1/a.jpg");
    expect(insertAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "session_photo_deleted" }),
    );
  });

  it("succeeds without a photo and audits nothing", async () => {
    fakeTransaction("completed");
    mockRepo.sessionPhotoRows.mockResolvedValue([]);
    await deleteSessionPhoto(userId, sessionId);
    expect(insertAudit).not.toHaveBeenCalled();
  });
});

describe("readSessionPhoto", () => {
  const row = {
    id: "photo-1",
    storage_key: "k",
    mime_type: "image/jpeg",
    bytes: 2,
    created_at: "x",
  };

  it("returns the owner's image", async () => {
    mockRepo.sessionPhotoRows.mockResolvedValue([row]);
    mockStorage.readStorageObject.mockResolvedValue(Buffer.from("jpg"));
    await expect(readSessionPhoto(userId, sessionId, "photo-1")).resolves.toEqual({
      buffer: Buffer.from("jpg"),
      mimeType: "image/jpeg",
    });
  });

  it("answers 404 for an old id or a missing file", async () => {
    mockRepo.sessionPhotoRows.mockResolvedValue([row]);
    expect(await rejection(readSessionPhoto(userId, sessionId, "photo-old"))).toMatchObject({
      status: 404,
      code: "E.SESSION.PHOTO_NOT_FOUND",
    });
    mockStorage.readStorageObject.mockRejectedValue(new Error("ENOENT"));
    expect(await rejection(readSessionPhoto(userId, sessionId, "photo-1"))).toMatchObject({
      status: 404,
    });
  });
});
