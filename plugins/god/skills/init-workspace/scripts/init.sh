#!/bin/bash
# ============================================================
# AI 工作空间初始化脚本（非交互式，接受参数）
# 支持 Linux / WSL / Git Bash (Windows)
#
# 用法:
#   bash init.sh <workspace_path> --team-group <group> [--git-server <host>] [--team-git-server <host>] [--copy-from <path>] [--team-repos <repo1> ...]
# ============================================================

set -e

# ============================================================
# 配置（维护时修改此处）
# ============================================================

# Git 服务器地址（由 --git-server / --team-git-server 参数覆盖）
GIT_SERVER="git.jlcops.com"
TEAM_GIT_SERVER=""

# 基础仓库模板（{git-server} 替换为 --git-server 的值）
BASE_REPO_TEMPLATES=(
    "git@{git-server}:ai-coding/tech-specs.git"
)

# 团队分组仓库模板（{team-git-server} 替换为 --team-git-server 的值，{group} 替换为 --team-group 的值）
TEAM_GROUP_REPO_TEMPLATES=(
    "git@{team-git-server}:{group}/biz-tech-docs.git"
    "git@{team-git-server}:{group}/biz-product-docs.git"
    "git@{team-git-server}:{group}/process-docs.git"
    "git@{team-git-server}:{group}/biz-test-regression.git"
)

# 目录名
PROJECTS_DIR="projects"

# 全局 npm 工具
GLOBAL_NPM_TOOLS=("tree-cli")

# ============================================================
# 颜色与日志
# ============================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { printf "${GREEN}[INFO]${NC} %s\n" "$*"; }
warn()  { printf "${YELLOW}[WARN]${NC} %s\n" "$*"; }
error() { printf "${RED}[ERROR]${NC} %s\n" "$*"; }

# ============================================================
# 参数解析
# ============================================================
WORKSPACE=""
COPY_FROM=""
TEAM_REPOS=()
TEAM_GROUP=""

parse_args() {
    if [ $# -lt 1 ]; then
        error "用法: bash init.sh <workspace_path> --team-group <group> [--git-server <host>] [--team-git-server <host>] [--copy-from <path>] [--team-repos <repo1> ...]"
        exit 1
    fi

    WORKSPACE="$1"
    shift

    while [ $# -gt 0 ]; do
        case "$1" in
            --copy-from)
                shift; COPY_FROM="$1"; shift
                ;;
            --team-repos)
                shift
                while [ $# -gt 0 ] && [[ "$1" != --* ]]; do
                    TEAM_REPOS+=("$1"); shift
                done
                ;;
            --team-group)
                shift; TEAM_GROUP="$1"; shift
                ;;
            --git-server)
                shift; GIT_SERVER="$1"; shift
                ;;
            --team-git-server)
                shift; TEAM_GIT_SERVER="$1"; shift
                ;;
            *)
                warn "未知参数: $1"; shift
                ;;
        esac
    done

    # --team-git-server 未指定时，默认与 --git-server 相同
    [ -z "$TEAM_GIT_SERVER" ] && TEAM_GIT_SERVER="$GIT_SERVER"

    if [ -z "$TEAM_GROUP" ]; then
        error "--team-group 参数必填，请指定团队在 Git 服务器上的分组名称"
        exit 1
    fi
}

# ============================================================
# Git 协议检测
# ============================================================

# 检测本地环境，决定使用 SSH 还是 HTTPS
detect_git_protocol() {
    local ssh_dir="$HOME/.ssh"
    local ssh_key_files=(
        "id_ed25519.pub"
        "id_ed25519-sk.pub"
        "id_rsa.pub"
        "id_ecdsa.pub"
        "id_ecdsa-sk.pub"
        "id_dsa.pub"
    )

    # 1. 检查 SSH 公钥
    for key_file in "${ssh_key_files[@]}"; do
        if [ -f "$ssh_dir/$key_file" ]; then
            info "检测到 SSH 公钥 (~/.ssh/$key_file)，使用 SSH 协议" >&2
            echo "ssh"
            return
        fi
    done

    # 2. 检查 Git 凭据助手（Windows credential manager 等），检查所有配置级别
    local cred_helper
    cred_helper=$(git config --get credential.helper 2>/dev/null || echo "")
    if [ -n "$cred_helper" ]; then
        info "检测到 Git 凭据助手 ($cred_helper)，使用 HTTPS 协议" >&2
        echo "https"
        return
    fi

    # 3. 都没有，默认 HTTPS 并警告
    warn "未检测到 SSH 公钥或 Git 凭据助手，默认使用 HTTPS 协议（clone 时可能需要输入密码）" >&2
    echo "https"
}

# 转换 git URL 协议
# SSH:   git@host:group/repo.git
# HTTPS: https://host/group/repo.git
convert_url() {
    local url="$1"
    local protocol="$2"

    if [ "$protocol" = "https" ]; then
        # SSH -> HTTPS
        if [[ "$url" =~ ^git@([^:]+):(.+\.git)$ ]]; then
            echo "https://${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
        else
            echo "$url"
        fi
    else
        # HTTPS -> SSH
        if [[ "$url" =~ ^https://([^/]+)/(.+\.git)$ ]]; then
            echo "git@${BASH_REMATCH[1]}:${BASH_REMATCH[2]}"
        else
            echo "$url"
        fi
    fi
}

# ============================================================
# 工具函数
# ============================================================

# 从 git 地址或本地路径提取项目名
repo_name() {
    local source="$1"
    if [ -d "$source" ]; then
        basename "$source"
    else
        basename "$source" .git
    fi
}

# clone 一个仓库到目标目录（已存在则 pull）
clone_or_pull() {
    local url="$1"
    local dest="$2"
    local name
    name=$(basename "$dest")

    if [ -d "$dest" ]; then
        warn "$name 已存在，执行 git pull"
        (cd "$dest" && git pull) || warn "$name pull 失败，请手动检查"
    else
        info "正在 clone $name ..."
        git clone "$url" "$dest" || { error "clone $name 失败"; return 1; }
    fi
}

# clone 一个来源（git 地址或本地目录）到目标目录
clone_from_source() {
    local source="$1"
    local dest="$2"
    local name
    name=$(repo_name "$source")

    if [ -d "$dest" ]; then
        warn "$name 已存在，跳过"
        return 0
    fi

    if [ -d "$source" ]; then
        if [ -d "$source/.git" ]; then
            local remote_url
            remote_url=$(cd "$source" && git remote get-url origin 2>/dev/null || echo "")
            if [ -n "$remote_url" ]; then
                info "正在 clone $name (from remote: $remote_url) ..."
                git clone "$remote_url" "$dest" || { error "clone $name 失败"; return 1; }
            else
                info "正在 clone $name (from local) ..."
                git clone "$source" "$dest" || { error "clone $name 失败"; return 1; }
            fi
        else
            info "正在复制 $name（非 git 仓库）..."
            cp -r "$source" "$dest"
        fi
    else
        info "正在 clone $name ..."
        git clone "$source" "$dest" || { error "clone $name 失败"; return 1; }
    fi
}

# ============================================================
# 环境变量持久化（Linux / Windows 兼容）
# ============================================================
persist_env() {
    local var_name="$1"
    local var_value="$2"
    [ -z "$var_value" ] && return

    # 写入所有相关 shell rc 文件（zsh 为主，bash 兜底）
    local shell_rcs=("$HOME/.zshrc" "$HOME/.bashrc")
    for shell_rc in "${shell_rcs[@]}"; do
        if [ -f "$shell_rc" ]; then
            # macOS BSD sed 需要 -i '' 空参数，GNU sed 两种都支持
            if sed --version >/dev/null 2>&1; then
                sed -i "/^export ${var_name}=/d" "$shell_rc"
            else
                sed -i '' "/^export ${var_name}=/d" "$shell_rc"
            fi
        fi
        echo "export ${var_name}=\"$var_value\"" >> "$shell_rc"
        info "已写入 $shell_rc: ${var_name}=$var_value"
    done
    export "${var_name}=$var_value"

    # Windows: setx
    if [[ "$OSTYPE" == msys* ]] || [[ "$OSTYPE" == mingw* ]] || [[ "$OSTYPE" == cygwin* ]]; then
        local win_path
        win_path=$(cygpath -w "$var_value" 2>/dev/null || echo "$var_value")
        setx "$var_name" "$win_path" > /dev/null 2>&1
        info "已通过 setx 设置 Windows 用户环境变量 ${var_name}=$win_path"
    elif [[ "$OSTYPE" != linux* ]] && [[ "$OSTYPE" != darwin* ]]; then
        warn "未识别的系统类型: $OSTYPE，仅设置当前会话环境变量"
    fi
}

# biz-tech-docs INDEX.md 模板
BIZ_DOCS_INDEX_TEMPLATE='# 团队技术知识库

AI 编码入口：做什么任务 → 查这张表 → 读对应文件。

## 任务 → 必读文件

| 你的任务涉及 | 先读 |
|---|---|
| 不确定该改哪个模块 | architecture/module-topology.md |
| 改某个业务域 | domains/{context}/_overview.md |
| 新增业务域 | domains/_domain-map.md |
| 查业务状态枚举/状态机 | data/status-machines.md |
| 查编码规范 | conventions/coding.md |
| 跨模块调用 | platform/module-communication.md |
| 理解历史架构决策 | architecture/decisions/ |

## 目录

```
domains/          业务域（核心，会持续增长）
architecture/     架构（模块拓扑、系统全景、ADR）
data/             数据（设计规范、枚举、状态机）
infra/            基础设施（中间件、数据库、部署）
platform/    技术中台（认证、租户、ID生成、日志、异常处理）
conventions/      团队规范（编码、Git、测试）
```

## 目录内容说明

每个目录下的文件按需创建——团队有什么写什么，不用的不建空文件。
横向扩展：新增 `platform/{concern}.md` 即可。
纵向扩展：`domains/` 下新增 `{context}/_overview.md` 即可。
'

# domains/_domain-map.md 模板
DOMAIN_MAP_TEMPLATE='# 域地图

## 限界上下文清单

| 域 | 核心职责 | 实体数 | 依赖的域 |
|---|---|---|---|
| （待填充） | | | |

## 域间通信规则

（描述域之间允许的调用方向和方式）
'

# domains/{context}/_overview.md 模板
DOMAIN_OVERVIEW_TEMPLATE='# {{DOMAIN_NAME}}

> 所属服务:
> 包路径:

## 职责

- （待填充）

## 不负责

- （待填充）

## 核心实体

| 实体类 | 表名 | 说明 |
|---|---|---|
| （待填充） | | |

## 状态机

（如有状态流转，在此描述或链接到 data/status-machines.md）
'

# architecture/overview.md 模板
ARCH_OVERVIEW_TEMPLATE='# 系统架构全景

## 部署拓扑

（描述服务部署关系，可用文字或嵌入架构图链接）

## 服务清单

| 服务 | 职责 | 技术栈 |
|---|---|---|
| （待填充） | | |

## 核心约束

（列出本系统最重要的技术约束，如租户隔离、模块边界等）
'

# architecture/decisions/NNN-template.md
ADR_TEMPLATE='# ADR-{NNN}: {标题}

## 状态

已接受 / 已废弃 / 已替代

## 背景

（什么问题促使了这个决策）

## 决策

（我们选择了什么方案）

## 理由

（为什么选这个方案而不是其他方案）

## 影响

（这个决策带来的约束或后果）
'

# requirement-process.json 模板（空需求列表，脚本按需追加条目）
REQUIREMENT_PROCESS_TEMPLATE='{
  "requirements": []
}'

# 记录自动创建（非 clone）的仓库，用于最后输出提示
CREATED_REPOS=()

# 检查目录是否为空或只有 README.md
_is_bare_repo() {
    local dir="$1"
    local file_count
    file_count=$(find "$dir" -maxdepth 1 -not -path "$dir" ! -name '.git' ! -name 'README.md' ! -name 'README' -print | wc -l)
    [ "$file_count" -eq 0 ]
}

# 确保 biz-tech-docs 存在，不存在或为空则创建默认目录结构
ensure_biz_docs() {
    local ws="$1"
    local biz_dir="$ws/biz-tech-docs"

    if [ -d "$biz_dir" ]; then
        _is_bare_repo "$biz_dir" || return 0
        info "biz-tech-docs 存在但为空（仅有 README），补充目录结构"
    else
        info "biz-tech-docs 不存在，创建默认目录结构"
        mkdir -p "$biz_dir"
    fi

    # 创建目录结构
    local subdirs=(
        "domains"
        "architecture/decisions"
        "data"
        "infra"
        "platform"
        "conventions"
    )
    for subdir in "${subdirs[@]}"; do
        mkdir -p "$biz_dir/$subdir"
    done

    # 写入 INDEX.md
    echo "$BIZ_DOCS_INDEX_TEMPLATE" > "$biz_dir/INDEX.md"

    # 写入各模板文件
    echo "$DOMAIN_MAP_TEMPLATE" > "$biz_dir/domains/_domain-map.md"
    echo "$DOMAIN_OVERVIEW_TEMPLATE" > "$biz_dir/domains/_domain-overview-template.md"
    echo "$ARCH_OVERVIEW_TEMPLATE" > "$biz_dir/architecture/overview.md"
    echo "$ADR_TEMPLATE" > "$biz_dir/architecture/decisions/000-adr-template.md"

    # 写入 .gitignore（忽略模板文件）
    echo "*-template.md" > "$biz_dir/.gitignore"

    # 空目录加 .gitkeep 以便 git 追踪（在模板文件写入之后判断）
    for subdir in "${subdirs[@]}"; do
        local target="$biz_dir/$subdir"
        if [ -z "$(ls -A "$target" 2>/dev/null | grep -v '^\.' || true)" ]; then
            touch "$target/.gitkeep"
        fi
    done

    # 已有 .git 则不重复 init
    [ -d "$biz_dir/.git" ] || git init "$biz_dir" > /dev/null 2>&1

    if [ -d "$biz_dir/.git" ] && [ -n "$(cd "$biz_dir" && git remote get-url origin 2>/dev/null)" ]; then
        # 已关联远程仓库，不算自动创建
        info "已补充 $biz_dir 目录结构"
    else
        info "已创建 $biz_dir（含模板文件）"
        CREATED_REPOS+=("biz-tech-docs")
    fi
}

# 确保 process-docs 存在，不存在则创建默认目录结构并 git init
ensure_agent_process_docs() {
    local ws="$1"
    local apd_dir="$ws/process-docs"

    [ -d "$apd_dir" ] && return 0

    info "process-docs 不存在，创建默认目录结构"
    mkdir -p "$apd_dir/scripts"
    echo "$REQUIREMENT_PROCESS_TEMPLATE" > "$apd_dir/requirement-process.json"
    git init "$apd_dir" > /dev/null 2>&1
    info "已创建 $apd_dir（含 requirement-process.json 模板）"
    CREATED_REPOS+=("process-docs")
}

# 输出自动创建仓库的后续操作提示
print_created_repos_hint() {
    [ ${#CREATED_REPOS[@]} -eq 0 ] && return 0

    local remote_url

    echo ""
    warn "以下仓库为本地创建，需在 GitLab 上手动创建并关联："
    for name in "${CREATED_REPOS[@]}"; do
        if [ "$GIT_PROTOCOL" = "https" ]; then
            remote_url="https://$TEAM_GIT_SERVER/$TEAM_GROUP/$name.git"
        else
            remote_url="git@$TEAM_GIT_SERVER:$TEAM_GROUP/$name.git"
        fi
        echo ""
        echo "  [$name]"
        echo "    1. 在 https://$TEAM_GIT_SERVER/$TEAM_GROUP 上创建空项目 $name（不要勾选初始化 README）"
        echo "    2. 执行以下命令关联远程仓库："
        echo "       cd $WORKSPACE/$name"
        echo "       git remote add origin $remote_url"
        echo "       git add . && git commit -m 'init' && git push -u origin master"
    done
}

# ============================================================
# 全局工具安装
# ============================================================

install_global_tools() {
    info "检查并安装全局工具..."

    for tool in "${GLOBAL_NPM_TOOLS[@]}"; do
        if npm list -g "$tool" &>/dev/null; then
            info "$tool 已安装，跳过"
        else
            info "正在安装 $tool ..."
            npm install -g "$tool" || warn "$tool 安装失败，请手动执行: npm install -g $tool"
        fi
    done
}

# ============================================================
# 初始化操作
# ============================================================

# 从已有工作空间复制
copy_from_existing() {
    local ws="$1"
    local src="$2"
    info "从已有工作空间复制: $src -> $ws"

    # 基础仓库：优先 remote clone，失败则本地 clone
    for repo in "${BASE_REPOS[@]}"; do
        local name
        name=$(repo_name "$repo")
        if [ -d "$ws/$name" ]; then
            warn "$name 已存在，跳过"
        elif [ -d "$src/$name" ]; then
            info "正在 clone $name (from remote) ..."
            git clone "$repo" "$ws/$name" || {
                warn "remote clone 失败，尝试从本地 clone ..."
                git clone "$src/$name" "$ws/$name" || { error "clone $name 失败"; continue; }
            }
        else
            git clone "$repo" "$ws/$name" || { error "clone $name 失败"; continue; }
        fi
    done

    # 复制 projects 目录
    if [ -d "$src/$PROJECTS_DIR" ]; then
        mkdir -p "$ws/$PROJECTS_DIR"
        for dir in "$src/$PROJECTS_DIR"/*/; do
            [ ! -d "$dir" ] && continue
            clone_from_source "$dir" "$ws/$PROJECTS_DIR/$(basename "$dir")"
        done
    fi

    # 复制 process-docs
    if [ -d "$src/process-docs" ]; then
        if [ -d "$ws/process-docs" ]; then
            warn "process-docs 已存在，跳过"
        else
            info "正在复制 process-docs ..."
            cp -r "$src/process-docs" "$ws/process-docs"
        fi
    fi
}

# Clone 基础仓库
clone_base_repos() {
    local ws="$1"
    for repo in "${BASE_REPOS[@]}"; do
        local name
        name=$(repo_name "$repo")
        clone_or_pull "$repo" "$ws/$name" || true
    done
}

# Clone 团队分组仓库
clone_team_group_repos() {
    local ws="$1"
    local group="$2"

    for template in "${TEAM_GROUP_REPO_TEMPLATES[@]}"; do
        local repo="${template//\{group\}/$group}"
        local name
        name=$(repo_name "$repo")
        clone_or_pull "$repo" "$ws/$name" || true
    done
}

# 同步团队项目到 projects/
sync_team_repos() {
    local ws="$1"
    local projects_dir="$ws/$PROJECTS_DIR"
    mkdir -p "$projects_dir"
    [ ${#TEAM_REPOS[@]} -eq 0 ] && return
    info "团队项目同步到 $PROJECTS_DIR/"

    for source in "${TEAM_REPOS[@]}"; do
        local name
        name=$(repo_name "$source")
        clone_from_source "$source" "$projects_dir/$name" || true
    done
}

# 生成 .gitignore
ensure_gitignore() {
    local ws="$1"
    local gitignore="$ws/.gitignore"

    if [ -f "$gitignore" ]; then
        # 已存在则追加缺失的条目
        local changed=0
        for entry in .idea .vscode; do
            if ! grep -q "^${entry}$" "$gitignore"; then
                echo "$entry" >> "$gitignore"
                changed=1
            fi
        done
        [ $changed -eq 1 ] && info "已更新 .gitignore"
    else
        {
            echo ".idea"
            echo ".vscode"
        } > "$gitignore"
        info "已创建 .gitignore"
    fi
}

# 生成 .claude/CLAUDE.md 项目索引
generate_claude_index() {
    local ws="$1"
    local claude_dir="$ws/.claude"
    local claude_md="$claude_dir/CLAUDE.md"

    mkdir -p "$claude_dir"

    {
        echo "# AI 工作空间项目索引"
        echo ""
        echo "## 环境变量"
        echo ""
        echo "- \`JLC_AI_WORKSPACE\` = \`$ws\`"
        echo ""
        echo "## 项目地图"
        echo ""
        echo "| 目录 | 说明 |"
        echo "|------|------|"
        for repo in "${BASE_REPOS[@]}"; do
            local repo_name
            repo_name=$(basename "$repo" .git)
            local repo_desc="基础仓库"
            case "$repo_name" in
                tech-specs)   repo_desc="JLC 公司级技术规范文档，统一团队开发标准" ;;
            esac
            echo "| \`${repo_name}/\` | ${repo_desc} |"
        done
        if [ -d "$ws/biz-tech-docs" ]; then
            echo "| \`biz-tech-docs/\` | 团队业务知识库 |"
        fi
        if [ -d "$ws/$PROJECTS_DIR" ]; then
            echo "| \`$PROJECTS_DIR/\` | 团队项目代码 |"
            for dir in "$ws/$PROJECTS_DIR"/*/; do
                [ ! -d "$dir" ] && continue
                echo "| \`$PROJECTS_DIR/$(basename "$dir")/\` | 团队项目 |"
            done
        fi
        echo "| \`process-docs/\` | Agent 过程产物 |"
    } > "$claude_md"

    info "已生成项目索引: $claude_md"
}

# 确保集中测试仓库中有 .gitlab-ci.yml
ensure_ci_config() {
    local ws="$1"
    local group="$2"
    local testing_repo="$ws/biz-test-regression"

    [ ! -d "$testing_repo/.git" ] && return 0
    [ -f "$testing_repo/.gitlab-ci.yml" ] && return 0

    # 查找 zcode 插件 test-scripting 下的 CI 模板
    local ci_template=""
    for candidate in \
        "$ws/$PROJECTS_DIR"/*/plugins/zcode/skills/test-scripting/templates/gitlab-ci-testing.yml \
        "$ws"/*/plugins/zcode/skills/test-scripting/templates/gitlab-ci-testing.yml; do
        for f in $candidate; do
            if [ -f "$f" ]; then
                ci_template="$f"
                break 2
            fi
        done
    done

    if [ -n "$ci_template" ]; then
        info "初始化 .gitlab-ci.yml 到集中测试仓库（从插件模板复制）"
        cp "$ci_template" "$testing_repo/.gitlab-ci.yml"
        (cd "$testing_repo" && git add .gitlab-ci.yml && git commit -m "ci: initialize CI config from plugin template" 2>/dev/null) || true
        info "已初始化 $testing_repo/.gitlab-ci.yml"
    else
        warn "未找到 CI 模板（gitlab-ci-testing.yml），跳过 .gitlab-ci.yml 初始化"
    fi
}

# 确保集中测试仓库中有 CI 所需的工具脚本
ensure_ci_scripts() {
    local ws="$1"
    local group="$2"
    local testing_repo="$ws/biz-test-regression"

    [ ! -d "$testing_repo/.git" ] && return 0

    local scripts_dir="$testing_repo/scripts"
    mkdir -p "$scripts_dir"

    # 查找 zcode 插件 scripts/ 目录
    local plugin_scripts=""
    local plugin_skill_scripts=""
    for candidate in \
        "$ws/$PROJECTS_DIR"/*/plugins/zcode/scripts \
        "$ws"/*/plugins/zcode/scripts; do
        for dir in $candidate; do
            if [ -d "$dir" ] && [ -f "$dir/parse-feature-tree.js" ]; then
                plugin_scripts="$dir"
                break 2
            fi
        done
    done
    # 部分脚本已迁移到技能目录，同时查找
    for candidate in \
        "$ws/$PROJECTS_DIR"/*/plugins/zcode/skills/init-workspace/scripts \
        "$ws"/*/plugins/zcode/skills/init-workspace/scripts; do
        for dir in $candidate; do
            if [ -d "$dir" ] && [ -f "$dir/setup-junction.js" ]; then
                plugin_skill_scripts="$dir"
                break 2
            fi
        done
    done

    [ -z "$plugin_scripts" ] && return 0

    # 只复制 CI 需要的脚本（不覆盖已存在的文件）
    local ci_scripts=(
        "parse-feature-tree.js"
        "validate-feature-tree.js"
        "merge-proposal.js"
        "check-orphan-scripts.js"
        "gen-selectors.js"
        "gen-test-readme.js"
        "write-manifest.js"
        "impact-analysis.js"
    )

    local copied=0
    for script in "${ci_scripts[@]}"; do
        [ -f "$scripts_dir/$script" ] && continue
        # 优先从共享目录找，回退到技能目录
        if [ -f "$plugin_scripts/$script" ]; then
            cp "$plugin_scripts/$script" "$scripts_dir/$script"
            copied=$((copied + 1))
        elif [ -n "$plugin_skill_scripts" ] && [ -f "$plugin_skill_scripts/$script" ]; then
            cp "$plugin_skill_scripts/$script" "$scripts_dir/$script"
            copied=$((copied + 1))
        fi
    done

    # 复制 lib/ 子目录（含 adapters/ 等子目录）
    if [ -d "$plugin_scripts/lib" ]; then
        mkdir -p "$scripts_dir/lib"
        # 复制 lib/ 下的 .js 文件（不覆盖已存在的）
        for f in "$plugin_scripts/lib/"*.js; do
            [ -f "$f" ] || continue
            local fname=$(basename "$f")
            if [ ! -f "$scripts_dir/lib/$fname" ]; then
                cp "$f" "$scripts_dir/lib/$fname"
                copied=$((copied + 1))
            fi
        done
        # 递归复制 lib/ 下的子目录（如 adapters/）
        for subdir in "$plugin_scripts/lib"/*/; do
            [ -d "$subdir" ] || continue
            local subdirname=$(basename "$subdir")
            mkdir -p "$scripts_dir/lib/$subdirname"
            for f in "$subdir"*.js; do
                [ -f "$f" ] || continue
                local fname=$(basename "$f")
                if [ ! -f "$scripts_dir/lib/$subdirname/$fname" ]; then
                    cp "$f" "$scripts_dir/lib/$subdirname/$fname"
                    copied=$((copied + 1))
                fi
            done
        done
    fi

    if [ $copied -gt 0 ]; then
        (cd "$testing_repo" && git add scripts/ && git commit -m "ci: sync CI scripts from plugin" 2>/dev/null) || true
        info "已同步 $copied 个 CI 脚本到 $scripts_dir"
    fi
}

# 确保集中测试仓库中有 feature-tree/ 目录
ensure_feature_tree() {
    local ws="$1"
    local group="$2"
    local testing_repo="$ws/biz-test-regression"

    [ ! -d "$testing_repo/.git" ] && return 0

    local tree_dir="$testing_repo/feature-tree"
    [ -d "$tree_dir" ] && return 0

    # 查找 zcode 插件 skills/test-scripting 下的功能树参考模板
    local plugin_tree=""
    for candidate in \
        "$ws/$PROJECTS_DIR"/*/plugins/zcode/skills/test-scripting/templates/feature-tree \
        "$ws"/*/plugins/zcode/skills/test-scripting/templates/feature-tree; do
        for dir in $candidate; do
            if [ -d "$dir" ] && { [ -f "$dir/index.json" ] || ls "$dir"/*.md >/dev/null 2>&1; }; then
                plugin_tree="$dir"
                break 2
            fi
        done
    done

    if [ -n "$plugin_tree" ]; then
        info "初始化 feature-tree/ 到集中测试仓库（从插件 referances 模板复制）"
        mkdir -p "$tree_dir"
        cp "$plugin_tree"/*.md "$tree_dir/" 2>/dev/null || true
        if [ -f "$plugin_tree/index.json" ]; then
            cp "$plugin_tree/index.json" "$tree_dir/"
        else
            # index.json 不存在时，尝试用 parse-feature-tree.js 从 Markdown 生成
            local parse_script=""
            for candidate in \
                "$ws/$PROJECTS_DIR"/*/plugins/zcode/scripts/workspace/parse-tree.js \
                "$ws"/*/plugins/zcode/scripts/workspace/parse-tree.js; do
                for f in $candidate; do
                    if [ -f "$f" ]; then parse_script="$f"; break 2; fi
                done
            done
            if [ -n "$parse_script" ]; then
                node "$parse_script" --dir "$tree_dir" 2>/dev/null || true
            else
                echo '{"version":"","pageAbbreviations":{},"pages":{},"flows":{},"featureIndex":{},"deprecatedIds":[],"smokeFeatures":[]}' > "$tree_dir/index.json"
            fi
        fi
        (cd "$testing_repo" && git add feature-tree/ && git commit -m "feat: initialize feature tree from plugin template" 2>/dev/null) || true
        info "已初始化 $tree_dir"
    else
        info "初始化空 feature-tree/ 目录到集中测试仓库"
        mkdir -p "$tree_dir"
        echo '{"version":"","pageAbbreviations":{},"pages":{},"flows":{},"featureIndex":{},"deprecatedIds":[],"smokeFeatures":[]}' > "$tree_dir/index.json"
        (cd "$testing_repo" && git add feature-tree/ && git commit -m "feat: initialize empty feature tree" 2>/dev/null) || true
        info "已创建空 $tree_dir（请后续添加功能树 Markdown 文件）"
    fi
}

# ============================================================
# 共享测试依赖
# ============================================================

# 确保共享测试依赖目录存在
ensure_shared_deps() {
    local ws="$1"
    local deps_dir="$ws/.test-deps"
    local node_modules="$deps_dir/node_modules"

    if [ -d "$node_modules" ]; then
        info "共享测试依赖已存在: $deps_dir"
        return 0
    fi

    info "初始化共享测试依赖..."

    # 查找 init-shared-deps.js 脚本
    local init_script=""
    for candidate in \
        "$ws/$PROJECTS_DIR"/*/plugins/zcode/scripts/workspace/init-shared-deps.js \
        "$ws"/*/plugins/zcode/scripts/workspace/init-shared-deps.js; do
        for f in $candidate; do
            if [ -f "$f" ]; then
                init_script="$f"
                break 2
            fi
        done
    done

    if [ -n "$init_script" ]; then
        JLC_AI_WORKSPACE="$ws" node "$init_script"
    else
        warn "未找到 init-shared-deps.js，跳过共享依赖初始化"
    fi
}

# 为测试仓库创建 junction
setup_testing_repo_junction() {
    local ws="$1"
    local group="$2"
    local testing_repo="$ws/biz-test-regression"

    [ ! -d "$testing_repo" ] && return 0

    local link_path="$testing_repo/node_modules"
    local shared_deps="$ws/.test-deps/node_modules"

    [ ! -d "$shared_deps" ] && return 0
    [ -L "$link_path" ] && return 0  # 已存在链接

    info "创建 node_modules junction: $testing_repo"

    # 查找 setup-junction.js 脚本
    local setup_script=""
    for candidate in \
        "$ws/$PROJECTS_DIR"/*/plugins/zcode/skills/init-workspace/scripts/setup-junction.js \
        "$ws"/*/plugins/zcode/skills/init-workspace/scripts/setup-junction.js \
        "$ws/$PROJECTS_DIR"/*/plugins/zcode/scripts/setup-junction.js \
        "$ws"/*/plugins/zcode/scripts/setup-junction.js; do
        for f in $candidate; do
            if [ -f "$f" ]; then
                setup_script="$f"
                break 2
            fi
        done
    done

    if [ -n "$setup_script" ]; then
        JLC_AI_WORKSPACE="$ws" node "$setup_script" --target "$testing_repo"
    else
        warn "未找到 setup-junction.js，跳过 junction 创建"
    fi
}

# ============================================================
# main
# ============================================================
main() {
    echo "=========================================="
    echo "   AI 工作空间初始化"
    echo "=========================================="
    echo ""

    parse_args "$@"

    info "基础仓库 Git 服务器: $GIT_SERVER"
    info "团队仓库 Git 服务器: $TEAM_GIT_SERVER"

    # 检测环境，自动选择 SSH 或 HTTPS
    GIT_PROTOCOL=$(detect_git_protocol)
    info "使用 Git 协议: $GIT_PROTOCOL"

    # 展开基础仓库模板（替换 {git-server}）
    BASE_REPOS=()
    for url in "${BASE_REPO_TEMPLATES[@]}"; do
        BASE_REPOS+=("${url//\{git-server\}/$GIT_SERVER}")
    done

    # 展开团队分组仓库模板（替换 {team-git-server}，保留 {group} 给 clone_team_group_repos 使用）
    local team_expanded=()
    for url in "${TEAM_GROUP_REPO_TEMPLATES[@]}"; do
        team_expanded+=("${url//\{team-git-server\}/$TEAM_GIT_SERVER}")
    done
    TEAM_GROUP_REPO_TEMPLATES=("${team_expanded[@]}")

    # 协议转换（SSH ↔ HTTPS）
    if [ "$GIT_PROTOCOL" = "https" ]; then
        local converted=()
        for url in "${BASE_REPOS[@]}"; do
            converted+=("$(convert_url "$url" "$GIT_PROTOCOL")")
        done
        BASE_REPOS=("${converted[@]}")

        converted=()
        for url in "${TEAM_GROUP_REPO_TEMPLATES[@]}"; do
            converted+=("$(convert_url "$url" "$GIT_PROTOCOL")")
        done
        TEAM_GROUP_REPO_TEMPLATES=("${converted[@]}")
    fi

    mkdir -p "$WORKSPACE"
    persist_env "JLC_AI_WORKSPACE" "$WORKSPACE"
    ensure_gitignore "$WORKSPACE"

    if [ -n "$COPY_FROM" ]; then
        copy_from_existing "$WORKSPACE" "$COPY_FROM"
    else
        clone_base_repos "$WORKSPACE"
    fi

    clone_team_group_repos "$WORKSPACE" "$TEAM_GROUP"
    ensure_biz_docs "$WORKSPACE"
    ensure_agent_process_docs "$WORKSPACE"
    ensure_feature_tree "$WORKSPACE" "$TEAM_GROUP"
    ensure_ci_config "$WORKSPACE" "$TEAM_GROUP"
    ensure_ci_scripts "$WORKSPACE" "$TEAM_GROUP"
    
    # === 新增：初始化共享测试依赖 ===
    ensure_shared_deps "$WORKSPACE"
    
#    sync_team_repos "$WORKSPACE"
    generate_claude_index "$WORKSPACE"
    install_global_tools

    echo ""
    info "初始化完成！"
    echo ""
    echo "环境变量:"
    echo "  JLC_AI_WORKSPACE=$WORKSPACE"
    echo ""
    echo "目录结构:"
    echo "  $WORKSPACE/"
    ls -1d "$WORKSPACE"/*/ 2>/dev/null | while read -r d; do
        echo "    $(basename "$d")/"
    done

    echo ""
    echo "请在当前终端执行以下命令使环境变量立即生效："
    echo "  export JLC_AI_WORKSPACE=\"$WORKSPACE\" && echo \$JLC_AI_WORKSPACE"

    print_created_repos_hint
}

main "$@"
