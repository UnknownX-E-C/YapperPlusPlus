using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace YapperPlusPlus
{
    public partial class Form1 : Form
    {
        // ============ BUMP THESE ON EVERY NEW BUILD ============
        private const string CurrentVersion = "Y1.0BH";
        private const int    CurrentBuild   = 1;
        // =======================================================

        // ============ SET YOUR USERNAME / REPO / BRANCH ============
        private const string GitHubRepo   = "YOUR_USERNAME/YapperPlusPlus";
        private const string GitHubBranch = "main";
        private const string RawBase      = "https://raw.githubusercontent.com/"
                                            + GitHubRepo + "/" + GitHubBranch + "/";
        // ===========================================================

        // Paths match your repo layout exactly.
        private const string ScriptUrl    = RawBase + "dep/inject.js";
        private const string ManifestUrl  = RawBase + "dep/build.build";
        private const string UpdateExeUrl = RawBase + "dev-build/yapperplusplus.exe";

        private static readonly string AppDataDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "YapperPlusPlus");
        private static readonly string ScriptCachePath = Path.Combine(AppDataDir, "inject.cache.js");

        private WebView2 webView;
        private string scriptToInject = "";

        public Form1()
        {
            InitializeComponent();
            this.Load += async (_, __) => await StartAsync();
        }

        private async Task StartAsync()
        {
            await CheckForUpdatesAsync();
            scriptToInject = await FetchScriptAsync();

            webView = new WebView2 { Dock = DockStyle.Fill };
            this.Controls.Add(webView);

            await webView.EnsureCoreWebView2Async(null);

            if (!string.IsNullOrWhiteSpace(scriptToInject))
                await webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(scriptToInject);

            webView.CoreWebView2.Navigate("https://yapper.website");
        }

        // ------------------------------------------------------------ UPDATE

        private async Task CheckForUpdatesAsync()
        {
            try
            {
                using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
                string url = ManifestUrl + "?t=" + DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                string content = await http.GetStringAsync(url);

                int remoteBuild = -1;
                string remoteVersion = "unknown";

                foreach (var raw in content.Split('\n'))
                {
                    var line = raw.Trim();
                    if (line.Length == 0 || line.StartsWith("#")) continue;

                    if (line.StartsWith("build="))
                        int.TryParse(line.Substring("build=".Length).Trim(), out remoteBuild);
                    else if (line.StartsWith("version="))
                        remoteVersion = line.Substring("version=".Length).Trim();
                }

                if (remoteBuild <= CurrentBuild) return;

                var answer = MessageBox.Show(
                    $"A new version of Yapper++ is available!\n\n" +
                    $"   Current:  {CurrentVersion}  (build {CurrentBuild})\n" +
                    $"   Latest:   {remoteVersion}  (build {remoteBuild})\n\n" +
                    $"Download and install it now? The app will restart.",
                    "Yapper++ — Update Available",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Information);

                if (answer == DialogResult.Yes)
                    await PerformUpdateAsync();
            }
            catch { /* offline / unreachable / bad file → skip silently */ }
        }

        private async Task PerformUpdateAsync()
        {
            try
            {
                string currentExe = Application.ExecutablePath;
                string tempDir    = Path.GetTempPath();
                string newExe     = Path.Combine(tempDir, "yapperplusplus.new.exe");

                using (var http = new HttpClient { Timeout = TimeSpan.FromMinutes(5) })
                {
                    var bytes = await http.GetByteArrayAsync(
                        UpdateExeUrl + "?t=" + DateTimeOffset.UtcNow.ToUnixTimeSeconds());
                    await File.WriteAllBytesAsync(newExe, bytes);
                }

                string batPath = Path.Combine(tempDir, "yapper_update.bat");
                string exeName = Path.GetFileName(currentExe);

                string bat = $@"@echo off
title Yapper++ Updater
echo Waiting for Yapper++ to close...
:waitloop
tasklist /fi ""imagename eq {exeName}"" 2>nul | find /i ""{exeName}"" >nul
if not errorlevel 1 (
    timeout /t 1 /nobreak >nul
    goto waitloop
)
echo Installing update...
move /y ""{newExe}"" ""{currentExe}""
if errorlevel 1 (
    echo Failed to replace the executable.
    pause
    exit /b 1
)
echo Launching new version...
start """" ""{currentExe}""
del ""%~f0""
";
                File.WriteAllText(batPath, bat);

                Process.Start(new ProcessStartInfo
                {
                    FileName        = batPath,
                    UseShellExecute = true,
                    WindowStyle     = ProcessWindowStyle.Hidden
                });

                Environment.Exit(0);
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "Update failed:\n\n" + ex.Message,
                    "Yapper++ — Update",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
            }
        }

        // ------------------------------------------------------------ SCRIPT

        private async Task<string> FetchScriptAsync()
        {
            try
            {
                using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
                string url = ScriptUrl + "?t=" + DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                string fresh = await http.GetStringAsync(url);

                Directory.CreateDirectory(AppDataDir);
                await File.WriteAllTextAsync(ScriptCachePath, fresh);
                return fresh;
            }
            catch
            {
                return File.Exists(ScriptCachePath)
                    ? await File.ReadAllTextAsync(ScriptCachePath)
                    : "";
            }
        }
    }
}