@echo off
setlocal
echo Publishing Yapper++...
dotnet publish src\YapperPlusPlus.csproj -c Release
if errorlevel 1 goto :fail

echo Copying exe to dev-build\...
if not exist dev-build mkdir dev-build
copy /y "src\bin\Release\net6.0-windows\win-x64\publish\yapperplusplus.exe" "dev-build\yapperplusplus.exe"
if errorlevel 1 goto :fail

echo.
echo Done. Now edit dep\build.build, then:
echo    git add . ^&^& git commit -m "Y1.1BH" ^&^& git push
goto :eof

:fail
echo.
echo BUILD FAILED.
exit /b 1
