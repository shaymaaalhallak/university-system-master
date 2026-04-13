@echo off
start "Backend" cmd /k "cd /d \"c:\Users\shaym\OneDrive\Desktop\UMS\backend\" && npm run dev"
start "Frontend" cmd /k "cd /d \"c:\Users\shaym\OneDrive\Desktop\UMS\frontend\" && npm run dev"
echo.
echo === UMS Servers Started ===
echo Backend: http://localhost:5000/api/health  
echo Frontend: http://localhost:3000 (or next available port)
echo.
pause
