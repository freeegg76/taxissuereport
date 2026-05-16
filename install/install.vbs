Set sh  = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

ps     = sh.ExpandEnvironmentStrings("%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe")
script = fso.GetParentFolderName(WScript.ScriptFullName) & "\install.ps1"

If Not fso.FileExists(ps) Then
    MsgBox "PowerShell not found. Please install PowerShell 5.1 or later.", 16, "Install Error"
    WScript.Quit 1
End If

ret = sh.Run("""" & ps & """ -NoProfile -ExecutionPolicy Bypass -File """ & script & """", 1, True)

If ret <> 0 Then
    MsgBox "Installation failed (exit code " & ret & "). Check the PowerShell window for details.", 16, "Install Error"
End If
