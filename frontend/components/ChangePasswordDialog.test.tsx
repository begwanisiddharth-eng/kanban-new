import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api, ApiError } from "@/lib/api";
import { ChangePasswordDialog } from "./ChangePasswordDialog";

vi.mock("@/lib/api", async (original) => {
  const actual = await original<typeof import("@/lib/api")>();
  return { ...actual, api: { changePassword: vi.fn() } };
});

async function fill(current: string, next: string, confirm: string) {
  const user = userEvent.setup();
  render(
    <ChangePasswordDialog open onOpenChange={() => {}} onExpired={() => {}} />,
  );
  await user.type(screen.getByLabelText("Current password"), current);
  await user.type(screen.getByLabelText("New password"), next);
  await user.type(screen.getByLabelText("Confirm new password"), confirm);
  await user.click(screen.getByRole("button", { name: "Change password" }));
}

beforeEach(() => vi.clearAllMocks());

describe("ChangePasswordDialog", () => {
  it("requires the new passwords to match", async () => {
    await fill("old-password", "new-password", "different1");
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("do not match"),
    );
    expect(api.changePassword).not.toHaveBeenCalled();
  });

  it("changes the password", async () => {
    vi.mocked(api.changePassword).mockResolvedValue(undefined);
    await fill("old-password", "new-password", "new-password");
    expect(api.changePassword).toHaveBeenCalledWith(
      "old-password",
      "new-password",
    );
    expect(
      await screen.findByText(/Your password has been changed/),
    ).toBeVisible();
  });

  it("shows the server's error", async () => {
    vi.mocked(api.changePassword).mockRejectedValue(
      new ApiError(400, "Your current password is incorrect."),
    );
    await fill("wrong-password", "new-password", "new-password");
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Your current password is incorrect.",
      ),
    );
  });
});
