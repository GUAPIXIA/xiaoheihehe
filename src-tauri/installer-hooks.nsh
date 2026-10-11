; Set the first-install default before displaying the directory picker.
; Preserve upgrades and the user's subsequent directory choice.
!define MUI_CUSTOMFUNCTION_GUIINIT HeyboxChooseInstallDir
Function HeyboxChooseInstallDir
  Push $0
  ReadRegStr $0 SHCTX "Software\heybox\小黑盒盒" ""
  ${If} $INSTDIR == "$LOCALAPPDATA\小黑盒盒"
  ${AndIf} $0 == ""
  ${AndIf} ${FileExists} "D:\"
    StrCpy $INSTDIR "D:\Apps\HeyboxCommunity"
  ${EndIf}
  Pop $0
FunctionEnd

!macro NSIS_HOOK_PREINSTALL
  ${If} ${Silent}
    Call HeyboxChooseInstallDir
  ${EndIf}
!macroend
