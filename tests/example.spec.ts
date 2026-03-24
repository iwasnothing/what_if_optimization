import path from "path";
import { writeFileSync } from "fs";
import { test, expect } from "@playwright/test";

test("configure full scenario and run optimization", async ({ page }) => {
  const frontendUrl = process.env.PW_FRONTEND_URL ?? "http://localhost:3000";
  const useMockApi = process.env.PLAYWRIGHT_MOCK_API !== "false";
  if (!useMockApi) {
    test.setTimeout(45 * 60 * 1000);
  }
  if (useMockApi) {
    await page.route("**:8080/api/run_scenario", async (route) => {
      let objectiveValue = 1234.56;
      try {
        const json = route.request().postDataJSON() as {
          scenario?: { parameterValues?: Record<string, number> };
        };
        const ratio = Number(json?.scenario?.parameterValues?.type_ratio);
        if (Number.isFinite(ratio)) {
          objectiveValue = 5000 + ratio * 12_000;
        }
      } catch {
        // keep default
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          objectiveValue,
          portfolioResults: [],
          constraintViolations: [],
        }),
      });
    });
  }

  await page.goto(`${frontendUrl}/?__pw_debug=1`);

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
    .getByPlaceholder("e.g., {Price} * (Quantity) + {TaxRate} * 100")
    .fill("{staff_count} * (cost_rate_per_resource)");
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
  await page.getByRole("button", { name: /Constraints?/ }).click();
  await page.getByRole("button", { name: "Add Constraint" }).click();
  await page.getByPlaceholder("Constraint name").fill("staff count per region ratio");
  await page
    .getByPlaceholder("Constraint description")
    .fill("Percent of staff count per each region to total staff count <= 20%");
  await page.getByRole("button", { name: "Save" }).nth(1).click();
  await expect(page.getByText("staff count per region ratio").first()).toBeVisible();

  await page.getByRole("button", { name: "Add Constraint" }).click();
  await page.getByPlaceholder("Constraint name").fill("total cost per region ratio");
  await page
    .getByPlaceholder("Constraint description")
    .fill("Percent of total cost per each region to total cost of all regions <= 15%");
  await page.getByRole("button", { name: "Save" }).nth(1).click();
  await expect(page.getByText("staff count per region ratio").first()).toBeVisible();

  await page.getByRole("button", { name: "Add Constraint" }).click();
  await page.getByPlaceholder("Constraint name").fill("senior to junior staff");
  await page
    .getByPlaceholder("Constraint description")
    .fill("ratio of number of senior staff to number of junior staff >= {type_ratio}");
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

  const typeRatios = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7];
  const scenariosTable = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Scenarios Table" }) });

  for (let i = 0; i < typeRatios.length; i++) {
    await page.getByRole("button", { name: "Create Scenario" }).click();
    const row = scenariosTable.locator("tbody tr").nth(i);
    await row.getByPlaceholder("Scenario name").fill(`Scenario ${typeRatios[i]}`);
    await row.locator('input[type="number"]').first().fill(String(typeRatios[i]));
  }

  for (let i = 0; i < typeRatios.length; i++) {
    const row = scenariosTable.locator("tbody tr").nth(i);

    // Real backend: assert the actual POST completes (OPTIONS preflight is a separate request).
    if (!useMockApi) {
      const postResponsePromise = page.waitForResponse(
        (r) =>
          r.url().includes("/api/run_scenario") &&
          r.request().method() === "POST",
        { timeout: 120000 }
      );
      await row.getByRole("button", { name: "Run" }).click();
      const postResp = await postResponsePromise;
      if (!postResp.ok()) {
        const body = await postResp.text().catch(() => "");
        throw new Error(
          `POST /api/run_scenario failed: ${postResp.status()} ${postResp.statusText()}${body ? ` — ${body.slice(0, 500)}` : ""}`
        );
      }
    } else {
      await row.getByRole("button", { name: "Run" }).click();
    }

    const completedInRow = row.getByText("Completed");
    if (useMockApi) {
      await expect(completedInRow).toBeVisible({ timeout: 10000 });
    } else {
      const errorLog = page.getByText(/Error running optimization:/).first();
      const raceResult = await Promise.race([
        completedInRow
          .waitFor({ state: "visible", timeout: 60000 })
          .then(() => "completed" as const),
        errorLog
          .waitFor({ state: "visible", timeout: 60000 })
          .then(() => "error" as const),
      ]);

      if (raceResult === "error") {
        const message = (await errorLog.textContent()) ?? "Unknown backend error";
        throw new Error(`Optimization failed on real backend: ${message}`);
      }
    }
  }

  await page.getByRole("button", { name: /Compare scenario/i }).click();
  await expect(page.getByRole("button", { name: /Back to table/i })).toBeVisible();
  const compareViewSection = page
    .locator("section")
    .filter({ has: page.getByRole("button", { name: /Back to table/i }) });
  // The compare chart may use either canvas or SVG depending on the ECharts renderer.
  const compareCanvas = compareViewSection.locator("canvas").first();
  const canvasCount = await compareCanvas.count();
  if (canvasCount > 0) {
    await expect(compareCanvas).toBeVisible({ timeout: 15000 });
  } else {
    await expect(compareViewSection.locator("svg").first()).toBeVisible({
      timeout: 15000,
    });
  }

  const debugRows = await page.evaluate(() => {
    const w = window as Window & {
      __WHAT_IF_DEBUG_SCENARIOS__?: Array<{
        id: number;
        name: string;
        isCompleted: boolean;
        isRunning: boolean;
        objectiveValue: number | null;
      }>;
    };
    return w.__WHAT_IF_DEBUG_SCENARIOS__ ?? null;
  });

  const compareChartDebug = await page.evaluate(() => {
    return (window as any).__WHAT_IF_COMPARE_CHART_DEBUG__ ?? null;
  });

  const compareChartDomDebug = {
    svgCount: await compareViewSection.locator("svg").count(),
    canvasCount: canvasCount,
    rectCount: await compareViewSection.locator("svg rect").count(),
    pathCount: await compareViewSection.locator("svg path").count(),
    canvasCountInDom: canvasCount,
  };

  const debugPath = path.resolve(__dirname, "../test-results/playwright-compare-debug.json");
  writeFileSync(debugPath, JSON.stringify(debugRows, null, 2), "utf-8");
  await test.info().attach("playwright-compare-debug.json", { path: debugPath });

  const compareChartDebugPath = path.resolve(
    __dirname,
    "../test-results/playwright-compare-chart-debug.json"
  );
  writeFileSync(
    compareChartDebugPath,
    JSON.stringify(
      { ...compareChartDebug, dom: compareChartDomDebug },
      null,
      2
    ),
    "utf-8"
  );
  await test.info().attach("playwright-compare-chart-debug.json", {
    path: compareChartDebugPath,
  });

  const overlayAlignmentDebug = await page.evaluate(() => {
    const circles = Array.from(
      document.querySelectorAll('circle[data-testid="flat-overlay-point"]')
    ) as SVGCircleElement[];

    const circleCenters = circles.map((c) => {
      const cx = Number(c.getAttribute("cx") ?? NaN);
      const cy = Number(c.getAttribute("cy") ?? NaN);
      return { cx, cy, r: Number(c.getAttribute("r") ?? NaN) };
    });

    const names = (window as any).__WHAT_IF_COMPARE_CHART_DEBUG__?.names as
      | string[]
      | undefined;

    const container = circles[0]?.closest("svg")?.closest("div") as HTMLElement | null;
    const containerRect = container?.getBoundingClientRect();

    if (!names || !containerRect) {
      return { circleCount: circleCenters.length, circleCenters, names: names ?? null };
    }

    const labelCenters: Record<string, { x: number; y: number }> = {};
    for (const name of names) {
      const textEl = Array.from(container?.querySelectorAll("text") ?? []).find((t) => {
        const tt = (t.textContent ?? "").trim();
        return tt === name;
      }) as SVGTextElement | undefined;
      if (!textEl) continue;
      const bb = textEl.getBoundingClientRect();
      labelCenters[name] = {
        x: bb.left - containerRect.left + bb.width / 2,
        y: bb.top - containerRect.top + bb.height / 2,
      };
    }

    const deltas = names.map((name, i) => {
      const c = circleCenters[i];
      const l = labelCenters[name];
      if (!c || !l || !Number.isFinite(c.cx) || !Number.isFinite(l.x)) {
        return { name, i, deltaX: null };
      }
      return { name, i, deltaX: c.cx - l.x };
    });

    return { circleCount: circleCenters.length, circleCenters, labelCenters, deltas };
  });

  const overlayAlignPath = path.resolve(
    __dirname,
    "../test-results/playwright-overlay-alignment-debug.json"
  );
  writeFileSync(
    overlayAlignPath,
    JSON.stringify(overlayAlignmentDebug, null, 2),
    "utf-8"
  );
  await test.info().attach("playwright-overlay-alignment-debug.json", {
    path: overlayAlignPath,
  });

  expect(debugRows, "__WHAT_IF_DEBUG_SCENARIOS__ missing (need ?__pw_debug=1)").not.toBeNull();
  expect(debugRows!.length).toBe(typeRatios.length);
  expect(
    compareChartDebug,
    "__WHAT_IF_COMPARE_CHART_DEBUG__ missing"
  ).not.toBeNull();
  for (let i = 0; i < debugRows!.length; i++) {
    const r = debugRows![i];
    expect(r.isCompleted, `row ${i} ${r.name} should be completed`).toBe(true);
    expect(r.objectiveValue, `row ${i} ${r.name} should have objectiveValue`).not.toBeNull();
    expect(Number.isFinite(r.objectiveValue!), `row ${i} ${r.name} objectiveValue finite`).toBe(
      true
    );
  }

  const compareChartPath = path.resolve(
    __dirname,
    "../test-results/e2e-compare-scenario-line-chart.png"
  );
  await page.screenshot({ path: compareChartPath, fullPage: true });

  await page.getByRole("button", { name: /Back to table/i }).click();
  await expect(page.getByRole("heading", { name: "Scenarios Table" })).toBeVisible();

  await page.getByRole("button", { name: /Result/i }).first().click();

  const resultsPaneScroll = page.locator('[class*="max-w-7xl"] div.custom-scrollbar').nth(1);
  await expect(resultsPaneScroll).toBeVisible();
  await resultsPaneScroll.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await page.screenshot({
    path: "test-results/e2e-results-table-scrolled.png",
    fullPage: true,
  });

  await page.getByTitle("Bar chart — row-level CP-SAT inputs").click();
  await expect(page.getByText("Row input variables (optimized values)")).toBeVisible();
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 15000 });

  await page.screenshot({
    path: "test-results/e2e-bar-chart.png",
    fullPage: true,
  });

  await resultsPaneScroll.evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
  });
  await page.screenshot({
    path: "test-results/e2e-final-state.png",
    fullPage: true,
  });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export CSV/i }).click();
  const download = await downloadPromise;
  const exportPath = path.resolve(__dirname, "../test-results/e2e-optimization-results.csv");
  await download.saveAs(exportPath);
});
