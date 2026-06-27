@echo off
echo.
echo  ==========================================
echo   NEUROMAT Clinic Management System
echo  ==========================================
echo.
echo  Starting frontend and backend servers...
echo.

start cmd /k "cd /d E:\FinalClinicManagement_System\frontend && npm.cmd run dev"
ping 127.0.0.1 -n 3 > nul
start cmd /k "cd /d E:\FinalClinicManagement_System\backend && node server.js"

echo.
echo  Frontend: http://localhost:5173
echo  Backend:  http://localhost:3001
echo.
echo  Login Credentials:
echo  - Admin:        admin@neuromat.com / admin 123
echo  - Reception:    reception@neuromat.com / reception123
echo  - Dr. Shakir:   shakir@neuromat.com / doctor123
echo  - Dr. Afifa:    afifa@neuromat.com / doctor123
echo  - Med Store:    store@neuromat.com / store123
echo.
pause
