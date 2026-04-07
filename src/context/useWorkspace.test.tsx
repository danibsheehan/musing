import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useWorkspace } from "./useWorkspace";

describe("useWorkspace", () => {
  it("throws when used outside WorkspaceProvider", () => {
    expect(() => {
      renderHook(() => useWorkspace());
    }).toThrow("useWorkspace must be used within WorkspaceProvider");
  });
});
