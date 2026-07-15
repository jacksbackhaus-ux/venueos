import { describe, it, expect } from "vitest";
import { siteRoleLabel, isManagerRole } from "@/lib/siteRoleLabel";

describe("siteRoleLabel", () => {
  it("shows Manager for org owners regardless of site role", () => {
    expect(siteRoleLabel("staff", { isOrgOwner: true })).toBe("Manager");
    expect(siteRoleLabel(null, { isOrgOwner: true })).toBe("Manager");
  });

  it("maps site owner and supervisor to Manager", () => {
    expect(siteRoleLabel("owner")).toBe("Manager");
    expect(siteRoleLabel("supervisor")).toBe("Manager");
  });

  it("maps staff and read_only correctly", () => {
    expect(siteRoleLabel("staff")).toBe("Staff");
    expect(siteRoleLabel("read_only")).toBe("Read-only");
  });

  it("returns empty for unknown/null", () => {
    expect(siteRoleLabel(null)).toBe("");
    expect(siteRoleLabel("bogus")).toBe("");
  });
});

describe("isManagerRole", () => {
  it("treats owner and supervisor as manager", () => {
    expect(isManagerRole("owner")).toBe(true);
    expect(isManagerRole("supervisor")).toBe(true);
  });
  it("rejects staff, read_only, unknown", () => {
    expect(isManagerRole("staff")).toBe(false);
    expect(isManagerRole("read_only")).toBe(false);
    expect(isManagerRole(null)).toBe(false);
  });
});
