CALL cd %~dp0
CALL deactivate
CALL RMDIR .\env /s /q
CALL python -m virtualenv env -p python
CALL .\update.bat