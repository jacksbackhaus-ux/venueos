import { describe, it, expect } from "vitest";
import { determinePostLoginRoute } from "@/lib/postLoginRoute";

describe("determinePostLoginRoute", () => {
  it("staff PIN sessions always route to the staff app root", () => {
    const r = determinePostLoginRoute(null, "staff");
    expect(r.path).toBe("/");
    expect(r.blocked).toBeFalsy();
  });

  it("blocks email login when profile has no organisation", () => {
    const r = determinePostLoginRoute({ organisation_id: null }, "email");
    expect(r.blocked).toBe(true);
    expect(r.path).toBe("/auth");
  });

  it("routes org_owner to dashboard", () => {
    const r = determinePostLoginRoute(
      { organisation_id: "org1", org_role: "org_owner" },
      "email",
    );
    expect(r.path).toBe("/");
    expect(r.blocked).toBeFalsy();
  });

  it("routes site owner/supervisor to dashboard", () => {
    for (const role of ["owner", "supervisor"]) {
      const r = determinePostLoginRoute(
        { organisation_id: "org1", site_role: role },
        "email",
      );
      expect(r.path).toBe("/");
    }
  });

  it("blocks staff site_role from email login and directs to PIN flow", () => {
    const r = determinePostLoginRoute(
      { organisation_id: "org1", site_role: "staff" },
      "email",
    );
    expect(r.blocked).toBe(true);
    expect(r.path).toContain("staff_use_pin");
  });

  it("never routes email logins into the internal staff console", () => {
    const attempts = [
      { organisation_id: null },
      { organisation_id: "org1", org_role: "org_owner" },
      { organisation_id: "org1", site_role: "staff" },
      { organisation_id: "org1", site_role: "read_only" },
    ];
    for (const p of attempts) {
      const r = determinePostLoginRoute(p, "email");
      expect(r.path.startsWith("/staff")).toBe(false);
    }
  });
});
