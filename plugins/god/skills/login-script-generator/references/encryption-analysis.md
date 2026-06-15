# 加密方式识别与分析

## 识别方法

### 方法 1：长度对比

明文密码 → 对比 HAR 中实际发送的 password 字段长度。

| 明文长度 | 密文长度 | 推断加密 |
|---------|---------|---------|
| 相同 | 无加密或Base64 | 检查是否 `btoa(password)` |
| 6字符 → 206字符 | SM2 (无Base64) | `04` + sm2.doEncrypt(plaintext, pk, 1) |
| 6字符 → 210字符 | SM2 (有Base64) | `04` + sm2.doEncrypt(btoa(plaintext), pk, 1) |
| 6字符 → 216+字符 | SM2 + {secret}前缀 | `{secret}04` + sm2.doEncrypt(btoa(plaintext), pk, 1) |
| 6字符 → 344字符 | RSA-2048 | crypto.publicEncrypt |
| 6字符 → 24字符 | AES-CBC (hex) | 需找 key/iv |
| 6字符 → 32字符 | MD5 | 不可逆，无法还原 |
| 6字符 → 64字符 | SHA-256 | 不可逆 |

### 方法 2：前缀识别

| 密文前缀 | 加密方式 |
|---------|---------|
| `04` | SM2 uncompressed point |
| `{secret}04` | JLC @jlc/utils SM2 封装 |
| `MIIB` | RSA (Base64 DER) |
| `eyJ` | JWT / Base64 |
| `$2b$` / `$2a$` | bcrypt |

### 方法 3：eval 探测

在登录页通过 agent-browser eval 探测加密函数：

```bash
# SM2
agent-browser eval "typeof window.sm2Encrypt"           # "function"
agent-browser eval "window.sm2Encrypt('test123')"       # 对比输出长度

# RSA
agent-browser eval "typeof window.encryptPassword"      # 自定义RSA加密
agent-browser eval "typeof window.JSEncrypt"            # JSEncrypt库

# AES
agent-browser eval "typeof CryptoJS"                    # CryptoJS库
agent-browser eval "typeof window.aesEncrypt"

# 通用
agent-browser eval "JSON.stringify(Object.keys(window).filter(k=>/encrypt|crypto|sm2|rsa/i.test(k)))"
```

### 方法 4：源码分析

如果 eval 探测不到，分析页面 JS 源码：

```bash
# 查找加密相关函数
agent-browser eval "document.querySelectorAll('script[src]').forEach(s=>console.log(s.src))"
# 找到 JS 文件后用 web reader 读取内容
# 搜索关键词: encrypt, SM2, RSA, AES, CryptoJS, sm-crypto
```

## 常见加密实现

### JLC SM2 (通用 passport)

```javascript
// Base64 → SM2 → 04前缀
const sm2 = require('sm-crypto').sm2;
const PK = '04949f75abc2a3a91c2bb701a5bc06d623ce17f5b97846a02a141582b24b104cef34e816726c76e6fd5a2ce98e507fa5cca174d65aa87dd9ab27b24d83e1ada0a3';
function encrypt(text) {
  return '04' + sm2.doEncrypt(Buffer.from(text).toString('base64'), PK, 1);
}
```

### JLC @jlc/utils SM2 (业务平台)

```javascript
// Base64 → SM2 → {secret}04前缀
function encrypt(text, publicKey) {
  const b64 = customBase64Encode(text); // UTF-8 safe Base64
  return `{secret}04${sm2.doEncrypt(b64, publicKey, 1)}`;
}
```

### RSA (通用)

```javascript
const crypto = require('crypto');
function rsaEncrypt(text, publicKeyPem) {
  return crypto.publicEncrypt(
    { key: publicKeyPem, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(text)
  ).toString('base64');
}
```

### AES-CBC (通用)

```javascript
const crypto = require('crypto');
function aesEncrypt(text, key, iv) {
  const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
  return cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
}
```

## 在脚本中的处理

### 优先级

1. **页面有全局加密函数** → 用 `agent-browser eval` 调用它，提取结果
2. **能用 npm 库复现** → 在脚本中实现（如 sm-crypto）
3. **无法复现** → 脚本启动时通过 agent-browser eval 加密

### 方案 3 模板：运行时调用页面加密

```javascript
const { execSync } = require('child_process');
function runtimeEncrypt(plaintext) {
  const b64 = Buffer.from(plaintext).toString('base64');
  const cmd = `agent-browser eval "window.sm2Encrypt('${plaintext}')"`;
  const result = execSync(cmd, { encoding: 'utf8', shell: true }).trim();
  return result;
}
```
