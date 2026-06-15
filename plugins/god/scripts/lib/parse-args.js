"use strict";

/**
 * 统一的命令行参数解析器。
 *
 * @param {string[]} argv - process.argv.slice(2)
 * @param {Object} spec - 参数规格
 * @param {Object.<string, { flag?: string, default?: any, boolean?: boolean }>} spec
 * @returns {Object}
 *
 * @example
 *   const args = parseArgs(process.argv.slice(2), {
 *     testingDir: { flag: '--testing-dir', default: 'testing' },
 *     scope:      { flag: '--scope', default: 'fullstack' },
 *     verbose:    { flag: '--verbose', boolean: true },
 *   });
 */
function parseArgs(argv, spec) {
  const result = {};
  for (const [key, def] of Object.entries(spec)) {
    result[key] = def.default !== undefined ? def.default : '';
  }

  for (let i = 0; i < argv.length; i++) {
    for (const [key, def] of Object.entries(spec)) {
      if (def.flag === argv[i]) {
        if (def.boolean) {
          result[key] = true;
        } else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) {
          result[key] = argv[++i];
        }
        break;
      }
    }
  }
  return result;
}

module.exports = parseArgs;
