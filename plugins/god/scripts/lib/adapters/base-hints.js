/**
 * 原生 HTML 组件交互提示映射表（降级方案）
 * 当无法识别 UI 框架时使用
 */
"use strict";

const prefix = '';

const classMap = {};

// 基于 HTML input type 的降级映射
const typeMap = {
  'input': { hint: '点击后直接输入文本' },
  'text': { hint: '点击后直接输入文本' },
  'number': { hint: '点击后输入数字' },
  'email': { hint: '点击后输入邮箱地址' },
  'password': { hint: '点击后输入密码' },
  'tel': { hint: '点击后输入电话号码' },
  'url': { hint: '点击后输入 URL' },
  'search': { hint: '点击后输入搜索关键词' },
  'select': { hint: '点击后从下拉列表选择' },
  'textarea': { hint: '点击后输入多行文本' },
  'date': { hint: '点击后选择日期' },
  'time': { hint: '点击后选择时间' },
  'datetime-local': { hint: '点击后选择日期和时间' },
  'checkbox': { hint: '点击切换勾选状态' },
  'radio': { hint: '点击选中单选项' },
  'file': { hint: '通过 setInputFiles 设置文件' },
  'range': { hint: '拖动滑块到目标位置' },
  'color': { hint: '点击后选择颜色' },
};

module.exports = { prefix, classMap, typeMap };
