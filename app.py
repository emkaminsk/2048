from flask import Flask, send_file

app = Flask(__name__)

@app.route('/')
def index():
    return send_file('index.html')

@app.route('/style.css')
def styles():
    return send_file('style.css')

@app.route('/game.js')
def game():
    return send_file('game.js')

@app.route('/all.min.css')
def fontawesome_css():
    return send_file('all.min.css')

@app.route('/<path:filename>')
def serve_files(filename):
    return send_file(filename) 