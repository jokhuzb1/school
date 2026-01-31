' MediaMTX Silent Startup Script
' Bu script MediaMTX ni fonda ishga tushiradi (hech qanday oyna ko'rsatmaydi)
' Windows Startup papkasiga qo'shish uchun:
' 1. Win+R bosing, "shell:startup" kiriting
' 2. Bu faylga shortcut yarating

Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "d:\projects-advanced\school\tools\mediamtx"
WshShell.Run "cmd /c mediamtx.exe mediamtx.yml", 0, False
