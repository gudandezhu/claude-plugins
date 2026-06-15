#!/usr/bin/env bash
# ============================================================
# Universal Maven Build Script (mvnd / mvn)
# Supports single-module and multi-module projects
# ============================================================

set -euo pipefail

# Parse --dir early so we know where to build
PROJECT_DIR=""
for (( i=1; i<=$#; i++ )); do
    case "${!i}" in
        -d|--dir)
            (( i++ ))
            PROJECT_DIR="${!i}"
            break
            ;;
    esac
done

if [[ -n "$PROJECT_DIR" ]]; then
    if [[ ! -d "$PROJECT_DIR" ]]; then
        echo "[ERROR] Directory not found: $PROJECT_DIR"
        exit 1
    fi
    cd "$PROJECT_DIR"
else
    cd "$(dirname "$0")"
fi

PROJECT_NAME="$(basename "$(pwd)")"

# ============================================================
# Process Management (shared with start.sh)
# ============================================================

get_pid_file() {
    echo "$(pwd)/.zcode-run/${PROJECT_NAME}.pid"
}

get_info_file() {
    echo "$(pwd)/.zcode-run/${PROJECT_NAME}.info"
}

is_process_running() {
    local pid=$1
    if [[ "$OSTYPE" == msys* || "$OSTYPE" == mingw* || "$OSTYPE" == cygwin* ]]; then
        tasklist //FI "PID eq $pid" //FO CSV //NH 2>/dev/null | grep -q "$pid"
    else
        kill -0 "$pid" 2>/dev/null
    fi
}

read_stored_pid() {
    local pid_file
    pid_file=$(get_pid_file)
    if [[ -f "$pid_file" ]]; then
        local pid
        pid=$(cat "$pid_file" 2>/dev/null | tr -d '[:space:]')
        if [[ -n "$pid" ]] && is_process_running "$pid"; then
            echo "$pid"
            return 0
        else
            rm -f "$pid_file" "$(get_info_file)" 2>/dev/null
        fi
    fi
    return 1
}

stop_process() {
    local pid=$1
    if [[ "$OSTYPE" == msys* || "$OSTYPE" == mingw* || "$OSTYPE" == cygwin* ]]; then
        taskkill //F //PID "$pid" 2>/dev/null
        sleep 1
    else
        kill "$pid" 2>/dev/null
        local waited=0
        while is_process_running "$pid" && [ $waited -lt 10 ]; do
            sleep 1
            waited=$((waited + 1))
        done
        if is_process_running "$pid"; then
            kill -9 "$pid" 2>/dev/null
        fi
    fi
}

# Kill java.exe processes whose command line contains the project name (Windows only)
kill_java_by_project() {
    if [[ "$OSTYPE" != msys* && "$OSTYPE" != mingw* && "$OSTYPE" != cygwin* ]]; then
        return
    fi
    local pids
    pids=$(powershell.exe -NoProfile -Command \
        "Get-CimInstance Win32_Process -Filter \"name='java.exe'\" -ErrorAction SilentlyContinue | ForEach-Object { if (\$_.CommandLine -like \"*${PROJECT_NAME}*\") { \$_.ProcessId } }" 2>/dev/null | tr -d '\r\n' | paste -sd ',' -)
    if [[ -n "$pids" ]]; then
        IFS=',' read -ra pid_arr <<< "$pids"
        for p in "${pid_arr[@]}"; do
            echo "[WARN] Killing java.exe PID $p (holds ${PROJECT_NAME} JAR)"
            taskkill //F //PID "$p" 2>/dev/null || true
        done
    fi
}

check_running_service() {
    local pid
    pid=$(read_stored_pid) || true

    if [[ -z "$pid" ]]; then
        return 0
    fi
    if [[ "${STOP_FIRST:-}" == "true" ]] || [[ "$OSTYPE" == msys* || "$OSTYPE" == mingw* || "$OSTYPE" == cygwin* ]]; then
        echo "[WARN] Stopping running instance (PID: $pid) before build..."
        stop_process "$pid"
        rm -f "$(get_pid_file)" "$(get_info_file)"
        echo "[INFO] Instance stopped"
    else
        echo "[WARN] A running instance detected (PID: $pid)"
        echo "[WARN] Build may fail due to JAR file locking on Windows"
        echo "[WARN] Use --stop-first to auto-stop, or run: bash start.sh -d $(pwd) --stop"
        echo
    fi
}

# Detect CPU cores for thread count
CPU_CORES=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)
THREAD_COUNT=$((CPU_CORES / 2))
(( THREAD_COUNT < 2 )) && THREAD_COUNT=2
(( THREAD_COUNT > 8 )) && THREAD_COUNT=8

echo
echo "========================================================"
echo "      ${PROJECT_NAME} Build Script"
echo "========================================================"
echo "  Maven daemon + multi-thread + incremental"
echo "  Threads: ${THREAD_COUNT} | Cores: ${CPU_CORES}"
echo "========================================================"
echo

# Choose build tool: mvnd preferred, fallback to mvn
MVN_CMD=""
if command -v mvnd &>/dev/null; then
    MVN_CMD="mvnd"
elif command -v mvn &>/dev/null; then
    MVN_CMD="mvn"
    echo "[WARN] mvnd not found, fallback to mvn"
else
    echo "[ERROR] Neither mvnd nor mvn found in PATH!"
    echo
    echo "Install Maven: https://maven.apache.org/download.cgi"
    echo "Or mvnd (faster): https://mirrors.aliyun.com/apache/maven/mvnd/"
    exit 1
fi

# Show version
echo "[INFO] ${MVN_CMD} version:"
${MVN_CMD} -version 2>&1 | grep "Apache Maven" || true
echo

# Detect multi-module
IS_MULTI_MODULE=0
if [[ -f pom.xml ]] && grep -q "<module>" pom.xml; then
    IS_MULTI_MODULE=1
fi

if [[ "$IS_MULTI_MODULE" -eq 1 ]]; then
    echo "[INFO] Detected multi-module project"
else
    echo "[INFO] Detected single-module project"
fi
echo

# Default parameters
SKIP_TESTS="-DskipTests"
CLEAN="clean"
GOAL="install"
THREADS="-T ${THREAD_COUNT}"
SINGLE_TEST=""
STOP_FIRST=""
MODULE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        -p|--package)      GOAL="package";   shift ;;
        -c|--no-clean)     CLEAN="";         shift ;;
        -t|--with-tests)   SKIP_TESTS="";    shift ;;
        -s|--single-test)  SINGLE_TEST="$2"; shift 2 ;;
        --dep-tree)        GOAL="dependency:tree"; SKIP_TESTS="-DskipTests"; CLEAN=""; shift ;;
        --stop-first)      STOP_FIRST="true"; shift ;;
        -m|--module)       MODULE="$2";      shift 2 ;;
        -d|--dir)                             shift 2 ;;  # already parsed above
        -T)                THREADS="-T $2";  shift 2 ;;
        -h|--help)         show_help=1;      shift ;;
        *)                 shift ;;
    esac
done

if [[ "${show_help:-0}" -eq 1 ]]; then
    echo
    echo "Usage: $(basename "$0") [options]"
    echo
    echo "Options:"
    echo "  -p, --package      Package only (default: install)"
    echo "  -c, --no-clean     Skip clean (incremental build)"
    echo "  -t, --with-tests   Run tests (default: skip)"
    echo "  -s, --single-test <TestClass>  Run single test class"
    echo "      --dep-tree     Show dependency tree"
    echo "      --stop-first   Stop running service before build"
    echo "  -m, --module <name>  Build specific module with dependencies (-pl -am)"
    echo "                       Use in multi-module project when you only changed one module"
    echo "                       Requires -d pointing to the parent project root"
    echo "  -d, --dir <path>   Project directory (default: script location)"
    echo "  -T N               Thread count (default: auto-detect)"
    echo "  -h, --help         Show help"
    echo
    echo "Auto-detection:"
    echo "  - mvnd preferred, fallback to mvn"
    echo "  - Single/multi-module auto-detected from pom.xml"
    echo "  - Thread count based on CPU cores (2-8)"
    echo
    echo "Examples:"
    echo "  $(basename "$0")                        # clean install, skip tests"
    echo "  $(basename "$0") -p                     # clean package, skip tests"
    echo "  $(basename "$0") -c                     # install (incremental)"
    echo "  $(basename "$0") -p -c                  # package (incremental, fastest)"
    echo "  $(basename "$0") -T 4                   # force 4 threads"
    echo "  $(basename "$0") -s MyServiceAiTest     # run single test class"
    echo "  $(basename "$0") --dep-tree             # show dependency tree"
    echo "  $(basename "$0") -d /path/to/project    # build specific project"
    echo "  $(basename "$0") -d /path/to/parent -m mes  # only build mes and its dependencies"
    exit 0
fi

# Single test mode: run a specific test class
if [[ -n "${SINGLE_TEST:-}" ]]; then
    START_TIME=$(date '+%H:%M:%S')
    echo "[CONFIG] Mode         : single test"
    echo "[CONFIG] Test class   : ${SINGLE_TEST}"
    echo "[CONFIG] Build tool   : ${MVN_CMD}"
    echo "[CONFIG] Project name : ${PROJECT_NAME}"
    echo "[CONFIG] Start time   : ${START_TIME}"
    echo
    echo "------------------------------------------------------------"

    BUILD_ERROR=0
    ${MVN_CMD} test -B -e "-Dtest=${SINGLE_TEST}" "-DfailIfNoTests=false" || BUILD_ERROR=$?

    echo
    echo "------------------------------------------------------------"
    if [[ "$BUILD_ERROR" -eq 0 ]]; then
        END_TIME=$(date '+%H:%M:%S')
        echo
        echo " [SUCCESS] Test passed: ${SINGLE_TEST}"
        echo "   Start: ${START_TIME}  End: ${END_TIME}"
        echo
    else
        echo
        echo " [ERROR] Test failed: ${SINGLE_TEST} (exit code: ${BUILD_ERROR})"
        echo
    fi
    exit $BUILD_ERROR
fi

# Build command
CMD_PARTS=()
[[ -n "$CLEAN" ]] && CMD_PARTS+=("$CLEAN")
CMD_PARTS+=("$GOAL")
[[ -n "$SKIP_TESTS" ]] && CMD_PARTS+=("$SKIP_TESTS")
CMD_PARTS+=("-T" "$THREAD_COUNT")
if [[ -n "$MODULE" ]]; then
    CMD_PARTS+=("-pl" "$MODULE" "-am")
fi
FULL_CMD="${MVN_CMD} ${CMD_PARTS[*]}"
START_TIME=$(date '+%H:%M:%S')

echo "[CONFIG] Build tool     : ${MVN_CMD}"
echo "[CONFIG] Project name   : ${PROJECT_NAME}"
echo "[CONFIG] Project type   : ${IS_MULTI_MODULE} (1=multi, 0=single)"
echo "[CONFIG] Thread count   : ${THREAD_COUNT}"
echo "[CONFIG] Goal           : ${GOAL}"
echo "[CONFIG] Clean          : ${CLEAN:-"(none)"}"
echo "[CONFIG] Skip tests     : ${SKIP_TESTS:-"(no)"}"
echo "[CONFIG] Module         : ${MODULE:-"(all)"}"
echo "[CONFIG] Full command   : ${FULL_CMD}"
echo "[CONFIG] Start time     : ${START_TIME}"
echo
echo "------------------------------------------------------------"

# Check for running service (may lock JAR files on Windows)
check_running_service

# Execute build
BUILD_ERROR=0
BUILD_OUTPUT=""
BUILD_OUTPUT=$(${MVN_CMD} "${CMD_PARTS[@]}" 2>&1) || BUILD_ERROR=$?
echo "$BUILD_OUTPUT"

# Retry on Windows file lock errors
if [[ "$BUILD_ERROR" -ne 0 ]] && [[ "$OSTYPE" == msys* || "$OSTYPE" == mingw* || "$OSTYPE" == cygwin* ]]; then
    if echo "$BUILD_OUTPUT" | grep -qiE "used by another process|locked|cannot delete|unable to delete|access is denied|the process cannot access|being used by another process"; then
        echo
        echo "[WARN] File lock detected, force-killing Java processes for ${PROJECT_NAME}..."
        # Stop mvnd daemon (may hold JAR handles)
        if [[ "$MVN_CMD" == "mvnd" ]]; then
            mvnd --stop 2>/dev/null || true
            sleep 2
        fi
        # Kill java.exe whose command line contains project name
        kill_java_by_project
        sleep 2
        BUILD_ERROR=0
        BUILD_OUTPUT=$(${MVN_CMD} "${CMD_PARTS[@]}" 2>&1) || BUILD_ERROR=$?
        echo "$BUILD_OUTPUT"
    fi
fi

# Show result
echo
echo "------------------------------------------------------------"
if [[ "$BUILD_ERROR" -eq 0 ]]; then
    END_TIME=$(date '+%H:%M:%S')
    echo
    echo " [SUCCESS] Build successful!"
    echo
    echo "   Start: ${START_TIME}"
    echo "   End  : ${END_TIME}"
    echo
    echo "   Output:"
    echo

    JAR_COUNT=0
    if [[ "$IS_MULTI_MODULE" -eq 1 ]]; then
        while IFS= read -r jar; do
            echo "     ${jar}"
            ((JAR_COUNT++)) || true
        done < <(find . -path "*/target/*.jar" ! -name "*-sources.jar" ! -name "*-javadoc.jar" 2>/dev/null | sort)
    else
        while IFS= read -r jar; do
            echo "     ${jar}"
            ((JAR_COUNT++)) || true
        done < <(find ./target -name "*.jar" ! -name "*-sources.jar" ! -name "*-javadoc.jar" 2>/dev/null | sort)
    fi

    if [[ "$JAR_COUNT" -eq 0 ]]; then
        echo "     (no jar files found in target directories)"
    fi
    echo
else
    echo
    echo " [ERROR] Build failed! Error code: ${BUILD_ERROR}"
    echo
fi

exit $BUILD_ERROR
