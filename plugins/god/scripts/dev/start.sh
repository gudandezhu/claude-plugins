#!/usr/bin/env bash
# ============================================================
# Universal Spring Boot Start Script
# Auto-detects JAR file, supports debug/profiles/memory options
# ============================================================

set -euo pipefail

# Parse --dir early so we know where to start
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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Auto-detect JAR file
detect_jar() {
    local jar=""
    # 1. Multi-module: find *-starter/target/*.jar
    jar=$(find . -path "*-starter/target/*.jar" ! -name "*-sources.jar" ! -name "*-javadoc.jar" 2>/dev/null | head -1)
    # 2. Fallback: single-module target/*.jar
    [[ -z "$jar" ]] && jar=$(find ./target -name "*.jar" ! -name "*-sources.jar" ! -name "*-javadoc.jar" 2>/dev/null | head -1)
    echo "$jar"
}

# ============================================================
# Process Management Utilities
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
            # Stale PID file, clean up
            rm -f "$pid_file" "$(get_info_file)" 2>/dev/null
        fi
    fi
    return 1
}

detect_port() {
    local port=""
    for f in $(find . -path "*/src/main/resources/application*.yml" -o -path "*/src/main/resources/application*.yaml" -o -path "*/src/main/resources/application*.properties" 2>/dev/null); do
        if [[ "$f" == *.yml || "$f" == *.yaml ]]; then
            port=$(grep -A5 'server:' "$f" 2>/dev/null | grep 'port:' | head -1 | grep -oE '[0-9]+') || true
        elif [[ "$f" == *.properties ]]; then
            port=$(grep 'server.port' "$f" 2>/dev/null | head -1 | grep -oE '[0-9]+') || true
        fi
        [[ -n "$port" ]] && break
    done
    echo "${port:-8080}"
}

write_pid_info() {
    local pid=$1
    local jar=$2
    local port=$3
    mkdir -p "$(pwd)/.zcode-run"
    echo "$pid" > "$(get_pid_file)"
    cat > "$(get_info_file)" <<EOF
PID=$pid
JAR=$jar
PORT=$port
START_TIME=$(date '+%Y-%m-%d %H:%M:%S')
PROJECT=$PROJECT_NAME
EOF
    # Auto-append .zcode-run/ to .gitignore
    if [[ -f "$(pwd)/.gitignore" ]] && ! grep -q '^\.zcode-run/$' "$(pwd)/.gitignore"; then
        echo ".zcode-run/" >> "$(pwd)/.gitignore"
    fi
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

# ============================================================
# Default parameters & Argument parsing
# ============================================================

JAR_FILE=""
PROFILES=""
JVM_OPTS="-Xms512m -Xmx1024m"
DEBUG_MODE=""
AUTO_BUILD=""
OPENAPI_BUILD=""
MODE="foreground"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        -j|--jar)
            JAR_FILE="$2"; shift 2 ;;
        -p|--profiles)
            PROFILES="$2"; shift 2 ;;
        -d|--dir)
            shift 2 ;;  # already parsed above
        --debug)
            DEBUG_MODE="-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005"; shift ;;
        -m|--memory)
            JVM_OPTS="-Xms$2 -Xmx$2"; shift 2 ;;
        -b|--build)
            AUTO_BUILD=true; shift ;;
        --background)
            MODE="background"; shift ;;
        --stop)
            MODE="stop"; shift ;;
        --status)
            MODE="status"; shift ;;
        --openapi)
            OPENAPI_BUILD=true; shift ;;
        -h|--help)
            echo
            echo "Usage: $0 [options]"
            echo
            echo "Options:"
            echo "  -j, --jar FILE     JAR file path (default: auto-detect)"
            echo "  -p, --profiles     Spring profiles"
            echo "  -d, --dir <path>   Project directory (default: script location)"
            echo "      --debug        Enable remote debug (port 5005)"
            echo "  -m, --memory SIZE  JVM memory (default: 512m-1024m)"
            echo "  -b, --build        Auto-build if JAR not found"
            echo "      --background   Start in background with PID tracking"
            echo "      --stop         Stop running instance"
            echo "      --status       Check running status"
            echo "      --openapi      Run openapi:build after service is ready"
            echo "  -h, --help         Show help"
            echo
            echo "Auto-detection:"
            echo "  - Multi-module: *-starter/target/*.jar"
            echo "  - Single-module: target/*.jar"
            echo
            echo "Examples:"
            echo "  $0                        # Auto-detect and start (foreground)"
            echo "  $0 --background           # Start in background with PID tracking"
            echo "  $0 --stop                 # Stop running instance"
            echo "  $0 --status               # Check if service is running"
            echo "  $0 -b                     # Auto-build and start"
            echo "  $0 --debug                # Start with debug mode"
            echo "  $0 -m 2048m               # Start with 2GB memory"
            echo "  $0 -p local,fast          # Start with profiles"
            echo "  $0 -d /path/to/project    # Start specific project"
            exit 0 ;;
        *)
            shift ;;
    esac
done

# ============================================================
# Handle --stop mode (no JAR needed)
# ============================================================

if [[ "$MODE" == "stop" ]]; then
    echo "[INFO] Stopping ${PROJECT_NAME}..."
    pid=$(read_stored_pid) || true
    if [[ -z "$pid" ]]; then
        echo "[WARN] No running process found for ${PROJECT_NAME}"
        exit 0
    fi
    stop_process "$pid"
    if is_process_running "$pid"; then
        echo "[ERROR] Failed to stop process $pid"
        exit 1
    fi
    rm -f "$(get_pid_file)" "$(get_info_file)"
    echo "[INFO] Process $pid stopped successfully"
    exit 0
fi

# ============================================================
# Handle --status mode (no JAR needed)
# ============================================================

if [[ "$MODE" == "status" ]]; then
    pid=$(read_stored_pid) || true
    if [[ -n "$pid" ]]; then
        info_file_path="$(get_info_file)"
        port=$(grep '^PORT=' "$info_file_path" 2>/dev/null | cut -d= -f2)
        start_time=$(grep '^START_TIME=' "$info_file_path" 2>/dev/null | cut -d= -f2)
        echo "[INFO] ${PROJECT_NAME} is RUNNING"
        echo "  PID       : $pid"
        echo "  Port      : ${port:-unknown}"
        echo "  Start time: ${start_time:-unknown}"
        exit 0
    else
        echo "[INFO] ${PROJECT_NAME} is NOT RUNNING"
        exit 1
    fi
fi

# Auto-detect JAR if not specified
[[ -z "$JAR_FILE" ]] && JAR_FILE="$(detect_jar)"

echo
echo "========================================================"
echo "      ${PROJECT_NAME} Start Script"
echo "========================================================"
echo

# Check if JAR file exists
if [[ ! -f "$JAR_FILE" ]]; then
    if [[ "$AUTO_BUILD" == "true" ]]; then
        echo "[WARN] JAR not found, starting build..."
        echo
        bash "$SCRIPT_DIR/build.sh" -d "$(pwd)"
        if [[ $? -ne 0 ]]; then
            echo
            echo "[ERROR] Build failed, cannot start."
            exit 1
        fi
        echo
        echo "[INFO] Build complete, starting service..."
        echo
        # Re-detect JAR after build
        JAR_FILE="$(detect_jar)"
        if [[ ! -f "$JAR_FILE" ]]; then
            echo "[ERROR] JAR still not found after build: $JAR_FILE"
            exit 1
        fi
    else
        echo "[ERROR] JAR not found: $JAR_FILE"
        echo
        echo "Please run: ./build.sh"
        echo "Or use -b option to auto-build"
        exit 1
    fi
fi

START_TIME=$(date '+%Y-%m-%d %H:%M:%S')

SPRING_OPTS=""
[[ -n "$PROFILES" ]] && SPRING_OPTS="--spring.profiles.active=$PROFILES"

APP_PORT=$(detect_port)

echo "[INFO] Project : $PROJECT_NAME"
echo "[INFO] JAR     : $JAR_FILE"
echo "[INFO] Port    : $APP_PORT"
[[ -n "$PROFILES" ]] && echo "[INFO] Profiles: $PROFILES"
echo "[INFO] JVM     : $JVM_OPTS"
echo "[INFO] Mode    : $MODE"
[[ -n "$DEBUG_MODE" ]] && echo "[INFO] Debug   : enabled (port 5005)"
echo "[INFO] Start   : $START_TIME"

if [[ "$MODE" == "background" ]]; then
    # Check for stale PID file from previous run
    stored_pid=$(read_stored_pid) || true
    if [[ -n "$stored_pid" ]]; then
        echo "[ERROR] Previous instance (PID: $stored_pid) is still running"
        echo "[ERROR] Stop it first: bash start.sh -d $(pwd) --stop"
        exit 1
    fi

    # Check port conflict
    if netstat -ano 2>/dev/null | grep -q ":${APP_PORT}.*LISTENING"; then
        blocking_pid=$(netstat -ano 2>/dev/null | grep ":${APP_PORT}.*LISTENING" | awk '{print $NF}' | head -1)
        echo "[ERROR] Port ${APP_PORT} is already in use by PID: ${blocking_pid}"
        echo "[ERROR] Stop it first: bash start.sh -d $(pwd) --stop"
        exit 1
    fi

    mkdir -p "$(pwd)/.zcode-run"
    LOG_FILE="$(pwd)/.zcode-run/stdout.log"

    echo
    echo "------------------------------------------------------------"
    echo "[INFO] Starting service in background..."
    echo "------------------------------------------------------------"

    nohup java $JVM_OPTS $DEBUG_MODE -jar "$JAR_FILE" $SPRING_OPTS > "$LOG_FILE" 2>&1 &
    MSYS_PID=$!

    echo "[INFO] Service started (MSYS PID: $MSYS_PID)"
    echo "[INFO] Waiting for port ${APP_PORT}..."

    # Wait for port, checking for early process crash
    WAIT_OK=0
    WAIT_ELAPSED=0
    while [ $WAIT_ELAPSED -lt 120 ]; do
        # Check if port is ready
        if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${APP_PORT}" 2>/dev/null | grep -qE "200|401|403|404|302"; then
            WAIT_OK=1
            break
        fi
        # Check if Java process died (via port not listening and PID file shows crash)
        if [[ $WAIT_ELAPSED -gt 10 ]]; then
            WIN_CHECK=$(netstat -ano 2>/dev/null | grep ":${APP_PORT}.*LISTENING" | head -1) || true
            if [[ -z "$WIN_CHECK" ]] && ! kill -0 $MSYS_PID 2>/dev/null; then
                echo "[ERROR] Java process crashed during startup"
                echo "[ERROR] Last 20 lines of log:"
                tail -20 "$LOG_FILE"
                exit 1
            fi
        fi
        sleep 2
        WAIT_ELAPSED=$((WAIT_ELAPSED + 2))
    done

    if [[ "$WAIT_OK" -eq 1 ]]; then
        # On Windows (Git Bash/MSYS), $! returns the MSYS wrapper PID, not the real Windows PID.
        # Use netstat to find the actual java.exe PID listening on the port.
        WIN_PID=""
        if [[ "$OSTYPE" == msys* || "$OSTYPE" == mingw* || "$OSTYPE" == cygwin* ]]; then
            WIN_PID=$(netstat -ano 2>/dev/null | grep ":${APP_PORT}.*LISTENING" | awk '{print $NF}' | head -1 | tr -d '[:space:]')
        fi
        FINAL_PID="${WIN_PID:-$MSYS_PID}"
        write_pid_info "$FINAL_PID" "$JAR_FILE" "$APP_PORT"

        echo "[INFO] Service is ready on port ${APP_PORT} (PID: $FINAL_PID)"
        echo "[INFO] PID file : $(get_pid_file)"
        echo "[INFO] Log file: $LOG_FILE"
        echo "[INFO] To stop  : bash start.sh -d $(pwd) --stop"

        # OpenAPI code generation (requires running service)
        if [[ "$OPENAPI_BUILD" == "true" ]]; then
            echo
            echo "------------------------------------------------------------"
            echo "[INFO] Running openapi-generator-plugin:build..."
            echo "------------------------------------------------------------"
            # Find the submodule with openapi-generator-plugin configured
            OPENAPI_MODULE=""
            for pom in $(find . -name "pom.xml" -not -path "./pom.xml" 2>/dev/null); do
                if grep -q "openapi-generator-plugin" "$pom" 2>/dev/null; then
                    OPENAPI_MODULE=$(basename "$(dirname "$pom")")
                    echo "[INFO] Found openapi plugin in module: $OPENAPI_MODULE"
                    break
                fi
            done
            if [[ -n "$OPENAPI_MODULE" ]]; then
                # Use full coordinates without version — Maven resolves from pom.xml
                OPENAPI_CMD="mvn com.szjlc.plugin:openapi-generator-plugin:build -pl $OPENAPI_MODULE -f $(pwd)/pom.xml"
                echo "[INFO] Command: $OPENAPI_CMD"
                OPENAPI_ERROR=0
                eval "$OPENAPI_CMD" 2>&1 || OPENAPI_ERROR=$?
                if [[ "$OPENAPI_ERROR" -eq 0 ]]; then
                    echo
                    echo " [SUCCESS] openapi:build completed"
                    echo
                else
                    echo
                    echo " [ERROR] openapi:build failed (exit code: $OPENAPI_ERROR)"
                    echo
                    exit $OPENAPI_ERROR
                fi
            else
                echo "[WARN] No module with openapi-generator-plugin found, skipping"
            fi
        fi
    else
        echo "[ERROR] Service did not start within 120 seconds"
        echo "[ERROR] Check log: $LOG_FILE"
        echo "[ERROR] Last 20 lines:"
        tail -20 "$LOG_FILE"
        exit 1
    fi
else
    echo
    echo "------------------------------------------------------------"
    echo "[INFO] Starting service... (Press Ctrl+C to stop)"
    echo "------------------------------------------------------------"

    # Foreground mode (original behavior)
    exec java $JVM_OPTS $DEBUG_MODE -jar "$JAR_FILE" $SPRING_OPTS
fi
