# YapperPlusPlus
## Want A New And Fully Working Yapper Client? We Got You!

## Because I Didnt Have Visual Studio This is Vibe Codded Mb gng

## Requirements:
{WebView2}(https://developer.microsoft.com/en-us/microsoft-edge/webview2/consumer)
{.NET Runtime 6.0 Or Above}(https://dotnet.microsoft.com/en-us/download/dotnet)

## How To Run:
Grab `yapperplusplus.exe` from [`dev-build/`](./dev-build/) and double click it. Done.

> SmartScreen might cry about it being unsigned. Click **More info → Run anyway**, it's fine.

## What It Does:
- Opens `yapper.website` in its own window
- Auto-injects `dep/inject.js` like its the browser console
- Auto-updates itself from `dep/build.build` and asks if you wanna update
- `inject.js` updates live too, no rebuild needed

## Repo Layout:
```
YapperPlusPlus/
├── src/          ← C# source
├── dep/          ← build.build + inject.js
└── dev-build/    ← yapperplusplus.exe
```

## Making A Release:
1. Bump `CurrentVersion` and `CurrentBuild` in `src/Form1.cs`
2. Update `dep/build.build` (bump the `build=` number)
3. Run `build.bat` (or `dotnet publish -c Release`)
4. Copy the exe to `dev-build/yapperplusplus.exe`
5. `git add . && git commit -m "Y1.1BH" && git push`

Everyone running it gets the update prompt next launch. No tags, no releases, no uploads.

## Building From Source:
You dont need Visual Studio, VS Code + .NET 6 SDK is enough.
```bash
cd src
dotnet publish -c Release
```
Exe lands in `src/bin/Release/net6.0-windows/win-x64/publish/`

## Troubleshooting:
| Problem | Fix |
|---|---|
| Blank white window | Install WebView2 Runtime |
| No update prompt | Did you actually push `dep/build.build`? |
| Script not running | Check `dep/inject.js` is committed |
| SmartScreen blocks it | **More info → Run anyway** |

## Credits:
Vibe codded by XES (nintendo in yapper)
