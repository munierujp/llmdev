(() => {
  window.addEventListener('load', () => {
    // 要素の取得
    const chatBoxElement = document.getElementById('chat-box')
    const chatFormElement = document.getElementById('chat-form')
    const userInputElement = document.getElementById('user-input')
    const submitButtonElement = document.getElementById('submit-button')
    const clearButtonElement = document.querySelector('.clear-button-header')

    // 初回表示で入力欄へ自動フォーカス
    if (userInputElement && !userInputElement.disabled) {
      // レイアウト安定後に確実にフォーカスさせる
      setTimeout(() => {
        try { userInputElement.focus() } catch (_) { /* noop */ }
      }, 0)
    }

    // 削除ボタン有効化判定
    const updateClearButtonState = () => {
      if (!clearButtonElement) return
      if (clearButtonElement.disabled) {
        const hasAnyMessage = chatBoxElement.querySelector('.user-message, .bot-message') !== null
        if (hasAnyMessage) {
          clearButtonElement.disabled = false
        }
      }
    }

    // 入力内容に応じて送信ボタンの活性/非活性を切り替え
    const updateSubmitButtonState = () => {
      const hasText = userInputElement.value.trim().length > 0
      if (!userInputElement.disabled) {
        submitButtonElement.disabled = !hasText
      }
    }

    // 初期状態更新
    updateSubmitButtonState()

    /** 最新のメッセージにスクロール */
    const scrollToLatestMessage = () => {
      chatBoxElement.scrollTop = chatBoxElement.scrollHeight
    }

    /** ユーザーメッセージをチャットボックスに追加 */
    const addUserMessage = (message) => {
      const messageElement = document.createElement('div')
      messageElement.className = 'user-message'
      messageElement.textContent = message
      chatBoxElement.appendChild(messageElement)
      addCopyButtonToMessage(messageElement)
      scrollToLatestMessage()
      updateClearButtonState()
    }

    /** ユーザーメッセージにコピー ボタン追加（吹き出し外下部） */
    const addCopyButtonToMessage = (msgEl) => {
      if (!msgEl) return
      // 直後に既にツールバーがあればスキップ
      const next = msgEl.nextElementSibling
      if (next && next.classList && next.classList.contains('user-message-tools')) return

      const tools = document.createElement('div')
      tools.className = 'message-tools user-message-tools'
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'copy-msg-button'
      btn.setAttribute('aria-label', 'コピー')
      btn.innerHTML = '<i class="fas fa-copy"></i>'
      btn.addEventListener('click', async (e) => {
        e.stopPropagation()
        try {
          await navigator.clipboard.writeText(msgEl.innerText)
          btn.classList.remove('error')
          btn.classList.add('copied')
          btn.innerHTML = '<i class="fas fa-check"></i>'
          setTimeout(() => {
            btn.classList.remove('copied')
            btn.innerHTML = '<i class="fas fa-copy"></i>'
          }, 1400)
        } catch (err) {
          btn.classList.remove('copied')
          btn.classList.add('error')
          btn.innerHTML = '<i class="fas fa-exclamation"></i>'
          setTimeout(() => {
            btn.classList.remove('error')
            btn.innerHTML = '<i class="fas fa-copy"></i>'
          }, 1400)
        }
      })
      tools.appendChild(btn)
      msgEl.after(tools)
    }

    /** タイピングインジケータ表示 */
    const showTypingIndicator = () => {
      // 既存があれば一度除去
      hideTypingIndicator()
      const el = document.createElement('div')
  // 吹き出しスタイルを避けるため 'bot-message' を付与しない
  el.className = 'typing-indicator'
      el.id = 'typing-indicator'
  el.innerHTML = '<span class="sr-only">Chappyが考え中</span><span class="dots" aria-hidden="true"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>'
      chatBoxElement.appendChild(el)
      scrollToLatestMessage()
      return el
    }

    /** タイピングインジケータ除去 */
    const hideTypingIndicator = () => {
      const el = document.getElementById('typing-indicator')
      if (el && el.parentNode) {
        el.parentNode.removeChild(el)
      }
    }

    /** ボットメッセージをチャットボックスに追加 */
    const addBotMessage = (message) => {
      const messageElement = document.createElement('div')
      messageElement.className = 'bot-message'
      messageElement.innerHTML = message
      chatBoxElement.appendChild(messageElement)
      enhanceCodeBlocks(messageElement)
      // 追加後にコードブロックへシンタックスハイライト適用
      try {
        if (window.hljs) {
          messageElement.querySelectorAll('pre code').forEach(block => {
            window.hljs.highlightElement(block)
          })
        }
      } catch (e) {
        console.warn('highlight failed', e)
      }
      scrollToLatestMessage()
      updateClearButtonState()
    }

    scrollToLatestMessage()
    updateClearButtonState()


    /** 送信処理 */
    const handleSubmit = () => {
      const userMessage = userInputElement.value.trim()
      addUserMessage(userMessage)
  const typingEl = showTypingIndicator()

      // フォームを無効化
      userInputElement.value = ''
      userInputElement.disabled = true
      submitButtonElement.disabled = true

      // メッセージを送信
      const formData = new FormData()
      formData.append('user_message', userMessage)
      fetch('/send_message', {
          method: 'POST',
          body: formData
        })
        .then(response => {
          if (response.ok) {
            return response
          } else {
            throw new Error()
          }
        })
        .then(response => response.text())
        .then(html => {
          // TODO: APIでJSONレスポンスを返すようにする
          // HTMLレスポンスをパースしてボットの返答を抽出
          const parser = new DOMParser()
          const doc = parser.parseFromString(html, 'text/html')
          const messages = Array.from(doc.querySelectorAll('.bot-message'))

          // 最後のボットメッセージ（新しい応答）を追加
          if (messages.length > 0) {
            const lastBotMessage = messages.at(-1)
            hideTypingIndicator()
            addBotMessage(lastBotMessage.innerHTML)
          }

          // フォームを有効化
          userInputElement.disabled = false
          submitButtonElement.disabled = false
          // 再度入力しやすいようにフォーカスを戻す
          try { userInputElement.focus() } catch (_) {}
        })
        .catch(error => {
          console.error(error)
          hideTypingIndicator()

          // エラー時はフォームを復元
          userInputElement.value = userMessage
          userInputElement.disabled = false
          submitButtonElement.disabled = false
          try { userInputElement.focus() } catch (_) {}
        })
    }

    // 送信ボタンで送信
    chatFormElement.addEventListener('submit', event => {
      event.preventDefault()
      handleSubmit()
    })

    // Ctrl + Enterで送信
    userInputElement.addEventListener('keydown', event => {
      if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault()
        handleSubmit()
      }
    })

    // 入力変化でボタン状態を更新
    userInputElement.addEventListener('input', updateSubmitButtonState)

    // 既存メッセージ内コードブロックにもコピー機能付与
    document.querySelectorAll('.bot-message').forEach(m => enhanceCodeBlocks(m))
  // 既存ユーザーメッセージにコピー追加
  document.querySelectorAll('.user-message').forEach(m => addCopyButtonToMessage(m))
  })
})()

// コードブロック強化: コピー ボタン追加
function enhanceCodeBlocks(scope) {
  const pres = scope.querySelectorAll('pre')
  pres.forEach(pre => {
    if (pre.querySelector('.copy-button')) return
    const code = pre.querySelector('code')
    if (!code) return
    // 言語ラベル判定
    try {
      if (!pre.querySelector('.code-lang-badge') && code.className) {
        const classes = code.className.split(/\s+/)
        const langClass = classes.find(c => c.startsWith('language-'))
        if (langClass) {
          const raw = langClass.replace('language-','').toLowerCase()
          const langMap = {
            js: 'JavaScript', javascript: 'JavaScript', jsx: 'JSX', ts: 'TypeScript', typescript: 'TypeScript',
            py: 'Python', python: 'Python', rb: 'Ruby', java: 'Java', c: 'C', cpp: 'C++', cs: 'C#', go: 'Go', rs: 'Rust',
            php: 'PHP', swift: 'Swift', kotlin: 'Kotlin', scala: 'Scala', sh: 'Shell', bash: 'Bash', zsh: 'Zsh',
            html: 'HTML', css: 'CSS', json: 'JSON', yaml: 'YAML', yml: 'YAML', sql: 'SQL', md: 'Markdown', markdown: 'Markdown'
          }
            
          const label = langMap[raw] || raw.charAt(0).toUpperCase() + raw.slice(1)
          const badge = document.createElement('span')
          badge.className = 'code-lang-badge'
          badge.textContent = label
          pre.classList.add('has-lang-badge')
          pre.appendChild(badge)
        }
      }
    } catch (_) { /* noop */ }
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'copy-button'
    btn.innerHTML = '<i class="fas fa-copy"></i>'
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(code.innerText)
        btn.classList.remove('error')
        btn.classList.add('copied')
        btn.innerHTML = '<i class="fas fa-check"></i>'
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.innerHTML = '<i class="fas fa-copy"></i>'
        }, 1400)
      } catch (e) {
        console.warn('copy failed', e)
        btn.classList.remove('copied')
        btn.classList.add('error')
        btn.innerHTML = '<i class="fas fa-exclamation"></i>'
        setTimeout(() => {
          btn.classList.remove('error');
          btn.innerHTML = '<i class="fas fa-copy"></i>'
        }, 1200)
      }
    })
    pre.appendChild(btn)
  })
}