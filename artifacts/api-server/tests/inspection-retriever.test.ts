import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  from: vi.fn(),
  orderBy: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: mocks.select,
  },

  inspectionsTable: {
    issueType: "issueType",
    status: "status",
    severity: "severity",
    createdAt: "createdAt",
  },

  statusEnum: [
    "Active",
    "Completed",
    "Pending",
    "Cancelled",
  ],
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...conditions) => ({
    type: "and",
    conditions,
  })),
  desc: vi.fn((column) => ({
    type: "desc",
    column,
  })),
  eq: vi.fn((column, value) => ({
    type: "eq",
    column,
    value,
  })),
}));

import { retrieveRelevantInspections } from "../src/lib/ai/retriever/inspection-retriever";

describe("retrieveRelevantInspections", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const query = {
      from: mocks.from,
      orderBy: mocks.orderBy,
      where: mocks.where,
      limit: mocks.limit,
      then: vi.fn(),
    };

    mocks.select.mockReturnValue(query);
    mocks.from.mockReturnValue(query);
    mocks.orderBy.mockReturnValue(query);
    mocks.where.mockReturnValue(query);
    mocks.limit.mockReturnValue(query);

    query.then.mockImplementation(
      (resolve: (value: unknown) => unknown) =>
        Promise.resolve([{ id: "inspection-1" }]).then(resolve)
    );
  });

  it("retrieves all inspections for report requests", async () => {
    const result = await retrieveRelevantInspections(
      "Generate an inspection report"
    );

    expect(mocks.select).toHaveBeenCalledOnce();
    expect(mocks.from).toHaveBeenCalledOnce();
    expect(mocks.orderBy).toHaveBeenCalledOnce();
    expect(mocks.where).not.toHaveBeenCalled();
    expect(mocks.limit).not.toHaveBeenCalled();

    expect(result).toEqual([
      {
        id: "inspection-1",
      },
    ]);
  });

  it("filters by issue type", async () => {
    await retrieveRelevantInspections(
      "Show pavement inspections"
    );

    expect(mocks.where).toHaveBeenCalledOnce();
  });

  it("filters by status", async () => {
    await retrieveRelevantInspections(
      "Show active inspections"
    );

    expect(mocks.where).toHaveBeenCalledOnce();
  });

  it("filters by severity", async () => {
    await retrieveRelevantInspections(
      "Show critical inspections"
    );

    expect(mocks.where).toHaveBeenCalledOnce();
  });

  it("limits filtered latest requests to 20 inspections", async () => {
    await retrieveRelevantInspections(
      "Show the latest critical inspections"
    );

    expect(mocks.where).toHaveBeenCalledOnce();
    expect(mocks.limit).toHaveBeenCalledWith(20);
  });

  it("limits unfiltered latest requests to 20 inspections", async () => {
    await retrieveRelevantInspections(
      "Show the latest inspections"
    );

    expect(mocks.where).not.toHaveBeenCalled();
    expect(mocks.limit).toHaveBeenCalledWith(20);
  });

  it("combines multiple filters", async () => {
    await retrieveRelevantInspections(
      "Show the latest critical active pavement inspections"
    );

    expect(mocks.where).toHaveBeenCalledOnce();
    expect(mocks.limit).toHaveBeenCalledWith(20);

    const whereArgument = mocks.where.mock.calls[0][0];

    expect(whereArgument).toEqual({
      type: "and",
      conditions: [
        {
          type: "eq",
          column: "issueType",
          value: "Pavement Distress",
        },
        {
          type: "eq",
          column: "status",
          value: "Active",
        },
        {
          type: "eq",
          column: "severity",
          value: "Critical",
        },
      ],
    });
  });

  it("returns all inspections when no filters are present", async () => {
    const result = await retrieveRelevantInspections(
      "What inspections do we have?"
    );

    expect(mocks.where).not.toHaveBeenCalled();
    expect(mocks.limit).not.toHaveBeenCalled();
    expect(mocks.orderBy).toHaveBeenCalledOnce();

    expect(result).toEqual([
      {
        id: "inspection-1",
      },
    ]);
  });
});
