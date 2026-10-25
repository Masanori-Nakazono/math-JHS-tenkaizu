# ローカル確認用の静的サーバ。
# Artifact として公開したときと同じスケルトン（charset / viewport / リセット）を index.html に被せる。
import http.server, socketserver, io, os

SKELETON_HEAD = """<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>
:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
body{margin:0;font:14px system-ui,-apple-system,sans-serif}
img{max-width:100%}
[hidden]{display:none!important}
</style>
</head><body>
"""
SKELETON_TAIL = "\n</body></html>\n"

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def guess_type(self, path):
        t = super().guess_type(path)
        base = t.split(';')[0]
        if base in ('text/html', 'text/javascript', 'application/javascript', 'text/css'):
            return base + '; charset=utf-8'
        return t

    def send_head(self):
        if self.path in ('/', '/index.html'):
            with open(os.path.join(ROOT, 'index.html'), 'rb') as f:
                body = f.read()
            out = SKELETON_HEAD.encode() + body + SKELETON_TAIL.encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(out)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            return io.BytesIO(out)
        return super().send_head()

    def end_headers(self):
        if 'Cache-Control' not in self._headers_buffer_str():
            self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def _headers_buffer_str(self):
        return b''.join(getattr(self, '_headers_buffer', []) or []).decode('latin-1')

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('127.0.0.1', 8787), H) as httpd:
    httpd.serve_forever()
