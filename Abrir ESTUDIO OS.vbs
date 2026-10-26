Option Explicit
Dim shell, files, root, script
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
root = files.GetParentFolderName(WScript.ScriptFullName)
script = files.BuildPath(root, "scripts\open-estudio.ps1")
shell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -File " & Chr(34) & script & Chr(34), 0, False
