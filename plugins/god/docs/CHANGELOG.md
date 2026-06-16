# god 文档 changelog

> CLAUDE.md §10 的详细变更历史。**本文件不重复 CLAUDE.md 摘要**，只展开每版做了什么。

## v0.4.1 (2026-06-16)

**状态同步** —— v0.4.0 落地后，文档与实现错位修复。

- `docs/roadmap.md`：P0 4 块（G1/G2/G3/G8）标 ✅ 已落；M1 里程碑标"已完成"；删除 P0 详细定义段（落到 RFC/ADR）
- `CLAUDE.md §5`：从"差 10 块"改为"P0 已闭环，剩 6 块"
- `docs/spec-directory.md §2`：去掉 `spec-cli.js` / `spec-summary.js` 的"(规划)"标记
- `CLAUDE.md §10 v0.4.0 段`：压成 2 行，详细 changelog 移本文档

## v0.4.0 (2026-06-16)

**3 视角全景演练 + G8 真实实现**。

- **文档**：`docs/perspectives/` 3 份（01-ops 933 行 / 02-dev 742 行 / 03-architect 796 行），含业务/开发/设计/产品 4 类闭环
- **规约**：`docs/conventions.md §1.8` ADR/RFC 4 位补零编号 + 核心数据改必走 RFC
- **RFC-0001** spec-cli 状态机 + **ADR-0001** 6 vs 4 状态决议
- **G8 真实落地**（D2 P0）：`spec/scripts/spec-summary.js` + 11/11 单元测试 + 模板 v0.1.0 + `commands/prd.md §2.5` 自动跑 gen；RFC-0002 转 ADR-0002
- **v0.4.0+ 演进 4 个未做项**：G1+G2 捆绑实现（RFC-0001 待开）、G3 hooks 集成、OPC 预算分级归因

## v0.3.0 (2026-06-16)

**OPC 定位**。§1.1 4 产品目标 + 1 系统目标 + 6 文档全部从"PM/AI/程序员协作"切到"OPC × AI 外骨骼"。新增 §1.3 OPC 注意力预算（< 30 分钟 / feature）。G8 spec-summary 由 P1 升级为 P0（目标 1 唯一验收手段）。

## v0.2.0 (2026-06-16)

补齐 6 子文档（architecture/conventions/human-ai-contract/failure-modes/roadmap/spec-directory），建 `docs/incidents/` 与 `templates/hooks/` 脚手架。索引图"待建"标识全部清除。

## v0.1.0 (2026-06-16)

初版索引地图。
