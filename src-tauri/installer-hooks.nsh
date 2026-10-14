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

; Give shortcuts their own icon path instead of reusing Windows' cached EXE icon.
; Update the existing link through COM to preserve its AppUserModelID and options.
Var HeyboxShortcutReady
Var HeyboxStartMenuFolder

!macro HeyboxSetShortcutIcon shortcut target icon
  !insertmacro IsShortcutTarget "${shortcut}" "${target}"
  Pop $4
  ${If} $4 = 1
    !insertmacro ComHlpr_CreateInProcInstance ${CLSID_ShellLink} ${IID_IShellLink} r0 ""
    ${If} $0 P<> 0
      ${IUnknown::QueryInterface} $0 '("${IID_IPersistFile}",.r1)'
      ${If} $1 P<> 0
        ${IPersistFile::Load} $1 '("${shortcut}", ${STGM_READWRITE})i.r2'
        ${If} $2 >= 0
          ${IShellLink::SetIconLocation} $0 '(w "${icon}",0)i.r2'
          ${If} $2 >= 0
            ${IPersistFile::Save} $1 '("${shortcut}",1)i.r2'
            ${If} $2 >= 0
              System::Call 'SHELL32::SHChangeNotify(i0x2000,i0x0005,w "${shortcut}",p0)'
            ${EndIf}
          ${EndIf}
        ${EndIf}
        ${IUnknown::Release} $1 ""
      ${EndIf}
      ${IUnknown::Release} $0 ""
    ${EndIf}
  ${EndIf}
!macroend

Function HeyboxRefreshShortcutIcons
  ${If} $HeyboxShortcutReady != 1
    Return
  ${EndIf}
  ${IfNot} ${FileExists} "$INSTDIR\shortcut-icon-rounded.ico"
    Return
  ${EndIf}
  Push $0
  Push $1
  Push $2
  Push $3
  Push $4
  !insertmacro HeyboxSetShortcutIcon "$DESKTOP\小黑盒盒.lnk" "$INSTDIR\小黑盒盒.exe" "$INSTDIR\shortcut-icon-rounded.ico"
  !insertmacro HeyboxSetShortcutIcon "$SMPROGRAMS\小黑盒盒.lnk" "$INSTDIR\小黑盒盒.exe" "$INSTDIR\shortcut-icon-rounded.ico"
  ${If} $HeyboxStartMenuFolder != ""
    !insertmacro HeyboxSetShortcutIcon "$SMPROGRAMS\$HeyboxStartMenuFolder\小黑盒盒.lnk" "$INSTDIR\小黑盒盒.exe" "$INSTDIR\shortcut-icon-rounded.ico"
  ${EndIf}
  Pop $4
  Pop $3
  Pop $2
  Pop $1
  Pop $0
FunctionEnd

!macro NSIS_HOOK_POSTINSTALL
  StrCpy $HeyboxShortcutReady 1
  StrCpy $HeyboxStartMenuFolder $AppStartMenuFolder
  ; Covers silent/passive installs and upgrades of existing shortcuts.
  Call HeyboxRefreshShortcutIcons
!macroend

Function .onGUIEnd
  ; The interactive finish page can create the desktop link after POSTINSTALL.
  Call HeyboxRefreshShortcutIcons
FunctionEnd
