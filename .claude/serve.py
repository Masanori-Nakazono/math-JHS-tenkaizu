# ローカル確認用の静的サーバ。
# "/" と "/index.html" は、build.sh と同じスケルトン（tools/page-head.html,
# tools/page-tail.html）で index.html を包んで返す。ビルドし直さずに編集を確認できる。
# dist/ 以下は素のファイルとして配信されるので、公開されるページそのものも確認できる。
import http.server, socketserver, io, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
read = lambda *p: open(os.path.join(ROOT, *p), 'rb').read()

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
            body = read('tools', 'page-head.html') + read('index.html') + read('tools', 'page-tail.html')
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            return io.BytesIO(body)
        return super().send_head()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('127.0.0.1', 8787), H) as httpd:
    httpd.serve_forever()
