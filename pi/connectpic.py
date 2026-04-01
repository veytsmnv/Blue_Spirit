import socket
from flask import Flask, send_file
import qrcode
import io

app = Flask(__name__)

def get_local_ip():
    """Get the Pi's local network IP address dynamically."""
    try:
        # Connect to an external address to determine the outbound interface IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

@app.route("/qr")
def qr():
    ip = get_local_ip()
    url = f"http://{ip}:3000/student.html"
    print(f"QR code pointing to: {url}")

    img = qrcode.make(url)

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)

    return send_file(buffer, mimetype="image/png")

if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=True)