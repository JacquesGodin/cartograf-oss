import { describe, it, expect } from "vitest";
import { getTechLayer } from "@/lib/types";

describe("getTechLayer", () => {
  it("classifies infra-account categories as services", () => {
    expect(getTechLayer("Stripe", "payments")).toBe("service");
    expect(getTechLayer("Neon", "database")).toBe("service");
    expect(getTechLayer("Clerk", "auth")).toBe("service");
    expect(getTechLayer("AWS S3", "storage")).toBe("service");
    expect(getTechLayer("Vercel", "deployment")).toBe("service");
    expect(getTechLayer("Resend", "email")).toBe("service");
  });

  it("classifies non-account categories as libraries", () => {
    expect(getTechLayer("React", "frontend")).toBe("library");
    expect(getTechLayer("Next.js", "backend")).toBe("library");
    expect(getTechLayer("Vitest", "testing")).toBe("library");
    expect(getTechLayer("Zod", "validation")).toBe("library");
  });

  it("treats known client libraries as libraries even in a service category", () => {
    // ORMs / SDKs live in service categories but don't themselves need an account.
    expect(getTechLayer("Drizzle", "database")).toBe("library");
    expect(getTechLayer("Prisma", "database")).toBe("library");
    expect(getTechLayer("NextAuth", "auth")).toBe("library");
  });

  it("normalizes the tech name when matching the library override", () => {
    expect(getTechLayer("drizzle orm", "database")).toBe("library");
  });
});
