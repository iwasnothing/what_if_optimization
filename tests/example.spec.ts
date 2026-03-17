import path from "path";
import { test, expect } from "@playwright/test";

test("configure full scenario and run optimization", async ({ page }) => {
  const useMockApi = process.env.PLAYWRIGHT_MOCK_API !== "false";
  if (useMockApi) {
    await page.route("**:8080/api/run_scenario", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          objectiveValue: 1234.56,
          portfolioResults: [],
          constraintViolations: [],
        }),
      });
    });
  }

  await page.goto("http://localhost:3000/");

  const csvPath = path.resolve(__dirname, "../sample_data.csv");
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByText("Upload CSV").click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(csvPath);

  await expect(page.getByText("File: sample_data.csv").first()).toBeVisible();

  // Input tab: scenario parameter
  await page.getByRole("button", { name: "Add Parameter" }).click();
  await page.getByPlaceholder("Parameter name").fill("type_ratio");
  await page.getByPlaceholder("Parameter description").fill("ratio of senior staff to junior staff");
  await page.getByRole("button", { name: "Save" }).nth(1).click();
  await expect(page.getByText("type_ratio").first()).toBeVisible();

  // Input tab: row level input variable
  await page.getByRole("button", { name: "Add Variable" }).first().click();
  await page.getByPlaceholder("Variable name").fill("staff_count");
  await page.getByPlaceholder("Variable description").fill("number of staff in the resource pool");
  await page.locator('select').first().selectOption("number_of_resources_allocated");
  await page.locator('input[placeholder="No min"]').fill("1");
  await page.locator('input[placeholder="No max"]').fill("100");
  await page.getByRole("button", { name: "Save" }).nth(1).click();
  await expect(page.getByText("staff_count").first()).toBeVisible();

  // Formula tab: row intermediate variable
  await page.getByRole("button", { name: "Formula" }).click();
  await page.getByRole("button", { name: "Add Variable" }).first().click();
  await page.getByPlaceholder("Variable name").fill("resource_pool_cost");
  await page.getByPlaceholder("Variable description").fill("total cost of resource pool");
  await page
    .getByPlaceholder("e.g., [Price] * [Quantity] + [TaxRate] * 100")
    .fill("[staff_count] * [cost_rate_per_resource]");
  await page.getByRole("button", { name: "Save" }).nth(1).click();
  await expect(page.getByText("resource_pool_cost").first()).toBeVisible();

  // Formula tab: portfolio intermediate variable 1
  await page.getByRole("button", { name: "Add Variable" }).nth(1).click();
  await page.getByPlaceholder("Variable name").fill("staff_per_region");
  await page.getByPlaceholder("Variable description").fill("number of staff per region");
  await page.getByRole("button", { name: "staff_count" }).click();
  await page.getByLabel('Add "Group By" clause').check();
  await page.locator('select').nth(1).selectOption("country");
  await page.getByRole("button", { name: "Save" }).nth(1).click();
  await expect(page.getByText("staff_per_region").first()).toBeVisible();

  // Formula tab: portfolio intermediate variable 2
  await page.getByRole("button", { name: "Add Variable" }).nth(1).click();
  await page.getByPlaceholder("Variable name").fill("staff_by_type");
  await page.getByPlaceholder("Variable description").fill("number of senior staff and junior staff");
  await page.getByRole("button", { name: "staff_count" }).click();
  await page.getByLabel('Add "Group By" clause').check();
  await page.locator('select').nth(1).selectOption("resource_type");
  await page.getByRole("button", { name: "Save" }).nth(1).click();
  await expect(page.getByText("staff_by_type").first()).toBeVisible();

  // Formula tab: portfolio intermediate variable 3
  await page.getByRole("button", { name: "Add Variable" }).nth(1).click();
  await page.getByPlaceholder("Variable name").fill("regional_cost");
  await page.getByPlaceholder("Variable description").fill("total cost per region");
  await page.getByRole("button", { name: "resource_pool_cost" }).click();
  await page.getByLabel('Add "Group By" clause').check();
  await page.locator('select').nth(1).selectOption("country");
  await page.getByRole("button", { name: "Save" }).nth(1).click();
  await expect(page.getByText("regional_cost").first()).toBeVisible();

  // Constraint tab
  await page.getByRole("button", { name: "Constraint" }).click();
  await page.getByRole("button", { name: "Add Constraint" }).click();
  await page.getByPlaceholder("Constraint name").fill("staff count per region ratio");
  await page
    .getByPlaceholder("Constraint description")
    .fill("Percent of staff count per each region to total staff count <= 33%");
  await page.getByRole("button", { name: "Save" }).nth(1).click();
  await expect(page.getByText("staff count per region ratio").first()).toBeVisible();

  await page.getByRole("button", { name: "Add Constraint" }).click();
  await page.getByPlaceholder("Constraint name").fill("senior to junior staff");
  await page
    .getByPlaceholder("Constraint description")
    .fill("ratio of number of senior staff to number of junior staff <= [type_ratio]");
  await page.getByRole("button", { name: "Save" }).nth(1).click();
  await expect(page.getByText("senior to junior staff").first()).toBeVisible();

  await page.getByRole("button", { name: "Add Constraint" }).click();
  await page.getByPlaceholder("Constraint name").fill("total staff");
  await page.getByPlaceholder("Constraint description").fill("total number of staff is 100");
  await page.getByRole("button", { name: "Save" }).nth(1).click();
  await expect(page.getByText("total staff").first()).toBeVisible();

  // Objective tab
  await page.getByRole("button", { name: "Objective" }).click();
  await page.getByRole("button", { name: "Add Objective" }).click();
  await page.getByPlaceholder("Objective name").fill("total cost");
  await page
    .getByPlaceholder("Objective description")
    .fill("minimize total cost of all staff count of all resource pool");
  await page.getByRole("button", { name: "Save" }).nth(1).click();
  await expect(page.getByText("total cost").first()).toBeVisible();

  // Create and run scenario
  await page.getByRole("button", { name: "Create Scenario" }).click();
  await page.getByPlaceholder("Scenario name").fill("Scenario 1");
  await page.locator('input[type="number"]').last().fill("0.33");
  await page.getByRole("button", { name: "Run" }).click();

  const completedStatus = page.getByText("Completed").first();
  if (useMockApi) {
    await expect(completedStatus).toBeVisible({ timeout: 10000 });
    return;
  }

  // Real backend processing can take longer; wait and surface backend errors clearly.
  const errorLog = page.getByText(/Error running optimization:/).first();
  const raceResult = await Promise.race([
    completedStatus
      .waitFor({ state: "visible", timeout: 120000 })
      .then(() => "completed" as const),
    errorLog
      .waitFor({ state: "visible", timeout: 120000 })
      .then(() => "error" as const),
  ]);

  if (raceResult === "error") {
    const message = (await errorLog.textContent()) ?? "Unknown backend error";
    throw new Error(`Optimization failed on real backend: ${message}`);
  }

  await page.screenshot({
    path: "test-results/e2e-final-state.png",
    fullPage: true,
  });
});
