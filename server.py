import http.server
import socketserver
import os
import urllib.request
import urllib.parse
import urllib.error
import sys

PORT = 8000
DIRECTORY = "/home/jiwho/문서/mail-Mui"

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_HEAD(self):
        super().do_HEAD()

    def do_GET(self):
        # Default behavior for static files
        return super().do_GET()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def run():
    try:
        os.chdir(DIRECTORY)
    except FileNotFoundError:
        print(f"Error: Directory {DIRECTORY} not found.")
        sys.exit(1)

    socketserver.TCPServer.allow_reuse_address = True
    try:
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            print(f"Server started at http://localhost:{PORT}")
            print(f"Serving files from: {DIRECTORY}")
            httpd.serve_forever()
    except OSError as e:
        print(f"Error starting server: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nServer stopped.")

if __name__ == "__main__":
    run()
