from flask import Flask, send_file
import qrcode
import io

app = Flask(__name__)

@app.route("/qr")
def qr():
    url = "http://192.168.1.84:3000/student.html"  # change later

    img = qrcode.make(url)

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)

    return send_file(buffer, mimetype="image/png")

if __name__ == "__main__":
    app.run(debug=True)