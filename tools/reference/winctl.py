"""Wine-side driver for the SnowCraft window (runs under Wine's Windows Python).
Keys and move/down/up are PostMessage'd to the game window, so they never reach
other macOS apps. The `s*` commands use SetCursorPos + SendInput, which only
deliver to Wine but DO move the real macOS cursor (absolute SendInput moves did
not register under Wine). Captures are BitBlt'd from the window's own surface.

Usage: python.exe winctl.py <commands-file>
Commands (one per line, stage/client coords):
  info | shot <path.bmp> | move x y | down x y | up x y | key <char> | sleep <ms>
  burst <prefix> <count> <interval_ms>     (captures prefix_000.bmp ...)
"""
import ctypes, ctypes.wintypes as wt, sys, time, struct

u32 = ctypes.windll.user32
g32 = ctypes.windll.gdi32
WM_MOUSEMOVE, WM_LBUTTONDOWN, WM_LBUTTONUP = 0x200, 0x201, 0x202
WM_KEYDOWN, WM_KEYUP, WM_CHAR = 0x100, 0x101, 0x102


def find():
    hwnd = u32.FindWindowW(None, "SnowCraft")
    if not hwnd:
        sys.exit("SnowCraft window not found")
    # Prefer the largest child (the Director stage) if there is one.
    best = [hwnd, 0]
    EnumProc = ctypes.WINFUNCTYPE(wt.BOOL, wt.HWND, wt.LPARAM)
    def cb(h, _):
        r = wt.RECT(); u32.GetClientRect(h, ctypes.byref(r))
        area = r.right * r.bottom
        if area > best[1]:
            best[0], best[1] = h, area
        return True
    u32.EnumChildWindows(hwnd, EnumProc(cb), 0)
    return hwnd, best[0] if best[1] else hwnd


TOP, STAGE = find()
MODE = ["blt"]


def lp(x, y): return (int(y) << 16) | (int(x) & 0xFFFF)


def shot(path, hwnd=None):
    hwnd = hwnd or STAGE
    r = wt.RECT(); u32.GetClientRect(hwnd, ctypes.byref(r))
    w, h = r.right, r.bottom
    src = u32.GetDC(hwnd)
    mem = g32.CreateCompatibleDC(src)
    bmp = g32.CreateCompatibleBitmap(src, w, h)
    g32.SelectObject(mem, bmp)
    mode = MODE[0]
    if mode == "print":
        u32.PrintWindow(hwnd, mem, 2)
    elif mode == "screen":
        sdc = u32.GetDC(0)
        pt_ = wt.POINT(0, 0); u32.ClientToScreen(hwnd, ctypes.byref(pt_))
        g32.BitBlt(mem, 0, 0, w, h, sdc, pt_.x, pt_.y, 0x00CC0020)
        u32.ReleaseDC(0, sdc)
    else:
        g32.BitBlt(mem, 0, 0, w, h, src, 0, 0, 0x00CC0020)
    class BIH(ctypes.Structure):
        _fields_ = [("biSize", wt.DWORD), ("biWidth", wt.LONG), ("biHeight", wt.LONG),
                    ("biPlanes", wt.WORD), ("biBitCount", wt.WORD), ("biCompression", wt.DWORD),
                    ("biSizeImage", wt.DWORD), ("biXPelsPerMeter", wt.LONG), ("biYPelsPerMeter", wt.LONG),
                    ("biClrUsed", wt.DWORD), ("biClrImportant", wt.DWORD)]
    bih = BIH(ctypes.sizeof(BIH), w, h, 1, 24, 0, 0, 0, 0, 0, 0)
    stride = ((w * 3 + 3) // 4) * 4
    buf = ctypes.create_string_buffer(stride * h)
    g32.GetDIBits(mem, bmp, 0, h, buf, ctypes.byref(bih), 0)
    with open(path, "wb") as f:
        f.write(b"BM" + struct.pack("<IHHI", 14 + 40 + len(buf), 0, 0, 54))
        f.write(bytes(bih)); f.write(buf.raw)
    g32.DeleteObject(bmp); g32.DeleteDC(mem); u32.ReleaseDC(hwnd, src)


class MOUSEINPUT(ctypes.Structure):
    _fields_ = [("dx", wt.LONG), ("dy", wt.LONG), ("mouseData", wt.DWORD), ("dwFlags", wt.DWORD),
                ("time", wt.DWORD), ("dwExtraInfo", ctypes.c_void_p)]
class INPUT(ctypes.Structure):
    class _U(ctypes.Union):
        _fields_ = [("mi", MOUSEINPUT), ("pad", ctypes.c_byte * 32)]
    _anonymous_ = ("u",)
    _fields_ = [("type", wt.DWORD), ("u", _U)]


def to_screen(x, y):
    p_ = wt.POINT(int(x), int(y)); u32.ClientToScreen(STAGE, ctypes.byref(p_)); return p_.x, p_.y


def sinput(flags, x=None, y=None):
    i = INPUT(); i.type = 0
    if x is not None:
        # Position via SetCursorPos (moves the host cursor; see module docstring)
        sx, sy = to_screen(x, y); u32.SetCursorPos(sx, sy)
    i.mi.dwFlags = flags
    u32.SendInput(1, ctypes.byref(i), ctypes.sizeof(INPUT))


def post(msg, wp, x, y): u32.PostMessageW(STAGE, msg, wp, lp(x, y))


def run(lines):
    held = 0
    for line in lines:
        p = line.split()
        if not p or p[0].startswith("#"):
            continue
        c = p[0]
        if c == "info":
            r = wt.RECT(); u32.GetWindowRect(TOP, ctypes.byref(r))
            cr = wt.RECT(); u32.GetClientRect(STAGE, ctypes.byref(cr))
            print("top", TOP, "stage", STAGE, "rect", r.left, r.top, r.right, r.bottom, "client", cr.right, cr.bottom, flush=True)
        elif c == "mode":
            MODE[0] = p[1]
        elif c == "shot":
            shot(p[1])
        elif c == "burst":
            n, iv = int(p[2]), int(p[3]) / 1000
            t0 = time.perf_counter()
            for i in range(n):
                shot(f"{p[1]}_{i:03d}.bmp")
                dt = t0 + (i + 1) * iv - time.perf_counter()
                if dt > 0:
                    time.sleep(dt)
        elif c == "move":
            post(WM_MOUSEMOVE, held, int(p[1]), int(p[2]))
        elif c == "down":
            held = 1; post(WM_LBUTTONDOWN, 1, int(p[1]), int(p[2]))
        elif c == "up":
            held = 0; post(WM_LBUTTONUP, 0, int(p[1]), int(p[2]))
        elif c == "key":
            ch = p[1] if p[1] != "space" else " "
            vk = ord(ch.upper())
            u32.PostMessageW(STAGE, WM_KEYDOWN, vk, 1)
            u32.PostMessageW(STAGE, WM_CHAR, ord(ch), 1)
            u32.PostMessageW(STAGE, WM_KEYUP, vk, 0xC0000001)
        elif c == "smove":
            sinput(0, p[1], p[2])
        elif c == "sdown":
            sinput(0x0002, p[1], p[2])
        elif c == "sup":
            sinput(0x0004, p[1], p[2])
        elif c == "cursor":
            q = wt.POINT(); u32.GetCursorPos(ctypes.byref(q)); print("wine cursor", q.x, q.y, flush=True)
        elif c == "sleep":
            time.sleep(int(p[1]) / 1000)
        print("ok", line.strip(), round(time.perf_counter(), 3), flush=True)


if __name__ == "__main__":
    run(open(sys.argv[1]).read().splitlines())
