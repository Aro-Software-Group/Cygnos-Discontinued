#!/usr/bin/env python3
"""
Simple HTTP server for Cygnos AI Agent
Run this script to start a local web server and open the Cygnos app in your browser.
"""
import os
import sys
import json
import traceback
from flask import Flask, render_template, request, jsonify, send_from_directory, Response
from urllib.parse import urlparse

# Configuration
PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
AUTO_OPEN_BROWSER = True

app = Flask(__name__, static_url_path='', static_folder='public', template_folder='.')

# エラーハンドリング
@app.errorhandler(404)
def not_found_error(error):
    return jsonify({
        'error': 'ページまたはリソースが見つかりません',
        'status': 404
    }), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'error': 'サーバー内部エラーが発生しました',
        'status': 500,
        'details': str(error)
    }), 500

@app.errorhandler(Exception)
def handle_exception(error):
    # エラー情報の収集
    error_info = {
        'error': str(error),
        'type': error.__class__.__name__,
        'traceback': traceback.format_exc()
    }
    
    # エラーをログに記録
    app.logger.error(f'Unhandled exception: {error_info}')
    
    # クライアントへの応答
    return jsonify({
        'error': 'アプリケーションエラーが発生しました',
        'status': 500,
        'message': str(error)
    }), 500

# ルート
@app.route('/')
def home():
    try:
        return render_template('index.html')
    except Exception as e:
        app.logger.error(f'Error rendering index.html: {e}')
        return handle_exception(e)

@app.route('/tasks')
def tasks():
    try:
        return render_template('tasks.html')
    except Exception as e:
        app.logger.error(f'Error rendering tasks.html: {e}')
        return handle_exception(e)

@app.route('/memory')
def memory():
    try:
        return render_template('memory.html')
    except Exception as e:
        app.logger.error(f'Error rendering memory.html: {e}')
        return handle_exception(e)

@app.route('/public/<path:path>')
def send_public(path):
    try:
        return send_from_directory('public', path)
    except Exception as e:
        app.logger.error(f'Error serving static file {path}: {e}')
        return handle_exception(e)

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json(silent=True)
        if data is None:
            return jsonify({
                'error': 'JSONデータが見つかりません',
                'status': 400
            }), 400
        
        message = data.get('message', '')
        if not message:
            return jsonify({
                'error': 'メッセージが空です',
                'status': 400
            }), 400
        
        # AIの処理（エコーバック）
        response = {
            'text': f"あなたの質問に対する回答: {message}",
            'sources': []
        }
        
        return jsonify(response)
    except Exception as e:
        app.logger.error(f'Error in chat endpoint: {e}')
        return handle_exception(e)

@app.route('/api/tasks', methods=['GET', 'POST'])
def api_tasks():
    try:
        if request.method == 'GET':
            # ダミーデータを返す
            tasks = [
                {'id': 1, 'title': 'Task 1', 'status': 'in-progress'},
                {'id': 2, 'title': 'Task 2', 'status': 'completed'}
            ]
            return jsonify(tasks)
        elif request.method == 'POST':
            data = request.get_json(silent=True)
            if data is None:
                return jsonify({
                    'error': 'JSONデータが見つかりません',
                    'status': 400
                }), 400
            
            new_task = {
                'id': data.get('id', 3),
                'title': data.get('title', 'New Task'),
                'status': data.get('status', 'pending')
            }
            return jsonify(new_task), 201
    except Exception as e:
        app.logger.error(f'Error in tasks endpoint: {e}')
        return handle_exception(e)

@app.route('/api/memory', methods=['GET', 'POST'])
def api_memory():
    try:
        if request.method == 'GET':
            # ダミーデータを返す
            memory_items = [
                {'id': 1, 'content': 'Memory item 1'},
                {'id': 2, 'content': 'Memory item 2'}
            ]
            return jsonify(memory_items)
        elif request.method == 'POST':
            data = request.get_json(silent=True)
            if data is None:
                return jsonify({
                    'error': 'JSONデータが見つかりません',
                    'status': 400
                }), 400
            
            new_memory_item = {
                'id': data.get('id', 3),
                'content': data.get('content', 'New Memory Item')
            }
            return jsonify(new_memory_item), 201
    except Exception as e:
        app.logger.error(f'Error in memory endpoint: {e}')
        return handle_exception(e)

# ヘルスチェックエンドポイント
@app.route('/health')
def health_check():
    try:
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.datetime.now().isoformat()
        })
    except Exception as e:
        app.logger.error(f'Error in health check: {e}')
        return handle_exception(e)

if __name__ == '__main__':
    if AUTO_OPEN_BROWSER:
        import threading, webbrowser, time
        def open_browser():
            try:
                time.sleep(1)  # サーバー起動を待機
                webbrowser.open(f"http://localhost:{PORT}")
            except Exception as e:
                print(f"ブラウザを開く際にエラーが発生しました: {e}")
        
        threading.Thread(target=open_browser).start()
    
    try:
        app.run(debug=True, port=PORT)
    except Exception as e:
        print(f"サーバーの起動に失敗しました: {e}")
        sys.exit(1)
