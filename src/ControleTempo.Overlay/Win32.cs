using System.Runtime.InteropServices;

namespace ControleTempo.Overlay;

/// <summary>
/// Chamadas nativas do Windows usadas pelo overlay: medir a inatividade do
/// usuário e executar logoff/suspender/desligar quando o serviço ordena. Rodam
/// na sessão do usuário (onde o overlay vive).
/// </summary>
internal static class Win32
{
    // ---- Inatividade (GetLastInputInfo) ----
    [StructLayout(LayoutKind.Sequential)]
    private struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }

    [DllImport("user32.dll")] private static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
    [DllImport("kernel32.dll")] private static extern uint GetTickCount();

    /// <summary>Segundos desde a última entrada de mouse/teclado nesta sessão.</summary>
    public static int SegundosInativo()
    {
        var info = new LASTINPUTINFO { cbSize = (uint)Marshal.SizeOf<LASTINPUTINFO>() };
        if (!GetLastInputInfo(ref info)) return 0;
        uint idleMs = GetTickCount() - info.dwTime;
        return (int)(idleMs / 1000);
    }

    // ---- Logoff / desligamento ----
    [DllImport("user32.dll", SetLastError = true)] private static extern bool ExitWindowsEx(uint uFlags, uint dwReason);

    private const uint EWX_LOGOFF = 0x00000000;
    private const uint EWX_SHUTDOWN = 0x00000001;
    private const uint EWX_FORCEIFHUNG = 0x00000010;

    public static void Logoff() => ExitWindowsEx(EWX_LOGOFF | EWX_FORCEIFHUNG, 0);
    public static void Desligar() => ExitWindowsEx(EWX_SHUTDOWN | EWX_FORCEIFHUNG, 0);

    // ---- Suspender ----
    [DllImport("powrprof.dll", SetLastError = true)]
    private static extern bool SetSuspendState(bool hibernate, bool forceCritical, bool disableWakeEvent);

    public static void Suspender() => SetSuspendState(false, false, false);
}
