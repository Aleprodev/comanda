@echo off
rem Sube las claves y publica Comanda en el Cloud Server de DonWeb. Pide la contrasena de root UNA vez.
type "%~dp0..\server\.env" | ssh -o StrictHostKeyChecking=accept-new root@201.32.132.192 "mkdir -p /opt/comanda/server && cat > /opt/comanda/server/.env && curl -fsSL https://raw.githubusercontent.com/Aleprodev/comanda/main/deploy/setup.sh | bash"
echo.
echo Si arriba dice "Listo: https://..." ya esta publicado.
pause
