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
 *   - log() 为 DroidWright 提供的日志函数，等价于 console.log 输出到控制台
 *   - 每个关键步骤都会等待元素出现（10 秒超时），失败则输出错误并停止
 *   - 签到按钮文字有两种状态：
 *       在考勤范围内 -> "正常签到"
 *       超出考勤范围 -> "外勤签到"（需填写外勤原因）
 *   - @targetApp 元数据会作为全局变量 targetApp 注入，见下方 targetPackage
 */
function droidRun(ctx) {
    // ===== 常量定义 =====
    // 优先使用 @targetApp 元数据注入的全局变量 targetApp，缺失时回退到硬编码包名
    const targetPackage = typeof targetApp === "string" ? targetApp : "com.tencent.wework";
    const WAIT_TIMEOUT = 10000;   // 单步元素等待超时：10 秒
    const STEP_WAIT = 3000;       // 步骤间等待：3 秒
    const WQ_REASON = "外出办事";  // 外勤签到原因（仅在超出考勤范围时使用，可自行修改）

    // ===== 工具函数 =====

    /**
     * 输出日志（DroidWright 日志函数 log，等价于 console.log）
     */
    function info(msg) {
        log(msg);
    }

    /**
     * 等待元素出现并点击，支持多组备选选择器（按顺序尝试）。
     * 全部失败时打印当前 UI 树，便于定位真实元素。
     * @param {Object|Object[]} selectors 选择器对象，或选择器对象数组
     * @param {string} stepName 步骤名称（用于日志）
     * @returns {boolean} 是否找到并执行点击
     */
    function waitAndTap(selectors, stepName) {
        const list = Array.isArray(selectors) ? selectors : [selectors];

        for (const sel of list) {
            info(`[${stepName}] 等待元素: ${JSON.stringify(sel)}`);
            if (ctx.ui.waitFor(sel, WAIT_TIMEOUT)) {
                ctx.device.sleep(500); // 元素出现后稍等，确保可点击
                const ok = ctx.ui.tap(sel);
                info(`[${stepName}] 点击${ok ? "成功" : "已执行"}`);
                return true;
            }
            info(`[${stepName}] 未找到该选择器，尝试下一个...`);
        }

        // 全部失败：打印当前 UI 树辅助定位
        // 注意：实践签到页面为 WebView，网页元素层级较深，depth 需给大值才能打印到按钮
        info(`[错误] ${stepName}: 所有选择器均失败，当前 UI 树：`);
        try {
            info(JSON.stringify(ctx.ui.dumpTree(30)));
        } catch (e) {
            info(`dumpTree 失败: ${e && e.message ? e.message : e}`);
        }
        return false;
    }

    // ===== 主流程 =====
    try {
        info("========== 企业微信实践签到脚本启动 ==========");

        // 步骤 1：启动企业微信
        info("[1/6] 正在启动企业微信...");
        if (!ctx.app.launch(targetPackage)) {
            info("[错误] 启动企业微信失败");
            return { status: "error", note: "启动企业微信失败" };
        }
        ctx.device.sleep(5000); // 等待 5 秒，确保应用加载完成
        info("[1/6] 企业微信已启动");

        // 步骤 2：点击"工作台"
        if (!waitAndTap(
            [
                { text: "工作台", id: "i20" }, // 优先：text + id 组合定位
                { text: "工作台" }             // 降级：仅用 text 定位
            ],
            "2/6 工作台"
        )) {
            return { status: "error", note: "未找到或无法点击“工作台”" };
        }
        ctx.device.sleep(STEP_WAIT);

        // 步骤 3：点击"智慧研究生"
        // 实测：id "mid1txt" 在真机上未匹配到，直接使用 text 定位
        if (!waitAndTap(
            [
                { text: "智慧研究生" }
            ],
            "3/6 智慧研究生"
        )) {
            return { status: "error", note: "未找到或无法点击“智慧研究生”" };
        }
        ctx.device.sleep(STEP_WAIT);

        // 步骤 4：点击"实践签到"（进入 JsWebActivity 网页）
        if (!waitAndTap([{ text: "实践签到" }], "4/6 实践签到")) {
            return { status: "error", note: "未找到或无法点击“实践签到”" };
        }
        ctx.device.sleep(STEP_WAIT);

        // 步骤 5：若页面已显示"签到成功"，说明今日已签到，直接结束
        if (ctx.ui.exists({ text: "签到成功" })) {
            info("[5/6] 检测到“签到成功”，今日已签到，脚本结束");
            return { status: "ok", note: "今日已签到成功" };
        }

        // 步骤 5（续）：点击签到按钮
        // 在考勤范围内 -> "正常签到"；超出范围 -> "外勤签到"
        const inRange = ctx.ui.exists({ text: "正常签到" });
        const outRange = ctx.ui.exists({ text: "外勤签到" });

        if (inRange) {
            // 正常签到：在考勤范围内，直接签到
            if (!waitAndTap(
                [
                    { text: "正常签到" },  // 优先按文字定位
                    { id: "clockin" }      // 降级：按按钮 id 定位
                ],
                "5/6 正常签到"
            )) {
                return { status: "error", note: "未找到或无法点击“正常签到”按钮" };
            }
        } else if (outRange) {
            // 外勤签到：超出考勤范围，需先填写外勤原因
            if (!waitAndTap(
                [
                    { text: "外勤签到" },
                    { id: "clockin" }
                ],
                "5/6 外勤签到"
            )) {
                return { status: "error", note: "未找到或无法点击“外勤签到”按钮" };
            }
            ctx.device.sleep(1000);

            // 填写外勤原因
            info("[5/6] 正在填写外勤原因...");
            ctx.ui.setText({ id: "ExternalReasons" }, WQ_REASON);
            ctx.device.sleep(500);

            // 点击"仍要签到"
            if (!waitAndTap(
                [
                    { text: "仍要签到" },
                    { id: "wq_clock" }
                ],
                "5/6 仍要签到"
            )) {
                return { status: "error", note: "未找到或无法点击“仍要签到”按钮" };
            }
        } else {
            // 降级：按文字"签到"尝试
            if (!waitAndTap(
                [
                    { text: "签到" },
                    { id: "clockin" }
                ],
                "5/6 签到"
            )) {
                return { status: "error", note: "未找到签到按钮" };
            }
        }
        ctx.device.sleep(STEP_WAIT);

        // 步骤 6：校验签到结果
        info("[6/6] 正在校验签到结果...");
        if (ctx.ui.waitFor({ text: "签到成功" }, WAIT_TIMEOUT)) {
            info("[6/6] 签到成功！");
            ctx.device.showToast("签到成功");
            return { status: "ok", note: "签到成功" };
        }
        if (ctx.ui.exists({ text: "签到成功" })) {
            return { status: "ok", note: "签到成功" };
        }

        info("[警告] 未检测到“签到成功”提示，请人工确认");
        return { status: "error", note: "未检测到“签到成功”提示" };
    } catch (error) {
        info(`[异常] ${error && error.message ? error.message : error}`);
        return { status: "error", note: "脚本执行异常" };
    }
}
