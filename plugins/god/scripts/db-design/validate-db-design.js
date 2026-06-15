#!/usr/bin/env node
/**
 * validate-db-design.js
 * 数据库设计文档公司规范校验脚本
 * 解析 db.md 中的 DDL 块，逐表校验 sql-design-spec.md 规范
 *
 * 用法：
 *   node validate-db-design.js --db-md <path> [--output <path>]
 *
 * 输出：
 *   控制台：逐表逐维度 [OK]/[FAIL]/[WARN] 报告
 *   JSON（--output）：结构化结果
 *   退出码：0=全部PASS/WARN，1=存在FAIL
 */
"use strict";

const fs = require("fs");
const path = require("path");

// === 参数解析 ===
function parseArgs() {
  const argv = process.argv.slice(2);
  let dbMd = null;
  let output = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--db-md" && argv[i + 1]) dbMd = argv[++i];
    else if (argv[i] === "--output" && argv[i + 1]) output = argv[++i];
  }
  if (!dbMd) {
    console.error("[FAIL] --db-md <path> is required");
    process.exit(1);
  }
  return { dbMd, output };
}

// === DDL 解析 ===

/**
 * 从 db.md 中提取所有 CREATE TABLE DDL 块
 * 返回 [{ tableName, ddl, fields, indexes, tableComment, charset }]
 */
function parseDdls(content) {
  const tables = [];
  // 匹配 ```sql ... CREATE TABLE ... ``` 块
  const ddlRegex = /```sql\s*\n([\s\S]*?)```/gi;
  let match;
  while ((match = ddlRegex.exec(content)) !== null) {
    const ddl = match[1].trim();
    const table = parseSingleDdl(ddl);
    if (table) tables.push(table);
  }
  return tables;
}

function parseSingleDdl(ddl) {
  // 提取表名
  const tableMatch = ddl.match(/CREATE\s+TABLE\s+`?(\w+)`?/i);
  if (!tableMatch) return null;
  const tableName = tableMatch[1];

  // 提取表 COMMENT
  const commentMatch = ddl.match(/COMMENT\s*=?\s*'([^']*)'/gi);
  const tableComment = commentMatch
    ? commentMatch[commentMatch.length - 1].match(/'([^']*)'/)[1]
    : null;

  // 提取字符集
  const charsetMatch = ddl.match(/CHARSET\s*=\s*(\w+)/i);
  const charset = charsetMatch ? charsetMatch[1].toLowerCase() : null;

  // 提取字段定义（在 PRIMARY KEY / KEY / UNIQUE 之前的行）
  const lines = ddl.split("\n");
  const fields = [];
  const indexes = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // 跳过 CREATE TABLE 和结束行
    if (/^CREATE\s+TABLE/i.test(trimmed)) continue;
    if (/^\)/i.test(trimmed)) continue;

    // 索引行
    const pkMatch = trimmed.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
    if (pkMatch) {
      indexes.push({
        name: "PRIMARY",
        type: "PRIMARY",
        columns: pkMatch[1].replace(/`/g, "").split(",").map((s) => s.trim()),
      });
      continue;
    }

    const ukMatch = trimmed.match(
      /UNIQUE\s+(?:KEY|INDEX)\s*`?(\w+)`?\s*\(([^)]+)\)/i
    );
    if (ukMatch) {
      indexes.push({
        name: ukMatch[1],
        type: "UNIQUE",
        columns: ukMatch[2].replace(/`/g, "").split(",").map((s) => s.trim()),
      });
      continue;
    }

    const idxMatch = trimmed.match(
      /(?:KEY|INDEX)\s*`?(\w+)`?\s*\(([^)]+)\)/i
    );
    if (idxMatch) {
      indexes.push({
        name: idxMatch[1],
        type: "INDEX",
        columns: idxMatch[2].replace(/`/g, "").split(",").map((s) => s.trim()),
      });
      continue;
    }

    // 字段行: `field_name` TYPE ... COMMENT 'xxx'
    // 只捕获字段名，rest 包含类型声明之后的全部内容（含类型修饰）
    const fieldMatch = trimmed.match(/^`(\w+)`\s+(.+)/);
    if (fieldMatch) {
      const name = fieldMatch[1];
      const rest = fieldMatch[2];

      // 提取基础类型：行首的 类型名(参数) 可选 UNSIGNED
      const typeMatch = rest.match(/^(\w+(?:\s*\([^)]*\))?(?:\s+UNSIGNED)?)/i);
      const rawType = typeMatch ? typeMatch[1].trim() : rest.split(/\s/)[0];
      const baseType = rawType.replace(/\s*\([^)]*\)/, "").replace(/\s+UNSIGNED/i, "").trim().toUpperCase();

      // 提取默认值
      const defaultMatch = rest.match(/DEFAULT\s+(\S+)/i);
      const defaultValue = defaultMatch ? defaultMatch[1] : null;

      // 提取 COMMENT（整个 rest 中搜索）
      const commentFieldMatch = rest.match(/COMMENT\s+'([^']*)'/i);
      const comment = commentFieldMatch ? commentFieldMatch[1] : null;

      // NOT NULL
      const notNull = /NOT\s+NULL/i.test(rest);

      // AUTO_INCREMENT
      const autoIncrement = /AUTO_INCREMENT/i.test(rest);

      // UNSIGNED
      const unsigned = /UNSIGNED/i.test(rest);

      fields.push({
        name,
        type: rawType,
        baseType,
        defaultValue,
        comment,
        notNull,
        autoIncrement,
        unsigned,
        rest,
      });
    }
  }

  return { tableName, ddl, fields, indexes, tableComment, charset };
}

// === 校验维度 ===

const MANDATORY_FIELDS = [
  "id",
  "biz_key",
  "create_time",
  "update_time",
  "deleted_flag",
  "deleted_time",
];

const MONEY_KEYWORDS = [
  "fee",
  "price",
  "amount",
  "cost",
  "money",
  "salary",
];

const RESERVED_PREFIXES = ["reserved_", "bak_", "tmp_", "temp_"];

// MySQL 8.0 保留字完整清单（标记 R 的关键字）
// 来源：https://dev.mysql.com/doc/refman/8.0/en/keywords.html
const MYSQL_RESERVED_WORDS = new Set([
  // A
  "ACCESSIBLE", "ADD", "ALL", "ALTER", "ANALYZE", "AND", "AS", "ASC", "ASENSITIVE",
  // B
  "BEFORE", "BETWEEN", "BIGINT", "BINARY", "BLOB", "BOTH", "BY",
  // C
  "CALL", "CASCADE", "CASE", "CHANGE", "CHAR", "CHARACTER", "CHECK", "COLLATE",
  "CONDITION", "CONSTRAINT", "CONTINUE", "CONVERT", "CREATE", "CROSS", "CUBE",
  "CUME_DIST", "CURRENT_DATE", "CURRENT_TIME", "CURRENT_TIMESTAMP", "CURRENT_USER", "CURSOR",
  // D
  "DATABASE", "DATABASES", "DAY_HOUR", "DAY_MICROSECOND", "DAY_MINUTE", "DAY_SECOND",
  "DEC", "DECIMAL", "DECLARE", "DEFAULT", "DELAYED", "DELETE", "DENSE_RANK", "DESC",
  "DESCRIBE", "DETERMINISTIC", "DISTINCT", "DISTINCTROW", "DIV", "DOUBLE", "DROP", "DUAL",
  // E
  "EACH", "ELSE", "ELSEIF", "EMPTY", "ENCLOSED", "ESCAPED", "EXCEPT", "EXISTS", "EXIT", "EXPLAIN",
  // F
  "FALSE", "FETCH", "FIRST_VALUE", "FLOAT", "FLOAT4", "FLOAT8", "FOR", "FORCE",
  "FOREIGN", "FROM", "FULLTEXT", "FUNCTION",
  // G
  "GENERATED", "GET", "GRANT", "GROUP", "GROUPING", "GROUPS",
  // H
  "HAVING", "HIGH_PRIORITY", "HOUR_MICROSECOND", "HOUR_MINUTE", "HOUR_SECOND",
  // I
  "IF", "IGNORE", "IN", "INDEX", "INFILE", "INNER", "INOUT", "INSENSITIVE",
  "INSERT", "INT", "INT1", "INT2", "INT3", "INT4", "INT8", "INTEGER",
  "INTERSECT", "INTERVAL", "INTO", "IS",
  // J
  "JOIN", "JSON_TABLE",
  // K
  "KEY", "KEYS", "KILL",
  // L
  "LAG", "LAST_VALUE", "LATERAL", "LEAD", "LEADING", "LEAVE", "LEFT", "LIKE",
  "LIMIT", "LINEAR", "LINES", "LOAD", "LOCALTIME", "LOCALTIMESTAMP", "LOCK",
  "LONG", "LONGBLOB", "LONGTEXT", "LOOP", "LOW_PRIORITY",
  // M
  "MASTER_BIND", "MASTER_SSL_VERIFY_SERVER_CERT", "MATCH", "MAXVALUE",
  "MEDIUMBLOB", "MEDIUMINT", "MEDIUMTEXT", "MIDDLEINT",
  "MINUTE_MICROSECOND", "MINUTE_SECOND", "MOD", "MODIFIES",
  // N
  "NATURAL", "NOT", "NO_WRITE_TO_BINLOG", "NTH_VALUE", "NTILE", "NULL", "NUMERIC",
  // O
  "OF", "ON", "OPTIMIZE", "OPTIMIZER_COSTS", "OPTION", "OPTIONALLY", "OR", "ORDER",
  "OUT", "OUTER", "OUTFILE", "OVER",
  // P
  "PARTITION", "PERCENT_RANK", "PRECISION", "PRIMARY", "PROCEDURE", "PURGE",
  // R
  "RANGE", "RANK", "READ", "READS", "READ_WRITE", "REAL", "RECURSIVE",
  "REFERENCES", "REGEXP", "RELEASE", "RENAME", "REPEAT", "REPLACE", "REQUIRE",
  "RESIGNAL", "RESTRICT", "RETURN", "REVOKE", "RIGHT", "RLIKE", "ROW", "ROWS", "ROW_NUMBER",
  // S
  "SCHEMA", "SCHEMAS", "SECOND_MICROSECOND", "SELECT", "SENSITIVE", "SEPARATOR",
  "SET", "SHOW", "SIGNAL", "SMALLINT", "SPATIAL", "SPECIFIC", "SQL", "SQLEXCEPTION",
  "SQLSTATE", "SQLWARNING", "SQL_BIG_RESULT", "SQL_CALC_FOUND_ROWS", "SQL_SMALL_RESULT",
  "SSL", "STARTING", "STORED", "STRAIGHT_JOIN", "SYSTEM",
  // T
  "TABLE", "TERMINATED", "THEN", "TINYBLOB", "TINYINT", "TINYTEXT", "TO",
  "TRAILING", "TRIGGER", "TRUE",
  // U
  "UNION", "UNIQUE", "UNLOCK", "UNSIGNED", "UPDATE", "USAGE", "USE", "USING",
  // V
  "VALUES", "VARBINARY", "VARCHAR", "VARCHARACTER", "VARYING", "VIRTUAL",
  // W
  "WHEN", "WHERE", "WHILE", "WINDOW", "WITH", "WRITE",
  // X
  "XOR",
  // Y
  "YEAR_MONTH",
  // Z
  "ZEROFILL",
  // 特殊
  "_FILENAME",
]);

// 非保留但在业务中极易误用的关键字（部分上下文会冲突）
const MYSQL_HIGH_RISK_KEYWORDS = new Set([
  "ACTION", "COMMENT", "STATUS", "NAME", "TYPE", "VALUE", "LEVEL", "ROLE",
  "ACCOUNT", "ACTIVE", "AFTER", "ALGORITHM", "AUTHENTICATION", "AUTO_INCREMENT",
  "BACKUP", "BEGIN", "BIT", "BOOL", "BOOLEAN", "BYTE", "CACHE", "CHAIN",
  "CHANNEL", "CIPHER", "CLASS_ORIGIN", "CLIENT", "CLOSE", "CODE", "COLLATION",
  "COLUMNS", "COMMIT", "COMMITTED", "COMPACT", "COMPLETION", "COMPONENT",
  "COMPRESSION", "CONCURRENT", "CONNECTION", "CONSISTENT", "CONTAINS", "CONTEXT",
  "CPU", "DATA", "DATAFILE", "DATE", "DATETIME", "DAY", "DEFINER", "DELAY_KEY_WRITE",
  "DESCRIPTION", "DIRECTORY", "DISABLE", "DISCARD", "DISK", "DO", "DUMPFILE",
  "DUPLICATE", "DYNAMIC", "ENABLE", "ENCRYPTION", "END", "ENDS", "ENGINE",
  "ENGINES", "ENUM", "ERROR", "ERRORS", "ESCAPE", "EVENT", "EVENTS", "EVERY",
  "EXCHANGE", "EXECUTE", "EXPANSION", "EXPIRE", "EXPORT", "EXTENDED", "EXTENT_SIZE",
  "FAST", "FIELDS", "FILE", "FIRST", "FIXED", "FLUSH", "FOLLOWING", "FOLLOWS",
  "FORMAT", "FOUND", "FULL", "GENERAL", "GEOMETRY", "GEOMETRYCOLLECTION",
  "GLOBAL", "GRANTS", "HANDLER", "HASH", "HELP", "HOST", "HOSTS", "HOUR",
  "IDENTIFIED", "IMPORT", "INITIAL_SIZE", "INVISIBLE", "INVOKER", "IO",
  "IO_THREAD", "IPC", "ISOLATION", "ISSUER", "KEY_BLOCK_SIZE", "LANGUAGE",
  "LAST", "LEAVES", "LESS", "LINESTRING", "LIST", "LOCAL", "LOCKS", "LOGFILE",
  "LOGS", "MASTER", "MAX_CONNECTIONS_PER_HOUR", "MAX_QUERIES_PER_HOUR",
  "MAX_ROWS", "MAX_SIZE", "MAX_UPDATES_PER_HOUR", "MAX_USER_CONNECTIONS",
  "MEDIUM", "MEMORY", "MERGE", "MESSAGE_TEXT", "MICROSECOND", "MIGRATE",
  "MINUTE", "MIN_ROWS", "MODE", "MODIFY", "MONTH", "MULTILINESTRING",
  "MULTIPOINT", "MULTIPOLYGON", "MUTEX", "MYSQL_ERRNO", "NAMES", "NATIONAL",
  "NCHAR", "NDB", "NDBCLUSTER", "NEVER", "NEW", "NEXT", "NO", "NODEGROUP",
  "NONE", "NOWAIT", "NULLS", "NUMBER", "NVARCHAR", "OFFSET", "ONE", "ONLY",
  "OPEN", "OPTIONS", "OWNER", "PACK_KEYS", "PAGE", "PARSER", "PARTIAL",
  "PARTITIONING", "PARTITIONS", "PASSWORD", "PATH", "PERSIST", "PHASE",
  "PLUGIN", "PLUGINS", "POINT", "POLYGON", "PORT", "PRECEDES", "PREPARE",
  "PRESERVE", "PREV", "PRIVILEGES", "PROCESS", "PROCESSLIST", "PROFILE",
  "PROFILES", "PROXY", "QUARTER", "QUERY", "QUICK", "REBUILD", "RECOVER",
  "REDO_BUFFER_SIZE", "REDUNDANT", "RELAY", "RELAYLOG", "RELOAD", "REMOVE",
  "REORGANIZE", "REPAIR", "REPEATABLE", "REPLICA", "REPLICAS", "REPLICATION",
  "RESET", "RESOURCE", "RESTART", "RESTORE", "RESUME", "RETAIN", "RETURNS",
  "REUSE", "REVERSE", "ROLLBACK", "ROLLUP", "ROTATE", "ROUTINE", "ROW_COUNT",
  "ROW_FORMAT", "RTREE", "SAVEPOINT", "SCHEDULE", "SCHEMA_NAME", "SECOND",
  "SECURITY", "SERIAL", "SERIALIZABLE", "SERVER", "SESSION", "SHARE",
  "SHUTDOWN", "SIGNED", "SIMPLE", "SLAVE", "SLOW", "SNAPSHOT", "SOCKET",
  "SOME", "SONAME", "SOUNDS", "SOURCE", "SQL_THREAD", "SRID", "STACKED",
  "START", "STARTS", "STATS_AUTO_RECALC", "STATS_PERSISTENT", "STATS_SAMPLE_PAGES",
  "STATUS", "STOP", "STORAGE", "STRING", "SUBCLASS_ORIGIN", "SUBJECT",
  "SUBPARTITION", "SUBPARTITIONS", "SUPER", "SUSPEND", "SWAPS", "SWITCHES",
  "TABLES", "TABLESPACE", "TABLE_CHECKSUM", "TABLE_NAME", "TEMPORARY",
  "TEMPTABLE", "TEXT", "THAN", "TIME", "TIMESTAMP", "TIMESTAMPADD",
  "TIMESTAMPDIFF", "TLS", "TRANSACTION", "TRIGGERS", "TRUNCATE", "TYPE",
  "TYPES", "UNCOMMITTED", "UNDEFINED", "UNDOFILE", "UNICODE", "UNINSTALL",
  "UNKNOWN", "UNTIL", "UPGRADE", "USER", "USER_RESOURCES", "USE_FRM",
  "VALIDATION", "VARIABLES", "VIEW", "VISIBLE", "WAIT", "WARNINGS", "WEEK",
  "WEIGHT_STRING", "WORK", "WRAPPER", "WRITE", "X509", "XA", "XID", "XML",
  "YEAR", "ZONE",
]);

/**
 * 校验单张表，返回 { checks: [{dim, level, status, message}], status }
 */
function validateTable(table) {
  const checks = [];
  const { tableName, fields, indexes, tableComment, charset, ddl } = table;
  const fieldNames = fields.map((f) => f.name.toLowerCase());
  const fieldMap = {};
  for (const f of fields) fieldMap[f.name.toLowerCase()] = f;

  // 1. 必备字段
  const missing = MANDATORY_FIELDS.filter((f) => !fieldNames.includes(f));
  checks.push({
    dim: "必备字段",
    level: "Critical",
    status: missing.length === 0 ? "PASS" : "FAIL",
    message:
      missing.length === 0
        ? `全部 ${MANDATORY_FIELDS.length} 个必备字段存在`
        : `缺少: ${missing.join(", ")}`,
  });

  // 2. 必备索引
  const hasPK = indexes.some(
    (idx) =>
      idx.type === "PRIMARY" &&
      idx.columns.length === 1 &&
      idx.columns[0].toLowerCase() === "id"
  );
  const hasUkBizKey = indexes.some(
    (idx) =>
      idx.type === "UNIQUE" &&
      idx.name.toLowerCase() === "uk_biz_key" &&
      idx.columns.some((c) => c.toLowerCase() === "biz_key")
  );
  const missingIdx = [];
  if (!hasPK) missingIdx.push("PRIMARY KEY(id)");
  if (!hasUkBizKey) missingIdx.push("UNIQUE KEY uk_biz_key(biz_key)");
  checks.push({
    dim: "必备索引",
    level: "Critical",
    status: missingIdx.length === 0 ? "PASS" : "FAIL",
    message:
      missingIdx.length === 0
        ? "PRIMARY KEY(id) + uk_biz_key(biz_key) 均存在"
        : `缺少: ${missingIdx.join(", ")}`,
  });

  // 3. 金额字段类型
  const moneyFields = fields.filter((f) => {
    const name = f.name.toLowerCase();
    return MONEY_KEYWORDS.some((kw) => name.includes(kw));
  });
  const badMoney = moneyFields.filter(
    (f) => f.baseType === "FLOAT" || f.baseType === "DOUBLE"
  );
  checks.push({
    dim: "金额字段类型",
    level: "Critical",
    status: badMoney.length === 0 ? "PASS" : "FAIL",
    message:
      badMoney.length === 0
        ? moneyFields.length > 0
          ? `${moneyFields.map((f) => f.name).join(", ")} 均为 DECIMAL`
          : "无金额字段，跳过"
        : `${badMoney.map((f) => `${f.name}(${f.baseType})`).join(", ")} 应为 DECIMAL`,
  });

  // 4. 关联字段命名（禁止 _id 关联字段）
  const whitelist = [
    "id",
    "tenant_id",
    "enterprise_id",
    "pid",
    "parent_id",
  ]; // 非关联用途的 _id 字段白名单
  const badRelation = fields.filter((f) => {
    const name = f.name.toLowerCase();
    if (whitelist.includes(name)) return false;
    // _id 结尾但不是白名单的，可能是关联字段
    if (name.endsWith("_id") && name !== "id") {
      // 排除明确的非关联场景（如 operator_uid）
      if (name.endsWith("_uid")) return false;
      return true;
    }
    return false;
  });
  checks.push({
    dim: "关联字段命名",
    level: "Critical",
    status: badRelation.length === 0 ? "PASS" : "FAIL",
    message:
      badRelation.length === 0
        ? "无 _id 命名的关联字段"
        : `${badRelation.map((f) => f.name).join(", ")} 应改为 _biz_key 结尾`,
  });

  // 5. 禁止 ENUM/SET
  const enumFields = fields.filter(
    (f) => f.baseType === "ENUM" || f.baseType === "SET"
  );
  checks.push({
    dim: "禁止类型",
    level: "Critical",
    status: enumFields.length === 0 ? "PASS" : "FAIL",
    message:
      enumFields.length === 0
        ? "无 ENUM/SET 类型"
        : `${enumFields.map((f) => `${f.name}(${f.baseType})`).join(", ")} 禁止使用`,
  });

  // 6. 禁止 CURRENT_TIMESTAMP
  const currentTsFields = fields.filter((f) => {
    const rest = f.rest || "";
    return (
      /DEFAULT\s+CURRENT_TIMESTAMP/i.test(rest) ||
      /ON\s+UPDATE\s+CURRENT_TIMESTAMP/i.test(rest)
    );
  });
  checks.push({
    dim: "禁止时间函数",
    level: "Critical",
    status: currentTsFields.length === 0 ? "PASS" : "FAIL",
    message:
      currentTsFields.length === 0
        ? "无 CURRENT_TIMESTAMP"
        : `${currentTsFields.map((f) => f.name).join(", ")} 使用了 CURRENT_TIMESTAMP`,
  });

  // 7. 禁止项（FOREIGN KEY / VIEW / TRIGGER / PROCEDURE）
  // 检查 DDL 级别关键字，不匹配字段名/COMMENT 内容
  const ddlUpper = ddl.toUpperCase();
  const forbiddenPatterns = [
    { pattern: /FOREIGN\s+KEY/i, name: "FOREIGN KEY" },
    { pattern: /CREATE\s+VIEW/i, name: "VIEW" },
    { pattern: /CREATE\s+TRIGGER/i, name: "TRIGGER" },
    { pattern: /CREATE\s+PROCEDURE/i, name: "PROCEDURE" },
  ];
  // 额外检查：DDL 中行首的 CONSTRAINT ... FOREIGN KEY
  const hasForeignKey = /^\s*CONSTRAINT\s+.*\bFOREIGN\s+KEY\b/im.test(ddl) ||
    /\bFOREIGN\s+KEY\b/i.test(ddl.replace(/`[^`]*`/g, "").replace(/'[^']*'/g, ""));
  const forbiddenFound = forbiddenPatterns
    .filter((p) => p.pattern.test(ddlUpper))
    .map((p) => p.name);
  if (hasForeignKey && !forbiddenFound.includes("FOREIGN KEY")) {
    forbiddenFound.push("FOREIGN KEY");
  }
  checks.push({
    dim: "禁止项",
    level: "Critical",
    status: forbiddenFound.length === 0 ? "PASS" : "FAIL",
    message:
      forbiddenFound.length === 0
        ? "无禁止项"
        : `发现禁止项: ${forbiddenFound.join(", ")}`,
  });

  // 8. 禁止预留字段
  const reservedFields = fields.filter((f) =>
    RESERVED_PREFIXES.some((prefix) =>
      f.name.toLowerCase().startsWith(prefix)
    )
  );
  checks.push({
    dim: "禁止预留字段",
    level: "Warning",
    status: reservedFields.length === 0 ? "PASS" : "WARN",
    message:
      reservedFields.length === 0
        ? "无预留字段"
        : `${reservedFields.map((f) => f.name).join(", ")} 为预留字段`,
  });

  // 9. COMMENT 非空
  const noCommentFields = fields.filter((f) => !f.comment);
  const tableCommentMissing = !tableComment;
  let commentMsg = "";
  if (noCommentFields.length === 0 && !tableCommentMissing) {
    commentMsg = "所有字段和表均有 COMMENT";
  } else {
    const parts = [];
    if (tableCommentMissing) parts.push("表缺少 COMMENT");
    if (noCommentFields.length > 0)
      parts.push(
        `字段缺少 COMMENT: ${noCommentFields.map((f) => f.name).join(", ")}`
      );
    commentMsg = parts.join("; ");
  }
  checks.push({
    dim: "COMMENT非空",
    level: "Warning",
    status: noCommentFields.length === 0 && !tableCommentMissing ? "PASS" : "WARN",
    message: commentMsg,
  });

  // 10. 索引数量
  const indexCount = indexes.length;
  checks.push({
    dim: "索引数量",
    level: "Warning",
    status: indexCount <= 5 ? "PASS" : "WARN",
    message: indexCount <= 5 ? `${indexCount} 个索引` : `${indexCount} 个索引，超过上限 5`,
  });

  // 11. 索引命名
  const badIndexNames = indexes.filter((idx) => {
    if (idx.type === "PRIMARY") return false; // PK 无需前缀
    if (idx.type === "UNIQUE" && !idx.name.toLowerCase().startsWith("uk_"))
      return true;
    if (idx.type === "INDEX" && !idx.name.toLowerCase().startsWith("idx_"))
      return true;
    return false;
  });
  checks.push({
    dim: "索引命名",
    level: "Warning",
    status: badIndexNames.length === 0 ? "PASS" : "WARN",
    message:
      badIndexNames.length === 0
        ? "索引命名规范（uk_/idx_前缀）"
        : `${badIndexNames.map((i) => i.name).join(", ")} 命名不规范`,
  });

  // 12. 字符集
  checks.push({
    dim: "字符集",
    level: "Info",
    status: charset === "utf8mb4" ? "PASS" : "WARN",
    message:
      charset === "utf8mb4"
        ? "CHARSET=utf8mb4"
        : charset
          ? `CHARSET=${charset}，应为 utf8mb4`
          : "未指定 CHARSET",
  });

  // 13. 禁止保留字作为字段名/表名
  const reservedFieldHits = fields.filter((f) =>
    MYSQL_RESERVED_WORDS.has(f.name.toUpperCase())
  );
  const highRiskFieldHits = fields.filter((f) =>
    !MYSQL_RESERVED_WORDS.has(f.name.toUpperCase()) &&
    MYSQL_HIGH_RISK_KEYWORDS.has(f.name.toUpperCase())
  );
  const tableNameIsReserved = MYSQL_RESERVED_WORDS.has(tableName.toUpperCase());
  const tableNameIsHighRisk = !tableNameIsReserved && MYSQL_HIGH_RISK_KEYWORDS.has(tableName.toUpperCase());

  const reservedParts = [];
  if (tableNameIsReserved) reservedParts.push(`表名 "${tableName}" 是 MySQL 保留字`);
  if (tableNameIsHighRisk) reservedParts.push(`表名 "${tableName}" 是高风险关键字，建议加前缀`);
  if (reservedFieldHits.length > 0)
    reservedParts.push(`字段 ${reservedFieldHits.map((f) => `"${f.name}"`).join(", ")} 是保留字，必须重命名`);
  if (highRiskFieldHits.length > 0)
    reservedParts.push(`字段 ${highRiskFieldHits.map((f) => `"${f.name}"`).join(", ")} 是高风险关键字，建议加前缀`);

  // 保留字 → FAIL，高风险关键字 → WARN
  const hasReservedFail = tableNameIsReserved || reservedFieldHits.length > 0;
  const hasReservedWarn = tableNameIsHighRisk || highRiskFieldHits.length > 0;
  checks.push({
    dim: "保留字校验",
    level: hasReservedFail ? "Critical" : "Warning",
    status: hasReservedFail ? "FAIL" : hasReservedWarn ? "WARN" : "PASS",
    message: reservedParts.length > 0 ? reservedParts.join("; ") : "无保留字冲突",
  });

  // 计算表级状态
  const hasFail = checks.some((c) => c.status === "FAIL");
  const hasWarn = checks.some((c) => c.status === "WARN");
  const status = hasFail ? "FAIL" : hasWarn ? "WARN" : "PASS";

  return { tableName, checks, status };
}

// === 主流程 ===

function main() {
  const { dbMd, output } = parseArgs();

  if (!fs.existsSync(dbMd)) {
    console.error(`[FAIL] File not found: ${dbMd}`);
    process.exit(1);
  }

  const content = fs.readFileSync(dbMd, "utf-8");
  const tables = parseDdls(content);

  if (tables.length === 0) {
    console.error("[FAIL] No CREATE TABLE DDL blocks found in db.md");
    process.exit(1);
  }

  console.log(`\n=== 数据库设计规范校验 ===`);
  console.log(`文件: ${dbMd}`);
  console.log(`表数量: ${tables.length}\n`);

  const results = [];
  let totalPass = 0;
  let totalWarn = 0;
  let totalFail = 0;

  for (const table of tables) {
    const result = validateTable(table);
    results.push(result);

    if (result.status === "PASS") totalPass++;
    else if (result.status === "WARN") totalWarn++;
    else totalFail++;

    // 控制台输出
    const statusTag =
      result.status === "PASS"
        ? "[OK]  "
        : result.status === "WARN"
          ? "[WARN] "
          : "[FAIL] ";
    console.log(`${statusTag} ${result.tableName}`);

    for (const check of result.checks) {
      if (check.status === "PASS") {
        console.log(
          `       [OK]   ${check.dim}: ${check.message}`
        );
      } else if (check.status === "WARN") {
        console.log(
          `       [WARN] ${check.dim}: ${check.message}`
        );
      } else {
        console.log(
          `       [FAIL] ${check.dim} (${check.level}): ${check.message}`
        );
      }
    }
    console.log("");
  }

  // 汇总
  console.log(`=== 汇总 ===`);
  console.log(
    `总计: ${tables.length} 表 | PASS: ${totalPass} | WARN: ${totalWarn} | FAIL: ${totalFail}`
  );

  const overallStatus = totalFail > 0 ? "FAIL" : totalWarn > 0 ? "WARN" : "PASS";
  console.log(`总体状态: ${overallStatus}\n`);

  // JSON 输出
  const jsonResult = {
    timestamp: new Date().toISOString(),
    file: dbMd,
    tables: results.map((r) => ({
      name: r.tableName,
      status: r.status,
      checks: r.checks,
    })),
    summary: {
      total: tables.length,
      pass: totalPass,
      warn: totalWarn,
      fail: totalFail,
    },
    overallStatus,
  };

  if (output) {
    const outputDir = path.dirname(output);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(output, JSON.stringify(jsonResult, null, 2), "utf-8");
    console.log(`JSON report: ${output}`);
  }

  process.exit(totalFail > 0 ? 1 : 0);
}

main();
