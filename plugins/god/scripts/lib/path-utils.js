"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));

// Find config files in grouped structure: features/*/subDir/configName
// Skips entries matching subDir name to avoid duplicate with features/subDir/
function findGroupedConfigs(projectRoot, subDir, configName) {
    var results = [];
    var featuresDir = path.join(projectRoot, 'features');
    if (fs.existsSync(featuresDir)) {
        for (var _i = 0, _a = fs.readdirSync(featuresDir, { withFileTypes: true }); _i < _a.length; _i++) {
            var groupDir = _a[_i];
            if (!groupDir.isDirectory() || groupDir.name === subDir) continue;
            var candidate = path.join(featuresDir, groupDir.name, subDir, configName);
            if (fs.existsSync(candidate)) {
                results.push(candidate);
            }
        }
    }
    return results;
}

// Normalize MSYS/Git Bash paths: /c/path -> C:/path
function normalizeMsysPath(p) {
    if (typeof p !== 'string') return p;
    var match = p.match(/^\/([a-zA-Z])\//);
    if (match) {
        return match[1].toUpperCase() + ':/' + p.slice(3);
    }
    return p;
}

module.exports = { findGroupedConfigs: findGroupedConfigs, normalizeMsysPath: normalizeMsysPath };
