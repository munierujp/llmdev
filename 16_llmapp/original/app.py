import sys
import os
# VS Codeのデバッグ実行で `from chatbot.graph` でエラーを出さない対策
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import uuid
from flask import Flask, render_template, request, make_response, session 
from chatbot.graph import get_bot_response, get_messages_list, memory

app = Flask(__name__)
app.secret_key = 'your_secret_key'

@app.route('/', methods=['GET', 'POST'])
def index():
  if 'thread_id' not in session:
    session['thread_id'] = str(uuid.uuid4())

  match request.method:
    case 'GET':
      memory.storage.clear()
      response = make_response(render_template('index.html', messages=[]))
      return response
    case 'POST':
      user_message = request.form['user_message']
      get_bot_response(user_message, memory, session['thread_id'])
      messages = get_messages_list(memory, session['thread_id'])
      return make_response(render_template('index.html', messages=messages))

@app.route('/clear', methods=['POST'])
def clear():  
  session.pop('thread_id', None)
  memory.storage.clear()
  response = make_response(render_template('index.html', messages=[]))
  return response

if __name__ == '__main__':
  app.run(debug=True)
