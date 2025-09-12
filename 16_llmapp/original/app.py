import sys
import os
# VS Codeのデバッグ実行で `from chatbot.graph` でエラーを出さない対策
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import uuid
from flask import Flask, render_template, request, make_response, session, redirect, url_for
from chatbot.graph import get_bot_response, get_messages_list, memory

app = Flask(__name__)
app.secret_key = 'your_secret_key'

@app.route('/', methods=['GET'])
def index():
  messages = []

  if 'thread_id' not in session:
    session['thread_id'] = str(uuid.uuid4())
    memory.storage.clear()
  else:
    try:
      messages = get_messages_list(memory, session['thread_id'])
    except:
      messages = []
  
  clear_disabled = (len(messages) == 0)
  response = make_response(render_template('index.html', messages=messages, clear_disabled=clear_disabled))
  return response

@app.route('/send_message', methods=['POST'])
def send_message():
  if 'thread_id' not in session:
    session['thread_id'] = str(uuid.uuid4())
  
  user_message = request.form['user_message']
  get_bot_response(user_message, memory, session['thread_id'])
  return redirect(url_for('index'))

@app.route('/clear', methods=['POST'])
def clear():  
  session.pop('thread_id', None)
  memory.storage.clear()
  return redirect(url_for('index'))

if __name__ == '__main__':
  app.run(debug=True)
