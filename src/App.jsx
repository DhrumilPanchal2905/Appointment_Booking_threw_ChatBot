import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import ChatBot from './Component/Chatbot/Chatbot'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div>
      <ChatBot />
    </div>
  )
}

export default App
