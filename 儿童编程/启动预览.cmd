@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules\vite\bin\vite.js (
    echo 正在安装项目依赖，请保持联网...
    call npm ci --no-audit --no-fund
    if errorlevel 1 goto fail
)
start "" http://localhost:5178
call npm run dev
goto end
:fail
echo 依赖安装失败，请检查网络后重试。
pause
:end
