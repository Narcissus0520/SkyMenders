import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("content authors can validate, package and stage without editing raw JSON", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:4311");
  await expect(page.getByRole("heading", { name: "地图与关卡" })).toBeVisible();
  await expect(page.getByText("材质画刷")).toBeVisible();
  await page.getByRole("button", { name: "完整校验" }).click();
  await expect(page.getByText(/校验通过/)).toBeVisible();
  await page.getByRole("button", { name: "生成确定性制品" }).click();
  await expect(page.getByText(/validated ·/)).toBeVisible();
  await page.getByRole("button", { name: "送入预发布" }).click();
  await expect(page.getByText(/staged ·/)).toBeVisible();
});

test("admin writes require isolated authentication and exact second confirmation", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:4312");
  await expect(page.getByRole("heading", { name: "独立管理身份验证" })).toBeVisible();
  await page
    .getByLabel("一次性引导凭证")
    .fill("e2e-admin-bootstrap-token-with-more-than-thirty-two-bytes");
  await page.getByRole("button", { name: "建立 15 分钟会话" }).click();
  await expect(page.getByRole("heading", { name: "总览" })).toBeVisible();
  await page.getByRole("button", { name: "内容版本" }).click();
  const hash = await page.locator(".version code").first().textContent();
  if (hash === null) throw new Error("content version hash is missing");
  await page.getByRole("button", { name: "批准" }).click();
  await page.getByLabel("批准原因").fill("E2E release evidence reviewed");
  await page.getByLabel("批准确认词").fill(`APPROVE CONTENT ${hash}`);
  await page.getByRole("button", { name: "二次确认执行" }).click();
  await expect(page.getByRole("heading", { name: "approved" })).toBeVisible();
  await page.getByRole("button", { name: "审计日志" }).click();
  await expect(page.getByText("content.approved")).toBeVisible();
  await expect(page.getByText("admin.session.created")).toBeVisible();
});

test("field-specific cross-catalog failures block publication", async ({ page }) => {
  await page.goto("http://127.0.0.1:4311");
  await page.getByRole("button", { name: /事件与教学/ }).click();
  await page.getByLabel("内容目录").selectOption("events");
  await page.getByLabel("$.events[0].titleKey").fill("event.missing_localization.title");
  await page.getByRole("button", { name: "写入内容" }).click();
  await expect(page.getByText(/内容目录已原子写入/)).toBeVisible();
  await page.getByRole("button", { name: "完整校验" }).click();
  await expect(page.getByText(/校验失败/)).toBeVisible();
  await expect(page.getByText("LOCALIZATION_KEY_MISSING")).toBeVisible();
});
