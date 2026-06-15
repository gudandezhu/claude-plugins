/**
 * Element Plus 组件交互提示映射表
 * 21 种组件类型，cssClass → interactionHint
 */
"use strict";

const prefix = 'el-';

// 第一层：CSS class 精确匹配
const classMap = {
  'el-input': { hint: '点击后直接输入文本', type: 'input' },
  'el-input-number': { hint: '点击后输入数字，注意 fill() 不触发 Vue change，需用 fillNumberInput 辅助函数', type: 'number' },
  'el-select': { hint: '点击后从下拉列表选择选项，用 form-item label 过滤定位', type: 'select' },
  'el-cascader': { hint: '点击后从级联面板逐级选择，每级选择后等待下级加载', type: 'cascader' },
  'el-tree-select': { hint: '点击后从树形下拉面板选择节点', type: 'tree-select' },
  'el-date-picker': { hint: '点击后从日期面板选择日期，注意面板弹出动画', type: 'date' },
  'el-time-picker': { hint: '点击后从时间面板选择时间', type: 'time' },
  'el-time-select': { hint: '点击后从时间下拉列表选择', type: 'time-select' },
  'el-switch': { hint: '点击切换开关状态，检查 aria-checked 属性变化', type: 'switch' },
  'el-checkbox': { hint: '点击切换勾选状态', type: 'checkbox' },
  'el-checkbox-group': { hint: '包含多个复选框，逐个点击切换', type: 'checkbox-group' },
  'el-radio': { hint: '点击选中单选项', type: 'radio' },
  'el-radio-group': { hint: '包含多个单选项，点击目标项选中', type: 'radio-group' },
  'el-textarea': { hint: '点击后输入多行文本', type: 'textarea' },
  'el-upload': { hint: '通过 setInputFiles 设置文件，不要点击上传按钮', type: 'upload' },
  'el-color-picker': { hint: '点击后从颜色面板选择颜色', type: 'color-picker' },
  'el-rate': { hint: '点击对应星星设置评分', type: 'rate' },
  'el-slider': { hint: '拖动滑块到目标位置，或点击滑轨定位', type: 'slider' },
  'el-transfer': { hint: '从左侧列表勾选后点击右移按钮转移', type: 'transfer' },
  'el-autocomplete': { hint: '输入文本后等待建议列表出现，点击选择', type: 'autocomplete' },
  'el-mention': { hint: '输入触发字符后等待提及列表出现，点击选择', type: 'mention' },
};

// 第二层：type 降级映射（cssClass 不可用时）
const typeMap = {
  'input': { hint: '点击后直接输入文本' },
  'number': { hint: '点击后输入数字' },
  'select': { hint: '点击后从下拉列表选择' },
  'textarea': { hint: '点击后输入多行文本' },
  'date': { hint: '点击后从日期面板选择' },
  'checkbox': { hint: '点击切换勾选状态' },
  'radio': { hint: '点击选中单选项' },
  'switch': { hint: '点击切换开关状态' },
};

module.exports = { prefix, classMap, typeMap };
