Feature: God Pipeline Self-Acceptance
  作为 god 用户，我想 god 的 dev-gen / test-gen / spec-validate / spec-render
  能在真实场景下输出符合规范的产物，以便我能信任 god 跑我的真实项目。

  @SC-001 @happy
  Scenario: dev-gen 从 spec.feature 产出带 @spec 标注的骨架
    Given 干净的临时项目 "god-bdd-acceptance"
    And 写入 feature 含 2 个 SC
    When 跑 dev-gen
    Then 退出码为 0
    And 源代码骨架文件含 2 个 @spec 标注

  @SC-002 @sad-path
  Scenario: dev-gen 缺 spec 目录时报错
    Given 干净的临时项目 "god-bdd-acceptance"
    And 删除 spec 目录
    When 跑 dev-gen
    Then 退出码非 0

  @SC-003 @happy
  Scenario: test-gen 从 spec.feature 产出带 SC-xxx 命名的测试桩
    Given 干净的临时项目 "god-bdd-acceptance"
    And 写入 feature 含 2 个 SC
    When 跑 test-gen
    Then 退出码为 0
    And 测试桩文件含 SC-001 和 SC-002 命名

  @SC-004 @happy
  Scenario: spec-validate 14 项全过
    Given 干净的临时项目 "god-bdd-acceptance"
    And 写入 feature 含 2 个 SC
    When 跑 spec-validate
    Then 退出码为 0
    And 输出含 "PASS"

  @SC-005 @happy
  Scenario: spec-render 产出 review.md 含 4 维评分草稿
    Given 干净的临时项目 "god-bdd-acceptance"
    And 写入 feature 含 2 个 SC
    When 跑 spec-render
    Then 退出码为 0
    And 评审报告含 D1 D2 D3 D4 四节

  @SC-006 @happy
  Scenario: 完整闭环：dev-gen → test-gen → spec-validate 全过
    Given 干净的临时项目 "god-bdd-acceptance"
    And 写入 feature 含 2 个 SC
    When 顺序跑 dev-gen + test-gen + spec-validate
    Then 全部退出码为 0
    And 源代码骨架文件含 @spec 标注
    And 测试桩文件含 SC 命名