// ==DroidScript==
// @id              wework-practice-checkin
// @name            企业微信实践签到
// @description     自动打开企业微信并完成实践签到（工作台 -> 智慧研究生 -> 实践签到 -> 签到）
// @author          user
// @version         1.0.0
// @targetApp       com.tencent.wework
// @url             https://github.com/tas33n/droidwright
// @created         2026-08-13
// ==/DroidScript==

/**
 * 企业微信 - 实践签到 自动签到脚本
 * 运行环境：DroidWright (QuickJS)
 *
 * 流程：
 *   启动企业微信 -> 工作台 -> 智慧研究生 -> 实践签到 -> 签到 -> 校验"签到成功"
 *
 * 说明：
 *   - DroidWright 运行时提供的全局日志函数为 log()（等价于 console.log 的日志输出）
 *   - 每个关键步骤都会等待元素出现（10 秒超时），失败则输出错误并停止
 *   - @targetApp 元数据会作为全局变量 targetApp 注入，见下方 targetPackage 的定义
 */

function droidRun(ctx) {
    // ===== 常量定义 =====
    // 优先使用 @targetApp 元数据注入的全局变量 targetApp，缺失时回退到硬编码包名
    const targetPackage = typeof targetApp === "string" ? targetApp : "com.tencent.wework";
    const WAIT_TIMEOUT = 10000;           // 元素等待超时：10 秒
    const STEP_WAIT = 3000;               // 步骤间等待：3 秒

    // ===== 工具函数 =====
    /**
     * 等待元素出现并点击（支持多组备选选择器，按顺序尝试，提高健壮性）
     * @param {Array|Object} selectors 选择器对象，或选择器对象数组
     * @param {string} stepName 步骤名称（用于日志）
     * @returns {boolean} 是否成功
     */
    function waitAndTap(selectors, stepName) {
        const list = Array.isArray(selectors) ? selectors : [selectors];

        for (const sel of list) {
            log(`[${stepName}] 等待元素: ${JSON.stringify(sel)}`);
            if (!ctx.ui.waitFor(sel, WAIT_TIMEOUT)) {
                log(`[${stepName}] 10 秒内未找到该元素，尝试下一个选择器...`);
                continue;
            }

            ctx.device.sleep(500); // 元素出现后稍等，确保可点击
            if (ctx.ui.tap(sel)) {
                log(`[${stepName}] 点击成功`);
                return true;
            }
            log(`[${stepName}] 元素已找到但点击失败，尝试下一个选择器...`);
        }

        log(`[错误] ${stepName}: 所有选择器均失败`);
        return false;
    }

    // ===== 主流程 =====
    try {
        log("========== 企业微信实践签到脚本启动 ==========");

        // 步骤 1：启动企业微信
        log("[1/6] 正在启动企业微信...");
        if (!ctx.app.launch(targetPackage)) {
            log("[错误] 启动企业微信失败");
            return { status: "error", note: "启动企业微信失败" };
        }
        ctx.device.sleep(5000); // 等待 5 秒，确保应用加载完成
        log("[1/6] 企业微信已启动");

        // 步骤 2：点击"工作台"
        if (!waitAndTap(
            [
                { text: "工作台", id: "i20" }, // 优先使用 text + id 组合定位
                { text: "工作台" }             // 降级：仅用 text 定位
            ],
            "2/6 工作台"
        )) {
            return { status: "error", note: "未找到或无法点击“工作台”" };
        }
        ctx.device.sleep(STEP_WAIT);

        // 步骤 3：点击"智慧研究生"
        if (!waitAndTap(
            [
                { text: "智慧研究生", id: "mid1txt" }, // 优先使用 text + id 组合定位
                { text: "智慧研究生" }                  // 降级：仅用 text 定位
            ],
            "3/6 智慧研究生"
        )) {
            return { status: "error", note: "未找到或无法点击“智慧研究生”" };
        }
        ctx.device.sleep(STEP_WAIT);

        // 步骤 4：点击"实践签到"（进入 JsWebActivity 网页）
        if (!waitAndTap(
            [
                { text: "实践签到" }
            ],
            "4/6 实践签到"
        )) {
            return { status: "error", note: "未找到或无法点击“实践签到”" };
        }
        ctx.device.sleep(STEP_WAIT);

        // 步骤 5：若页面已显示"签到成功"，说明今日已签到，直接结束
        if (ctx.ui.exists({ text: "签到成功" })) {
            log("[提示] 检测到“签到成功”，今日已签到，脚本结束");
            return { status: "ok", note: "今日已签到成功" };
        }

        // 步骤 6：点击"签到"按钮
        if (!waitAndTap(
            [
                { text: "签到" }
            ],
            "5/6 签到"
        )) {
            return { status: "error", note: "未找到或无法点击“签到”" };
        }
        ctx.device.sleep(STEP_WAIT);

        // 步骤 7：校验签到结果
        log("[6/6] 正在校验签到结果...");
        if (ctx.ui.waitFor({ text: "签到成功" }, WAIT_TIMEOUT)) {
            log("[6/6] 签到成功！");
            ctx.device.showToast("签到成功");
            return { status: "ok", note: "签到成功" };
        }

        log("[警告] 未检测到“签到成功”提示，请人工确认");
        return { status: "error", note: "未检测到签到成功提示" };
    } catch (error) {
        log(`[异常] ${error && error.message ? error.message : error}`);
        return { status: "error", note: "脚本执行异常" };
    }
}
