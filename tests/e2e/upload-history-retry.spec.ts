import { expect, test } from "@playwright/test";

const orgId = process.env.E2E_ORG_ID;
const hasAuthState = !!process.env.E2E_STORAGE_STATE;

test.describe("Candidates upload history flow", () => {
  test.skip(!orgId, "Set E2E_ORG_ID to run this spec.");
  test.skip(!hasAuthState, "Set E2E_STORAGE_STATE to an authenticated Playwright storage file.");

  test("resume upload failure appears in audit log and supports retry action", async ({ page }) => {
    const invalidFileName = `e2e-invalid-${Date.now()}.txt`;

    await page.goto(`/orgs/${orgId}/candidates`);
    await expect(page.getByRole("heading", { name: "Talent Pool" })).toBeVisible();

    await page.getByRole("button", { name: "Resume Upload" }).click();
    await expect(page.getByRole("heading", { name: "Upload resumes" })).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles({
      name: invalidFileName,
      mimeType: "text/plain",
      buffer: Buffer.from("invalid e2e upload"),
    });

    await page.getByRole("button", { name: "Upload & Parse" }).click();

    await expect(page.getByText(/\[INVALID_MIME\]/)).toBeVisible();
    await expect(page.getByText(/Correlation ID:/)).toBeVisible();

    await page.goto(`/orgs/${orgId}/uploads`);
    await expect(page.getByRole("heading", { name: "Import Activity Log" })).toBeVisible();
    await expect(page.getByText("Upload Audit")).toBeVisible();

    await page.getByPlaceholder("Search file, source, user, error...").fill(invalidFileName);
    await page.getByRole("button", { name: "Apply" }).click();

    const firstBatch = page.locator("details").first();
    await firstBatch.locator("summary").click();

    await expect(page.getByText(invalidFileName)).toBeVisible();
    const retryButton = page.getByRole("button", { name: /Retry \d+ Failed/i }).first();
    await expect(retryButton).toBeVisible();

    await retryButton.click();
    await expect(page.getByText(/Retrying \d+ failed file\(s\)/i)).toBeVisible();

    await page.waitForTimeout(2500);
    await expect(page.getByRole("heading", { name: "Import Activity Log" })).toBeVisible();
  });
});
