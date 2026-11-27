import { it, expect, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest";
import sharp from "sharp";
import app from "../../../apps/backend/src/app.js";
import db from "../../../apps/backend/src/db/index.js";
import { readStorageObject } from "../../../apps/backend/src/services/mediaStorage.service.js";
import {
  ensureRolesSeeded,
  ensureUsernameColumnExists,
  truncateAll,
} from "../../setup/test-helpers.js";
import { describeWithTestDatabase } from "../../setup/db-availability.js";
import { signInNewAthlete, type SignedInAthlete } from "../test-helpers/athlete-session.js";

const HOUR_MS = 3_600_000;
const hoursFromNow = (hours: number) => new Date(Date.now() + hours * HOUR_MS).toISOString();

const pngImage = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 20, g: 120, b: 200 } } })
    .png()
    .toBuffer();

/**
 * The post-workout note and photo (issue 365, ADR-044): the note is stored apart
 * from the plan's notes, and the photo is one owner-only image per completed
 * session, scanned and re-encoded through the shared image pipeline.
 */
describeWithTestDatabase("Integration: session note and photo", () => {
  let owner: SignedInAthlete;
  let other: SignedInAthlete;

  const logWorkout = async (body: Record<string, unknown> = {}) => {
    const response = await request(app)
      .post("/api/v1/sessions")
      .set("Authorization", owner.bearer)
      .send({ status: "completed", planned_at: hoursFromNow(-2), ...body });
    expect(response.status).toBe(201);
    return response.body as { id: string; result_note: string | null; photo: unknown };
  };

  const upload = (athlete: SignedInAthlete, sessionId: string, image: Buffer, type = "image/png") =>
    request(app)
      .post(`/api/v1/sessions/${sessionId}/photo`)
      .set("Authorization", athlete.bearer)
      .attach("photo", image, { filename: "workout.png", contentType: type });

  const getSession = (athlete: SignedInAthlete, sessionId: string) =>
    request(app).get(`/api/v1/sessions/${sessionId}`).set("Authorization", athlete.bearer);

  const photoRows = (sessionId: string) =>
    db("media").where({ target_type: "session", target_id: sessionId });

  beforeAll(async () => {
    await ensureUsernameColumnExists();
  });

  beforeEach(async () => {
    const { env } = await import("../../../apps/backend/src/config/env.js");
    (env as { readOnlyMode: boolean }).readOnlyMode = false;
    await truncateAll();
    await ensureRolesSeeded();
    owner = await signInNewAthlete(app, "photo-owner");
    other = await signInNewAthlete(app, "photo-other");
  });

  it("keeps the result note apart from the plan's notes and lets the owner edit it later", async () => {
    const logged = await logWorkout({ notes: "Rest 90 s", result_note: "  Felt strong  " });
    expect(logged).toMatchObject({ result_note: "Felt strong", photo: null });

    const edited = await request(app)
      .patch(`/api/v1/sessions/${logged.id}`)
      .set("Authorization", owner.bearer)
      .send({ result_note: "Felt strong, knee fine" });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({
      notes: "Rest 90 s",
      result_note: "Felt strong, knee fine",
    });
  });

  it("refuses a result note and a photo before the workout is done", async () => {
    const planned = await request(app)
      .post("/api/v1/sessions")
      .set("Authorization", owner.bearer)
      .send({ planned_at: hoursFromNow(24) });
    expect(planned.status).toBe(201);

    const note = await request(app)
      .patch(`/api/v1/sessions/${planned.body.id}`)
      .set("Authorization", owner.bearer)
      .send({ result_note: "Too early" });
    expect(note.status).toBe(400);
    expect(note.body.error.code).toBe("E.SESSION.RESULT_NOTE_WITHOUT_RESULT");

    const photo = await upload(owner, planned.body.id, await pngImage(20, 20));
    expect(photo.status).toBe(409);
    expect(photo.body.error.code).toBe("E.SESSION.PHOTO_NOT_COMPLETED");
    expect(await photoRows(planned.body.id)).toHaveLength(0);
  });

  it("stores one re-encoded photo and serves it to the owner only", async () => {
    const { id } = await logWorkout({ visibility: "public" });

    const created = await upload(owner, id, await pngImage(120, 80));
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      mime_type: "image/jpeg",
      url: `/api/v1/sessions/${id}/photo/${created.body.id}`,
    });

    const image = await request(app).get(created.body.url).set("Authorization", owner.bearer);
    expect(image.status).toBe(200);
    expect(image.headers["content-type"]).toBe("image/jpeg");
    expect((await sharp(image.body as Buffer).metadata()).format).toBe("jpeg");

    expect((await getSession(owner, id)).body.photo).toMatchObject({ id: created.body.id });
    // Anyone else sees the public session without its photo, and cannot read or change it.
    expect((await getSession(other, id)).body.photo).toBeNull();
    expect(
      (await request(app).get(created.body.url).set("Authorization", other.bearer)).status,
    ).toBe(404);
    expect((await upload(other, id, await pngImage(20, 20))).status).toBe(404);
    expect(
      (await request(app).delete(`/api/v1/sessions/${id}/photo`).set("Authorization", other.bearer))
        .status,
    ).toBe(404);
    expect(await photoRows(id)).toHaveLength(1);
  });

  it("replaces the photo: one row, a new URL, and the old file gone", async () => {
    const { id } = await logWorkout();
    const first = await upload(owner, id, await pngImage(60, 60));
    const [firstRow] = await photoRows(id);

    const second = await upload(owner, id, await pngImage(90, 60));
    expect(second.status).toBe(201);
    expect(second.body.id).not.toBe(first.body.id);

    expect(await photoRows(id)).toHaveLength(1);
    await expect(readStorageObject(firstRow.storage_key)).rejects.toThrow();
    expect((await request(app).get(first.body.url).set("Authorization", owner.bearer)).status).toBe(
      404,
    );

    const audit = await db("audit_log")
      .where({ actor_user_id: owner.userId, entity_type: "session_media" })
      .orderBy("created_at", "asc")
      .pluck("action");
    expect(audit).toEqual(["session_photo_uploaded", "session_photo_replaced"]);
  });

  it("rejects a file that is not an image and stores nothing", async () => {
    const { id } = await logWorkout();
    const response = await upload(owner, id, Buffer.from("not an image"));
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("UPLOAD_UNSUPPORTED_TYPE");
    expect(await photoRows(id)).toHaveLength(0);
  });

  it("removes the photo, and removing it again still succeeds", async () => {
    const { id } = await logWorkout();
    await upload(owner, id, await pngImage(30, 30));
    const [row] = await photoRows(id);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const removed = await request(app)
        .delete(`/api/v1/sessions/${id}/photo`)
        .set("Authorization", owner.bearer);
      expect(removed.status).toBe(204);
    }
    expect(await photoRows(id)).toHaveLength(0);
    await expect(readStorageObject(row.storage_key)).rejects.toThrow();
    expect((await getSession(owner, id)).body.photo).toBeNull();
  });

  it("requires sign-in", async () => {
    const { id } = await logWorkout();
    const response = await request(app)
      .post(`/api/v1/sessions/${id}/photo`)
      .attach("photo", await pngImage(10, 10), "workout.png");
    expect(response.status).toBe(401);
  });
});
