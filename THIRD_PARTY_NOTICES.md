# Third-party notices

VN Timeline Engine itself is licensed under the MIT License (see `LICENSE`).
It uses or ships the following third-party components. Their licenses stay with them.

| Component | Used for | License | Where the license text is |
|---|---|---|---|
| [Electron](https://www.electronjs.org/) | Runs the editor and the exported Windows games | MIT | `LICENSE` in the Electron folder of every Windows build (next to the `.exe`) |
| Chromium (part of Electron) | Browser technology inside Electron | BSD-style and others | `LICENSES.chromium.html` in every Windows build |
| [rcedit](https://github.com/electron/rcedit) | Sets the icon and name of exported `.exe` files | MIT | `tools/rcedit-LICENSE.txt` (in builds: `resources/rcedit-LICENSE.txt`) |
| [Cinzel](https://github.com/NDISCOVER/Cinzel) font | Example project only | SIL Open Font License 1.1 | `templates/fonts/Cinzel-OFL.txt` (copied into the example project as `Cinzel-Lizenz-OFL.txt`) |
| [@electron/packager](https://github.com/electron/packager) | Development only: builds the Windows version | BSD-2-Clause | not shipped |

All example images, sounds and texts in the example, tutorial and learning projects were made for this
project and fall under the project’s MIT License.

## Games made with VN Timeline Engine

A Windows game exported by the engine contains Electron/Chromium and parts of the engine.
The license files of Electron and Chromium are copied into the exported game automatically.
Your own story, images, music and texts belong to you – the MIT License of the engine does not
apply to your content.
