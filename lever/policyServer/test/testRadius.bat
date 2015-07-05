@echo off
REM --------------------------------------------------------------
REM LEVER RADIUS TEST
REM Usage testRadius.sh <auth|acct|all> <count>
REM --------------------------------------------------------------

REM AAABASEDIR=/home/francisco/AAA

REM  Usually this need not be changed
SET _THIS_FILE_PATH=%~dp0
SET TESTFILES=%_THIS_FILE_PATH%
SET BINDIR=%AAABASEDIR%\bin
SET RUNDIR=%AAABASEDIR%\run
SET RADIUS=%BINDIR%\aaa-rt
SET DIAMETER=%BINDIR%\aaa-dt

SET RADIUSAUTH=%BINDIR%\aaa-rt -remoteAddress 127.0.0.1:1812
SET RADIUSACCT=%BINDIR%\aaa-rt -remoteAddress 127.0.0.1:1812
SET COMMAND="%BINDIR%\aaa-cmd -login admin -password admin"

REM   Test parameters

SET Secret=secret
SET REQUESTFILE=%_THIS_FILE_PATH%request.txt

SET User_Name=miusuario@speedy
SET NAS_IP_Address=127.0.0.1
SET NAS_Port="1001"
SET Acct_Session_Id=1-1
SET Framed_IP_Address=10.0.0.1

SET command=%1
SET count=%2
SET overlap=1
if [%command%] == [] (
    SET command=all
)
if [%count%] == [] SET count=1

REM Create output directory
if not exist %_THIS_FILE_PATH%\out (
    mkdir %_THIS_FILE_PATH%\out
)

REM   Delete Garbage
del /Q %_THIS_FILE_PATH%\out\*.* 2>nul

if %command% == acct goto AccountingRequest

:AccessRequest
    REM   Access request -------------------------------------------------------------
    echo.
    echo Access request
    echo.

    REM   Compose the packet
    echo User-Name=%User_Name% > %REQUESTFILE%
    echo Acct-Session-Id=%Acct_Session_Id% >> %REQUESTFILE%
    echo NAS-IP-Address=%NAS_IP_Address% >> %REQUESTFILE%
    echo NAS-Port=%NAS_Port% >> %REQUESTFILE%

    REM   Send the packet
    %RADIUSAUTH% -count %count% -overlap %overlap% -debug debug -secret %Secret% -code Access-Request -request @%REQUESTFILE% -outputAttributesFile %TESTFILES%\out\access-request.txt

if %command% == auth goto:EOF

:AccountingRequest

    REM   Account Start -------------------------------------------------------------
    echo.
    echo Account start
    echo.

    REM   Compose the packet
    echo User-Name=%User_Name%>%REQUESTFILE%
    echo Acct-Session-Id=%Acct_Session_Id%>>%REQUESTFILE%
    echo NAS-IP-Address=%NAS_IP_Address%>>%REQUESTFILE%
    echo NAS-Port=%NAS_Port%>>%REQUESTFILE%
    echo Acct-Status-Type="Start">>%REQUESTFILE%

    REM   Send the packet
    %RADIUSACCT% -count %count% -overlap %overlap% -debug verbose -secret %Secret% -code Accounting-Request -request @%REQUESTFILE% -outputAttributesFile %TESTFILES%\out\account-start.txt



