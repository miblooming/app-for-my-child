@echo off
chcp 65001 >nul

cd /d "%~dp0"

echo ==============================
echo Git 同步开始
echo 仓库目录：%cd%
echo ==============================

if not exist ".git" (
    echo 当前目录不是 Git 仓库：%cd%
    pause
    exit /b 1
)

set COMMIT_MSG=阶段性备份 %date% %time%

echo.
echo 执行 git add -A
git add -A

echo.
echo 执行 git commit
git commit -m "%COMMIT_MSG%"

echo.
echo 执行 git push
git push

echo.
echo ==============================
echo Git 同步完成
echo ==============================

pause