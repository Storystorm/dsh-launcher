' DeepSeek Harness 启动器 - Windows 无窗口启动脚本
' 双击运行:静默启动控制面板并打开浏览器(使用随附的 node.exe)
Set ws = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dirPath = fso.GetParentFolderName(WScript.ScriptFullName)
nodePath = dirPath & "\node.exe"
scriptPath = dirPath & "\launcher-server.js"
If fso.FileExists(nodePath) And fso.FileExists(scriptPath) Then
    ws.CurrentDirectory = dirPath
    ws.Run """" & nodePath & """ """ & scriptPath & """", 0, False
Else
    MsgBox "文件不完整:请保持 node.exe、launcher-server.js 与本脚本在同一文件夹。", 48, "DeepSeek Harness 启动器"
End If
