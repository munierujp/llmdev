window.addEventListener('load', () => {  
  const chatBoxElement = document.getElementById('chat-box')
  chatBoxElement.scrollTop = chatBoxElement.scrollHeight
  const formElement = document.getElementById('chat-form')
  const textareaElement = document.getElementById('user-input')
  textareaElement.addEventListener('keydown', event => {
    if (event.ctrlKey && event.key === 'Enter') {
      event.preventDefault()
      formElement.submit()
    }
  });
})