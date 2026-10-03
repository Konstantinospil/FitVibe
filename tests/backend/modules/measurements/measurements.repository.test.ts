import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("../../../../apps/backend/src/db/connection.js", () => {
  const db = Object.assign(jest.fn(), { raw: jest.fn() });
  return { db };
});

import { db } from "../../../../apps/backend/src/db/connection.js";
import {
  getAttributeById,
  getAttributeByNormalizedKey,
  insertAttribute,
  insertAttributeValue,
  listAttributes,
  listLatestAttributeValues,
  listSelections,
  upsertSelection,
} from "../../../../apps/backend/src/modules/measurements/measurements.repository.js";

type DbMock = jest.Mock & { raw: jest.Mock };

const mockDb = db as unknown as DbMock;

describe("measurements repository", () => {
  beforeEach(() => {
    mockDb.mockReset();
    mockDb.raw.mockReset();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("lists attributes with language joins and search", async () => {
    const rows = [{ id: "attr-1" }];
    const query = Promise.resolve(rows) as any;
    query.select = jest.fn().mockReturnValue(query);
    query.orderBy = jest.fn().mockReturnValue(query);
    query.leftJoin = jest.fn().mockReturnValue(query);
    query.where = jest.fn().mockImplementation((builder: (b: any) => void) => {
      const qb = {
        whereILike: jest.fn().mockReturnThis(),
        orWhereILike: jest.fn().mockReturnThis(),
      };
      builder(qb);
      query.whereILike = qb.whereILike;
      query.orWhereILike = qb.orWhereILike;
      return query;
    });

    mockDb.mockImplementation(() => query);
    mockDb.raw.mockReturnValue("raw");

    const result = await listAttributes("bio", "We", "en");

    expect(result).toEqual(rows);
    expect(query.leftJoin).toHaveBeenCalledWith({ t: "translations" }, expect.any(Function));
    expect(query.whereILike).toHaveBeenCalledWith("a.label", "%We%");
    expect(query.orWhereILike).toHaveBeenCalledWith("t.value", "%We%");
  });

  it("fetches attributes by id and normalized key", async () => {
    const row = { id: "attr-1" };
    const query = {
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(row),
    };
    mockDb.mockImplementation(() => query);

    const byId = await getAttributeById("bio", "attr-1");
    const byKey = await getAttributeByNormalizedKey("bio", "normalized");

    expect(byId).toEqual(row);
    expect(byKey).toEqual(row);
    expect(query.where).toHaveBeenCalledWith({ id: "attr-1" });
    expect(query.where).toHaveBeenCalledWith({ normalized_key: "normalized" });
  });

  it("inserts attributes and returns ids", async () => {
    const query = {
      insert: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([{ id: "attr-1" }]),
    };
    mockDb.mockImplementation(() => query);

    const id = await insertAttribute("bio", {
      key: "height",
      normalized_key: "height",
      label: "Height",
      description: null,
      unit_type: "length",
      granularity: "cm",
      measurement_system: "metric",
      min_value_metric: 10,
      max_value_metric: 20,
      min_value_imperial: 3,
      max_value_imperial: 7,
      is_default: false,
      derived_from_a_id: null,
      derived_from_b_id: null,
      derived_operator: null,
    });

    expect(id).toBe("attr-1");
    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "height",
        label: "Height",
        created_at: expect.any(String),
        updated_at: expect.any(String),
      }),
    );
  });

  it("lists latest attribute values", async () => {
    mockDb.raw.mockResolvedValue({
      rows: [
        {
          id: "value-1",
          user_id: "user-1",
          attribute_id: "attr-1",
          value_number: 10,
          measured_at: "2025-01-01",
          created_at: "2025-01-01",
        },
      ],
    });

    const result = await listLatestAttributeValues("bio", "user-1");

    expect(mockDb.raw).toHaveBeenCalledWith(
      expect.stringContaining("deactivated_at IS NULL"),
      ["user-1"],
    );
    expect(result).toHaveLength(1);
  });

  it("inserts attribute values", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2025-02-01T12:00:00Z"));
    const query = {
      insert: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([{ id: "value-1" }]),
    };
    mockDb.mockImplementation(() => query);

    const id = await insertAttributeValue("bio", "user-1", "attr-1", 10);

    expect(id).toBe("value-1");
    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        attribute_id: "attr-1",
        value_number: 10,
        measured_at: "2025-02-01T12:00:00.000Z",
        created_at: "2025-02-01T12:00:00.000Z",
      }),
    );
  });

  it("lists selections and upserts visibility", async () => {
    const selectionQuery = {
      where: jest.fn().mockResolvedValue([{ attribute_id: "attr-1", is_visible: true }]),
    };
    mockDb.mockImplementationOnce(() => selectionQuery);

    const selections = await listSelections("bio", "user-1");

    expect(selections).toHaveLength(1);
    expect(selectionQuery.where).toHaveBeenCalledWith({ user_id: "user-1" });

    const upsertQuery = {
      insert: jest.fn().mockReturnThis(),
      onConflict: jest.fn().mockReturnThis(),
      merge: jest.fn().mockResolvedValue(undefined),
    };
    mockDb.mockImplementationOnce(() => upsertQuery);

    await upsertSelection("bio", "user-1", "attr-1", true);

    expect(upsertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        attribute_id: "attr-1",
        is_visible: true,
        created_at: expect.any(String),
      }),
    );
    expect(upsertQuery.onConflict).toHaveBeenCalledWith(["user_id", "attribute_id"]);
    expect(upsertQuery.merge).toHaveBeenCalledWith({ is_visible: true });
  });
});
