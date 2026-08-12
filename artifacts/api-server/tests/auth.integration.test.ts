import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../src/app";
import { createToken } from "./helpers/auth";

describe("Authentication", () => {
  it("rejects requests without a JWT", async () => {
    const response = await request(app)
      .get("/api/documents");

    expect(response.status).toBe(401);
  });

  it("rejects malformed JWTs", async () => {
    const response = await request(app)
      .get("/api/documents")
      .set(
        "Authorization",
        "Bearer definitely-not-a-token"
      );

    expect(response.status).toBe(401);
  });

  it("accepts a valid JWT", async () => {
    const token = createToken("VIEWER");

    const response = await request(app)
      .get("/api/documents")
      .set(
        "Authorization",
        `Bearer ${token}`
      );

    expect(response.status).not.toBe(401);
  });
});
describe("Document Authorization", () => {
  it("blocks viewers from uploading documents", async () => {
    const token = createToken("VIEWER");

    const response = await request(app)
      .post("/api/documents/upload")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: "Forbidden",
    });
  });

  it("allows inspectors to reach the upload route", async () => {
    const token = createToken("INSPECTOR");

    const response = await request(app)
      .post("/api/documents/upload")
      .set("Authorization", `Bearer ${token}`);

    // Authorization succeeds. The request may then fail because
    // no actual PDF file was uploaded.
    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
  });

  it("allows admins to reach the upload route", async () => {
    const token = createToken("ADMIN");

    const response = await request(app)
      .post("/api/documents/upload")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
  });

  it("blocks inspectors from deleting documents", async () => {
    const token = createToken("INSPECTOR");

    const response = await request(app)
      .delete("/api/documents/test-document-id")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: "Forbidden",
    });
  });

  it("blocks viewers from deleting documents", async () => {
    const token = createToken("VIEWER");

    const response = await request(app)
      .delete("/api/documents/test-document-id")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: "Forbidden",
    });
  });
});
it("rejects unauthenticated document deletion", async () => {
  const response = await request(app)
    .delete("/api/documents/test-document-id");

  expect(response.status).toBe(401);
  expect(response.body).toEqual({
    error: "Unauthorized",
  });
});