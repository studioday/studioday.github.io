"""Minimal headless-Chrome driver over --remote-debugging-pipe (stdlib only).

Used to verify things the hidden preview pane cannot show (view transitions, timed animation).
"""
import base64, json, os, subprocess, tempfile, time, select

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


class Chrome:
    def __init__(self, width=1440, height=900, mobile=False):
        to_chrome_r, self._w = os.pipe()
        self._r, from_chrome_w = os.pipe()
        hi_r, hi_w = os.dup(to_chrome_r), os.dup(from_chrome_w)

        def child():
            os.dup2(hi_r, 3)
            os.dup2(hi_w, 4)

        self.profile = tempfile.mkdtemp(prefix="cdp-profile-")
        self.proc = subprocess.Popen(
            [CHROME, "--headless=new", "--remote-debugging-pipe", f"--user-data-dir={self.profile}",
             f"--window-size={width},{height}", "--hide-scrollbars", "--no-first-run",
             "--no-default-browser-check", "--disable-extensions", "about:blank"],
            # pass_fds would close fds 3/4 after preexec_fn runs; dup2 alone marks just them inheritable
            close_fds=False, preexec_fn=child, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        for fd in (to_chrome_r, from_chrome_w, hi_r, hi_w):
            os.close(fd)
        self._buf = b""
        self._id = 0
        self.events = []
        targets = self.call("Target.getTargets")["targetInfos"]
        page = next(t for t in targets if t["type"] == "page")
        self.session = self.call("Target.attachToTarget", {"targetId": page["targetId"], "flatten": True})["sessionId"]
        self.call("Page.enable", session=True)
        self.call("Runtime.enable", session=True)
        if mobile:
            self.call("Emulation.setDeviceMetricsOverride",
                      {"width": width, "height": height, "deviceScaleFactor": 2, "mobile": True}, session=True)

    def _read(self, timeout):
        end = time.time() + timeout
        while b"\0" not in self._buf:
            left = end - time.time()
            if left <= 0:
                return None
            if select.select([self._r], [], [], left)[0]:
                chunk = os.read(self._r, 1 << 20)
                if not chunk:
                    return None
                self._buf += chunk
        msg, self._buf = self._buf.split(b"\0", 1)
        return json.loads(msg)

    def call(self, method, params=None, session=False, timeout=30):
        self._id += 1
        msg = {"id": self._id, "method": method, "params": params or {}}
        if session:
            msg["sessionId"] = self.session
        os.write(self._w, json.dumps(msg).encode() + b"\0")
        end = time.time() + timeout
        while time.time() < end:
            m = self._read(end - time.time())
            if m is None:
                break
            if m.get("id") == self._id:
                if "error" in m:
                    raise RuntimeError(f"{method}: {m['error']}")
                return m.get("result", {})
            self.events.append(m)
        raise TimeoutError(method)

    def wait_event(self, name, timeout=15):
        end = time.time() + timeout
        while time.time() < end:
            for i, e in enumerate(self.events):
                if e.get("method") == name:
                    return self.events.pop(i)
            m = self._read(0.2)
            if m is not None:
                self.events.append(m)
        raise TimeoutError(name)

    def goto(self, url, settle=1.5):
        self.events.clear()
        self.call("Page.navigate", {"url": url}, session=True)
        self.wait_event("Page.loadEventFired")
        time.sleep(settle)

    def js(self, expr):
        r = self.call("Runtime.evaluate", {"expression": expr, "awaitPromise": True, "returnByValue": True}, session=True)
        if "exceptionDetails" in r:
            raise RuntimeError(r["exceptionDetails"])
        return r["result"].get("value")

    def shot(self, path, quality=None):
        params = {"format": "jpeg", "quality": quality or 70} if path.endswith(".jpg") else {"format": "png"}
        data = self.call("Page.captureScreenshot", params, session=True)["data"]
        with open(path, "wb") as f:
            f.write(base64.b64decode(data))
        return path

    def close(self):
        try:
            self.call("Browser.close", timeout=5)
        except Exception:
            pass
        self.proc.wait(timeout=10)
