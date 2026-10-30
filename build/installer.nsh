; VN Timeline Engine – Zusätze für den Windows-Installer (electron-builder / NSIS)
; Seite „Zusätzliche Aufgaben“ mit Häkchen für die Desktop-Verknüpfung.
; Die Wahl wird gemerkt, damit Updates (auch stille Auto-Updates) sie beibehalten.

!ifndef BUILD_UNINSTALLER
  !include nsDialogs.nsh
  !include LogicLib.nsh

  Var VnDesk
  Var VnDeskCb

  !macro customInit
    ReadRegStr $0 HKCU "Software\VN Timeline Engine" "DesktopShortcut"
    ${If} $0 == "0"
      StrCpy $VnDesk "0"
    ${Else}
      StrCpy $VnDesk "1"
    ${EndIf}
  !macroend

  ; Die Seiten-Funktionen stehen im Makro, weil MUI erst später geladen wird
  !macro customPageAfterChangeDir
    Page custom VnTasksPage VnTasksLeave

    Function VnTasksPage
      ${If} $LANGUAGE == 1031
        !insertmacro MUI_HEADER_TEXT "Zusätzliche Aufgaben" "Was soll der Installer noch erledigen?"
      ${Else}
        !insertmacro MUI_HEADER_TEXT "Additional tasks" "What else should the installer do?"
      ${EndIf}
      nsDialogs::Create 1018
      Pop $0
      ${If} $LANGUAGE == 1031
        ${NSD_CreateCheckbox} 0 0 100% 14u "Verknüpfung auf dem Desktop erstellen"
      ${Else}
        ${NSD_CreateCheckbox} 0 0 100% 14u "Create a desktop shortcut"
      ${EndIf}
      Pop $VnDeskCb
      ${If} $VnDesk == "1"
        ${NSD_Check} $VnDeskCb
      ${EndIf}
      ${If} $LANGUAGE == 1031
        ${NSD_CreateLabel} 0 26u 100% 40u "Ein Eintrag im Startmenü wird immer angelegt.$\r$\nProjekte, Einstellungen und Spielstände bleiben bei Updates erhalten."
      ${Else}
        ${NSD_CreateLabel} 0 26u 100% 40u "A Start menu entry is always created.$\r$\nProjects, settings and saves are kept when updating."
      ${EndIf}
      Pop $0
      nsDialogs::Show
    FunctionEnd

    Function VnTasksLeave
      ${NSD_GetState} $VnDeskCb $0
      ${If} $0 == ${BST_CHECKED}
        StrCpy $VnDesk "1"
      ${Else}
        StrCpy $VnDesk "0"
      ${EndIf}
    FunctionEnd
  !macroend

  !macro customInstall
    ${If} $VnDesk == "0"
      Delete "$newDesktopLink"
    ${EndIf}
    WriteRegStr HKCU "Software\VN Timeline Engine" "DesktopShortcut" $VnDesk
  !macroend
!else
  !macro customUnInstall
    ${ifNot} ${isUpdated}
      DeleteRegKey HKCU "Software\VN Timeline Engine"
    ${endIf}
  !macroend
!endif
