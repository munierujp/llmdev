(() => {
  window.addEventListener('load', () => {
    // 要素の取得
    const chatBoxElement = document.getElementById('chat-box')
    const chatFormElement = document.getElementById('chat-form')
    const userInputElement = document.getElementById('user-input')
    const submitButtonElement = document.getElementById('submit-button')

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
      scrollToLatestMessage()
    }

    /** ボットメッセージをチャットボックスに追加 */
    const addBotMessage = (message) => {
      const messageElement = document.createElement('div')
      messageElement.className = 'bot-message'
      messageElement.innerHTML = message
      chatBoxElement.appendChild(messageElement)
      scrollToLatestMessage()
    }
    
    scrollToLatestMessage()
    

    /** 送信処理 */
    const handleSubmit = () => {
      const userMessage = userInputElement.value.trim()
      addUserMessage(userMessage)
      
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
          addBotMessage(lastBotMessage.innerHTML)
        }
        
        // フォームを有効化
        userInputElement.disabled = false
        submitButtonElement.disabled = false
      })
      .catch(error => {
        console.error(error)

        // エラー時はフォームを復元
        userInputElement.value = userMessage
        userInputElement.disabled = false
        submitButtonElement.disabled = false
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
  })
})()
