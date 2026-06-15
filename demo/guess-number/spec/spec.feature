@spec-version 1.1.0
Feature: 猜数字游戏
  作为玩家，我想猜一个 1-100 的数字，以便获得反馈逐步逼近答案

  @SC-001 @happy
  Scenario: 猜对数字
    Given 目标数字是 50
    When 玩家猜测 50
    Then 显示 "猜对了"

  @SC-002 @edge
  Scenario: 猜小了
    Given 目标数字是 50
    When 玩家猜测 30
    Then 显示 "太小了"

  @SC-003 @edge
  Scenario: 猜大了
    Given 目标数字是 50
    When 玩家猜测 80
    Then 显示 "太大了"

  @SC-004 @edge
  Scenario: 超过猜测次数限制
    Given 目标数字是 50 且最多允许猜测 7 次
    When 玩家连续猜错 7 次
    Then 显示 "游戏失败，次数用尽"
