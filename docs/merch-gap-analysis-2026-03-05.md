# Merchandising Gap Analysis (2026-03-05)

## 参考资料
- `Merchandising Principles/Merchandising Principles.pdf`（已导出并核对关键图示页）
- `Merchandising Principles/merchandising_principles_extracted.txt`
- 关键规则页：3/5/6/7/8/10/11/13

## 现状与差距（按优先级）

### P0 - 交互方向与心智模型不一致
- 原实现使用左右等待区（left/right），但原则图示和现场操作更接近“桌面上侧/下侧”对齐。
- 双面场景在视觉上是上下对齐，输入却是左右，学习成本高。

### P0 - 画布图形表达过于细碎，尺寸信息不够突出
- 原实现设备是小深色轮廓，尺寸感不清晰。
- 原则图更偏“抽象符号 + 距离标注（A/B/X/Y/Z）”，重点是可读性和可解释。

### P0 - 计算可解释性链路未闭环
- `calc.js` 已返回 `trace`，但 UI 未展示，无法让用户复核“怎么算出来的”。

### P1 - 双侧输入未真正参与计算
- 当前非 assortment 场景只计算主侧队列，另一侧主要用于数量校验。
- 与原则中“先做一侧，再对侧按中心对齐”的流程还不完全一致。

### P1 - 规则版本化与回放能力不足
- `ruleVersion` 目前是 `local-dev`，无独立规则集存储，无“按版本重算”。

### P1 - 云端能力仍是前端 mock
- `api.js` 仍为 mock fallback，账户、布局版本、审计未落地。

### P2 - 标准库平台化未完成
- 目录项来自本地静态 DB，缺少生效日期、上下线、审核发布与批量导入机制。

## 本次已完成改动

1. 上下等待区改造
- UI 文案与布局从“左/右”改为“上侧/下侧”。
- 页面结构改为“上侧等待区 -> 画布 -> 下侧等待区”，与桌面阅读方向一致。

2. 画布符号改造
- 设备渲染从小轮廓改为“统一符号卡 + 设备 glyph + 宽度文本”。
- 目标是突出尺寸和排布关系，而非仿真外观。

3. Trace 可解释性接入
- 计算后显示 `trace-panel`，支持展开/收起步骤。

4. 双面真实计算与偏差控制
- 新增 `calcDoubleSide()`，上下两侧独立计算并输出 `alignment.pairs`。
- 支持容差 1" 与微调上限 1.5" 的状态分级：`aligned` / `minor-adjust` / `major-misalignment`。
- 画布双面连线按状态上色，结果面板展示每组 `Δcenter` 与告警。

5. 规则版本化
- 新增内置规则集 `Merch v2025.11`，UI 可选择 `ruleVersion`。
- 草稿保存、云端保存、计算结果都绑定 `ruleVersion`。

6. MySQL 后端骨架
- 新增 `server/`（Fastify + Prisma + MySQL schema + Auth/Layout/Rules/Catalog/Audit 路由）。
- `layout_versions` 持久化 `ruleVersion + inputPayload + computedResult`，支持回放追溯。

## 建议的下一步（可直接执行）

1. 双侧真实计算闭环（P0）
- 为双面场景引入 `calcDoubleSide()`：
  - 先计算上侧；
  - 下侧按中心线对齐；
  - 输出对齐偏差与可允许微调（1"~1.5"）警告。

2. 规则引擎版本化（P1）
- 新增 `rule_sets`（规则公式、参数表、舍入策略、异常策略）。
- 布局保存时绑定 `rule_version`，支持“历史回放重算”。

3. 数据库与服务（P1）
- 推荐先 `MySQL + Prisma + Fastify`：
  - 表：`users`, `stores`, `layouts`, `layout_versions`, `catalog_items`, `rule_sets`, `audit_logs`。
  - API：`/auth`, `/layouts`, `/layouts/:id/versions`, `/catalog`, `/rules`。

4. 标准库后台（P2）
- 增加上下线状态、生效日期、导入（CSV/JSON）、草稿-审核-发布流。
