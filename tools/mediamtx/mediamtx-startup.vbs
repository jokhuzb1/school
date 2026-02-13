' MediaMTX Silent Startup Script
' Bu script MediaMTX ni fonda ishga tushiradi (hech qanday oyna ko'rsatmaydi)
' Windows Startup papkasiga qo'shish uchun:
' 1. Win+R bosing, "shell:startup" kiriting
' 2. Bu faylga shortcut yarating

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
WshShell.CurrentDirectory = fso.GetParentFolderName(WScript.ScriptFullName)
If fso.FileExists(WshShell.CurrentDirectory & "\\mediamtx.autogen.yml") Then
  WshShell.Run "cmd /c mediamtx.exe mediamtx.autogen.yml", 0, False
Else
  WshShell.Run "cmd /c mediamtx.exe mediamtx.yml", 0, False
End If
