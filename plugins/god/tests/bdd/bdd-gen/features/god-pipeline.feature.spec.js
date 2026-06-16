// Generated from: tests/bdd/features/god-pipeline.feature
import { test } from "../../fixtures.js";

test.describe('God Pipeline Self-Acceptance', () => {

  test('dev-gen 从 spec.feature 产出带 @spec 标注的骨架', { tag: ['@SC-001', '@happy'] }, async ({ Given, When, Then, And, api }) => { 
    await Given('干净的临时项目 "god-bdd-acceptance"', null, { api }); 
    await And('写入 feature 含 2 个 SC', null, { api }); 
    await When('跑 dev-gen', null, { api }); 
    await Then('退出码为 0', null, { api }); 
    await And('源代码骨架文件含 2 个 @spec 标注', null, { api }); 
  });

  test('dev-gen 缺 spec 目录时报错', { tag: ['@SC-002', '@sad-path'] }, async ({ Given, When, Then, And, api }) => { 
    await Given('干净的临时项目 "god-bdd-acceptance"', null, { api }); 
    await And('删除 spec 目录', null, { api }); 
    await When('跑 dev-gen', null, { api }); 
    await Then('退出码非 0', null, { api }); 
  });

  test('test-gen 从 spec.feature 产出带 SC-xxx 命名的测试桩', { tag: ['@SC-003', '@happy'] }, async ({ Given, When, Then, And, api }) => { 
    await Given('干净的临时项目 "god-bdd-acceptance"', null, { api }); 
    await And('写入 feature 含 2 个 SC', null, { api }); 
    await When('跑 test-gen', null, { api }); 
    await Then('退出码为 0', null, { api }); 
    await And('测试桩文件含 SC-001 和 SC-002 命名', null, { api }); 
  });

  test('spec-validate 14 项全过', { tag: ['@SC-004', '@happy'] }, async ({ Given, When, Then, And, api }) => { 
    await Given('干净的临时项目 "god-bdd-acceptance"', null, { api }); 
    await And('写入 feature 含 2 个 SC', null, { api }); 
    await When('跑 spec-validate', null, { api }); 
    await Then('退出码为 0', null, { api }); 
    await And('输出含 "PASS"', null, { api }); 
  });

  test('spec-render 产出 review.md 含 4 维评分草稿', { tag: ['@SC-005', '@happy'] }, async ({ Given, When, Then, And, api }) => { 
    await Given('干净的临时项目 "god-bdd-acceptance"', null, { api }); 
    await And('写入 feature 含 2 个 SC', null, { api }); 
    await When('跑 spec-render', null, { api }); 
    await Then('退出码为 0', null, { api }); 
    await And('评审报告含 D1 D2 D3 D4 四节', null, { api }); 
  });

  test('完整闭环：dev-gen → test-gen → spec-validate 全过', { tag: ['@SC-006', '@happy'] }, async ({ Given, When, Then, And, api }) => { 
    await Given('干净的临时项目 "god-bdd-acceptance"', null, { api }); 
    await And('写入 feature 含 2 个 SC', null, { api }); 
    await When('顺序跑 dev-gen + test-gen + spec-validate', null, { api }); 
    await Then('全部退出码为 0', null, { api }); 
    await And('源代码骨架文件含 @spec 标注', null, { api }); 
    await And('测试桩文件含 SC 命名', null, { api }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('tests/bdd/features/god-pipeline.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":6,"pickleLine":6,"tags":["@SC-001","@happy"],"steps":[{"pwStepLine":7,"gherkinStepLine":7,"keywordType":"Context","textWithKeyword":"Given 干净的临时项目 \"god-bdd-acceptance\"","stepMatchArguments":[{"group":{"start":8,"value":"\"god-bdd-acceptance\"","children":[{"start":9,"value":"god-bdd-acceptance","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":8,"gherkinStepLine":8,"keywordType":"Context","textWithKeyword":"And 写入 feature 含 2 个 SC","stepMatchArguments":[]},{"pwStepLine":9,"gherkinStepLine":9,"keywordType":"Action","textWithKeyword":"When 跑 dev-gen","stepMatchArguments":[]},{"pwStepLine":10,"gherkinStepLine":10,"keywordType":"Outcome","textWithKeyword":"Then 退出码为 0","stepMatchArguments":[]},{"pwStepLine":11,"gherkinStepLine":11,"keywordType":"Outcome","textWithKeyword":"And 源代码骨架文件含 2 个 @spec 标注","stepMatchArguments":[]}]},
  {"pwTestLine":14,"pickleLine":14,"tags":["@SC-002","@sad-path"],"steps":[{"pwStepLine":15,"gherkinStepLine":15,"keywordType":"Context","textWithKeyword":"Given 干净的临时项目 \"god-bdd-acceptance\"","stepMatchArguments":[{"group":{"start":8,"value":"\"god-bdd-acceptance\"","children":[{"start":9,"value":"god-bdd-acceptance","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":16,"gherkinStepLine":16,"keywordType":"Context","textWithKeyword":"And 删除 spec 目录","stepMatchArguments":[]},{"pwStepLine":17,"gherkinStepLine":17,"keywordType":"Action","textWithKeyword":"When 跑 dev-gen","stepMatchArguments":[]},{"pwStepLine":18,"gherkinStepLine":18,"keywordType":"Outcome","textWithKeyword":"Then 退出码非 0","stepMatchArguments":[]}]},
  {"pwTestLine":21,"pickleLine":21,"tags":["@SC-003","@happy"],"steps":[{"pwStepLine":22,"gherkinStepLine":22,"keywordType":"Context","textWithKeyword":"Given 干净的临时项目 \"god-bdd-acceptance\"","stepMatchArguments":[{"group":{"start":8,"value":"\"god-bdd-acceptance\"","children":[{"start":9,"value":"god-bdd-acceptance","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":23,"gherkinStepLine":23,"keywordType":"Context","textWithKeyword":"And 写入 feature 含 2 个 SC","stepMatchArguments":[]},{"pwStepLine":24,"gherkinStepLine":24,"keywordType":"Action","textWithKeyword":"When 跑 test-gen","stepMatchArguments":[]},{"pwStepLine":25,"gherkinStepLine":25,"keywordType":"Outcome","textWithKeyword":"Then 退出码为 0","stepMatchArguments":[]},{"pwStepLine":26,"gherkinStepLine":26,"keywordType":"Outcome","textWithKeyword":"And 测试桩文件含 SC-001 和 SC-002 命名","stepMatchArguments":[]}]},
  {"pwTestLine":29,"pickleLine":29,"tags":["@SC-004","@happy"],"steps":[{"pwStepLine":30,"gherkinStepLine":30,"keywordType":"Context","textWithKeyword":"Given 干净的临时项目 \"god-bdd-acceptance\"","stepMatchArguments":[{"group":{"start":8,"value":"\"god-bdd-acceptance\"","children":[{"start":9,"value":"god-bdd-acceptance","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":31,"gherkinStepLine":31,"keywordType":"Context","textWithKeyword":"And 写入 feature 含 2 个 SC","stepMatchArguments":[]},{"pwStepLine":32,"gherkinStepLine":32,"keywordType":"Action","textWithKeyword":"When 跑 spec-validate","stepMatchArguments":[]},{"pwStepLine":33,"gherkinStepLine":33,"keywordType":"Outcome","textWithKeyword":"Then 退出码为 0","stepMatchArguments":[]},{"pwStepLine":34,"gherkinStepLine":34,"keywordType":"Outcome","textWithKeyword":"And 输出含 \"PASS\"","stepMatchArguments":[{"group":{"start":4,"value":"\"PASS\"","children":[{"start":5,"value":"PASS","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
  {"pwTestLine":37,"pickleLine":37,"tags":["@SC-005","@happy"],"steps":[{"pwStepLine":38,"gherkinStepLine":38,"keywordType":"Context","textWithKeyword":"Given 干净的临时项目 \"god-bdd-acceptance\"","stepMatchArguments":[{"group":{"start":8,"value":"\"god-bdd-acceptance\"","children":[{"start":9,"value":"god-bdd-acceptance","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":39,"gherkinStepLine":39,"keywordType":"Context","textWithKeyword":"And 写入 feature 含 2 个 SC","stepMatchArguments":[]},{"pwStepLine":40,"gherkinStepLine":40,"keywordType":"Action","textWithKeyword":"When 跑 spec-render","stepMatchArguments":[]},{"pwStepLine":41,"gherkinStepLine":41,"keywordType":"Outcome","textWithKeyword":"Then 退出码为 0","stepMatchArguments":[]},{"pwStepLine":42,"gherkinStepLine":42,"keywordType":"Outcome","textWithKeyword":"And 评审报告含 D1 D2 D3 D4 四节","stepMatchArguments":[]}]},
  {"pwTestLine":45,"pickleLine":45,"tags":["@SC-006","@happy"],"steps":[{"pwStepLine":46,"gherkinStepLine":46,"keywordType":"Context","textWithKeyword":"Given 干净的临时项目 \"god-bdd-acceptance\"","stepMatchArguments":[{"group":{"start":8,"value":"\"god-bdd-acceptance\"","children":[{"start":9,"value":"god-bdd-acceptance","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":47,"gherkinStepLine":47,"keywordType":"Context","textWithKeyword":"And 写入 feature 含 2 个 SC","stepMatchArguments":[]},{"pwStepLine":48,"gherkinStepLine":48,"keywordType":"Action","textWithKeyword":"When 顺序跑 dev-gen + test-gen + spec-validate","stepMatchArguments":[]},{"pwStepLine":49,"gherkinStepLine":49,"keywordType":"Outcome","textWithKeyword":"Then 全部退出码为 0","stepMatchArguments":[]},{"pwStepLine":50,"gherkinStepLine":50,"keywordType":"Outcome","textWithKeyword":"And 源代码骨架文件含 @spec 标注","stepMatchArguments":[]},{"pwStepLine":51,"gherkinStepLine":51,"keywordType":"Outcome","textWithKeyword":"And 测试桩文件含 SC 命名","stepMatchArguments":[]}]},
]; // bdd-data-end