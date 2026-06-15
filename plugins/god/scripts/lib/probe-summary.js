#!/usr/bin/env node
/**
 * probe-summary.js
 * 探测摘要生成模块（adapter 机制）
 * 根据 uiLibrary 加载对应框架映射表，生成 dom-probe-summary.json 和 api-probe-summary.json
 *
 * 导出：
 *   buildDomProbeSummary(domProbeContent, skeletonData, uiLibrary, customHints)
 *   buildApiProbeSummary(apiSkeletonPath, apiProbeContent)
 *   detectUiLibrary(domProbeContent)
 */
"use strict";

const path = require("path");

// adapter 注册表
const ADAPTERS = {
  'element-plus': require('./adapters/element-plus-hints'),
  'ant-design': require('./adapters/ant-design-hints'),
  'naive-ui': require('./adapters/naive-ui-hints'),
  'vuetify': require('./adapters/vuetify-hints'),
};
const BASE_ADAPTER = require('./adapters/base-hints');

/**
 * 从 dom-probe.md 内容中自动检测 UI 框架
 */
function detectUiLibrary(domProbeContent) {
  if (!domProbeContent) return null;
  const prefixCounts = {};
  for (const [name, adapter] of Object.entries(ADAPTERS)) {
    if (!adapter.prefix) continue;
    const regex = new RegExp(`\\.${adapter.prefix.replace('-', '\\-')}`, 'g');
    const matches = domProbeContent.match(regex);
    prefixCounts[name] = matches ? matches.length : 0;
  }
  const best = Object.entries(prefixCounts).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : null;
}

/**
 * 获取交互提示（双层推断：data-testid 最优先 → cssClass → type 降级）
 */
function getInteractionHint(field, adapter, customHints) {
  // 优先级 0：有 data-testid 时直接用 getByTestId，无需复杂选择器
  if (field.testId || (field.selector && field.selector.startsWith("getByTestId("))) {
    const testId = field.testId || field.selector.match(/getByTestId\(['"]([^'"]+)['"]\)/)?.[1];
    if (testId) {
      const fieldType = (field.type || '').toLowerCase();
      const typeHint = (adapter.typeMap && adapter.typeMap[fieldType])
        ? adapter.typeMap[fieldType].hint
        : (BASE_ADAPTER.typeMap[fieldType] ? BASE_ADAPTER.typeMap[fieldType].hint : '');
      return `page.getByTestId('${testId}') 定位${typeHint ? '，' + typeHint : ''}`;
    }
  }

  // 优先级 1：自定义映射
  if (customHints) {
    const cssClasses = (field.cssClass || '').split(/\s+/);
    for (const cls of cssClasses) {
      if (customHints[cls]) return customHints[cls].hint || customHints[cls];
    }
  }

  // 优先级 2：第一层 cssClass 精确匹配
  if (field.cssClass && adapter.classMap) {
    const cssClasses = (field.cssClass || '').split(/\s+/);
    for (const cls of cssClasses) {
      if (adapter.classMap[cls]) return adapter.classMap[cls].hint;
    }
  }

  // 优先级 3：第二层 type 降级
  const fieldType = (field.type || '').toLowerCase();
  if (adapter.typeMap && adapter.typeMap[fieldType]) {
    return adapter.typeMap[fieldType].hint;
  }

  // 优先级 4：base adapter 降级
  if (BASE_ADAPTER.typeMap[fieldType]) {
    return BASE_ADAPTER.typeMap[fieldType].hint;
  }

  return '交互方式未知，需从 dom-probe.md 确认';
}

/**
 * 构建 DOM 探测摘要
 */
function buildDomProbeSummary(domProbeContent, skeletonData, uiLibrary, customHints) {
  if (!domProbeContent && !skeletonData) {
    return { pages: [], formFields: [], detectedLibrary: null };
  }

  // 自动检测 UI 框架
  const detected = uiLibrary || detectUiLibrary(domProbeContent);
  const adapter = ADAPTERS[detected] || BASE_ADAPTER;

  const summary = {
    detectedLibrary: detected,
    pages: [],
    formFields: [],
    features: [],
    multiInstanceWarnings: [],
  };

  // 多实例组件选择器计数
  if (domProbeContent) {
    const multiInstanceSelectors = [
      { pattern: /\.el-table[\s"'`>]/g, selector: '.el-table', recommendation: 'Use .last() or :visible' },
      { pattern: /\.el-tabs__item/g, selector: '.el-tabs__item', recommendation: 'Use .nth() with text match' },
      { pattern: /\.el-dialog__wrapper/g, selector: '.el-dialog__wrapper', recommendation: 'Use .last() or :visible' },
      { pattern: /\.el-form[\s"'`>.(]/g, selector: '.el-form', recommendation: 'Use parent container scoping' },
      { pattern: /\.el-tabs[\s"'`>.(]/g, selector: '.el-tabs', recommendation: 'Use parent container scoping' },
    ];
    for (const { pattern, selector, recommendation } of multiInstanceSelectors) {
      const matches = domProbeContent.match(pattern);
      const count = matches ? matches.length : 0;
      if (count > 2) {
        summary.multiInstanceWarnings.push({ selector, count, recommendation });
      }
    }
  }

  // 从 skeletonData 提取表单字段并添加 interactionHint
  if (skeletonData && skeletonData.pages) {
    for (const page of skeletonData.pages) {
      const pageInfo = {
        name: page.name || page.route,
        route: page.route || page.fullUrlPath,
        fields: [],
      };

      if (page.formFields) {
        for (const field of page.formFields) {
          const enriched = {
            ...field,
            interactionHint: getInteractionHint(field, adapter, customHints),
          };
          pageInfo.fields.push(enriched);
          summary.formFields.push(enriched);
        }
      }

      // 提取功能点（用于覆盖率检查）
      if (page.interactions) {
        for (const interaction of page.interactions) {
          summary.features.push({
            page: pageInfo.name,
            type: interaction.type,
            description: interaction.description || interaction.type,
          });
        }
      }

      summary.pages.push(pageInfo);
    }
  }

  return summary;
}

/**
 * 构建 API 探测摘要
 */
function buildApiProbeSummary(apiSkeletonData, apiProbeContent) {
  if (!apiSkeletonData && !apiProbeContent) {
    return { endpoints: [], totalCount: 0 };
  }

  const summary = {
    endpoints: [],
    totalCount: 0,
    wrapperClass: null,
    pagination: null,
  };

  if (apiSkeletonData) {
    if (apiSkeletonData.wrapperClass) summary.wrapperClass = apiSkeletonData.wrapperClass;
    if (apiSkeletonData.pagination) summary.pagination = apiSkeletonData.pagination;

    const endpoints = apiSkeletonData.endpoints || [];
    for (const ep of endpoints) {
      summary.endpoints.push({
        method: ep.method,
        path: ep.path,
        summary: ep.summary || '',
        tags: ep.tags || [],
        parameters: (ep.parameters || []).map(p => ({
          name: p.name,
          in: p.in,
          required: p.required,
          type: p.type,
        })),
        hasRequestBody: (ep.requestBody || []).length > 0,
        confidence: ep.confidence || 'verified',
      });
    }
    summary.totalCount = summary.endpoints.length;
  }

  return summary;
}

module.exports = {
  buildDomProbeSummary,
  buildApiProbeSummary,
  detectUiLibrary,
  ADAPTERS,
};
