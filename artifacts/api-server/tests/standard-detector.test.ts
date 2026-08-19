import { describe, expect, it } from "vitest";
import { extractRequestedStandard } from "../src/lib/knowledge/retriever";

describe("extractRequestedStandard", () => {
  it("detects IS codes", () => {
    expect(
      extractRequestedStandard(
        "According to IS 456, what is the minimum cover?"
      )
    ).toBe("IS 456");
  });

  it("detects hyphenated IS codes", () => {
    expect(
      extractRequestedStandard("What does IS-800 say about steel?")
    ).toBe("IS 800");
  });

  it("detects IS codes without a space", () => {
    expect(
      extractRequestedStandard("Explain IS1893 earthquake provisions")
    ).toBe("IS 1893");
  });

  it("detects IRC codes", () => {
    expect(
      extractRequestedStandard("According to IRC 6, what applies?")
    ).toBe("IRC 6");
  });

  it("detects MoRTH", () => {
    expect(
      extractRequestedStandard("What does MoRTH specify for highways?")
    ).toBe("MoRTH");
  });

  it("returns null when no standard is explicitly requested", () => {
    expect(
      extractRequestedStandard(
        "What is the minimum concrete cover?"
      )
    ).toBeNull();
  });
});